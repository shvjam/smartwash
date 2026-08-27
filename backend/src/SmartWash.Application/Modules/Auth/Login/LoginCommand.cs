using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Identity;
using SmartWash.Shared.Constants;
using SmartWash.Shared.Identifiers;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Auth.Login;

public sealed record LoginCommand(string Email, string Password, string? TenantSlug, string? IpAddress)
    : IRequest<Result<AuthResponse>>, ITransactionalRequest;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6).MaximumLength(128);
    }
}

public sealed class LoginCommandHandler : IRequestHandler<LoginCommand, Result<AuthResponse>>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public LoginCommandHandler(IAppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
    }

    public async Task<Result<AuthResponse>> Handle(LoginCommand request, CancellationToken ct)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var requestedSlug = string.IsNullOrWhiteSpace(request.TenantSlug)
            ? null
            : SlugGenerator.Generate(request.TenantSlug);

        Guid? scopeTenantId = null;
        if (requestedSlug is not null)
        {
            scopeTenantId = await _db.Tenants
                .AsNoTracking()
                .Where(t => t.Slug == requestedSlug)
                .Select(t => (Guid?)t.Id)
                .FirstOrDefaultAsync(ct);
            if (scopeTenantId is null)
                return Result.Failure<AuthResponse>(Error.Unauthorized("Auth.InvalidCredentials", "ایمیل یا گذرواژه نادرست است."));
        }

        // Login must not track User. It is a high-frequency operation and the
        // User aggregate has RowVersion optimistic concurrency enabled.
        var user = scopeTenantId.HasValue
            ? await _db.Users.AsNoTracking().Include(u => u.Roles)
                .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail && u.TenantId == scopeTenantId.Value, ct)
            : await _db.Users.AsNoTracking().Include(u => u.Roles)
                .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail && u.TenantId == null, ct);

        if (user is null)
            return Result.Failure<AuthResponse>(Error.Unauthorized("Auth.InvalidCredentials", "ایمیل یا گذرواژه نادرست است."));

        if (!user.IsActive)
            return Result.Failure<AuthResponse>(Error.Forbidden("Auth.UserInactive", "حساب کاربری غیرفعال است."));

        if (user.IsCurrentlyLocked())
            return Result.Failure<AuthResponse>(Error.Forbidden("Auth.LockedOut", "حساب کاربری به دلیل تلاش‌های ناموفق قفل شده است."));

        var now = DateTime.UtcNow;
        if (!_hasher.Verify(request.Password, user.PasswordHash))
        {
            var failedAttempts = user.FailedLoginAttempts + 1;
            var isLocked = failedAttempts >= 5;
            var lockoutEnd = isLocked ? now.AddMinutes(15) : user.LockoutEndUtc;
            await _db.Users.Where(u => u.Id == user.Id).ExecuteUpdateAsync(setters => setters
                .SetProperty(u => u.FailedLoginAttempts, failedAttempts)
                .SetProperty(u => u.IsLockedOut, isLocked)
                .SetProperty(u => u.LockoutEndUtc, lockoutEnd), ct);
            return Result.Failure<AuthResponse>(Error.Unauthorized("Auth.InvalidCredentials", "ایمیل یا گذرواژه نادرست است."));
        }

        string? tenantSlug = null;
        if (user.TenantId.HasValue)
        {
            var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == user.TenantId.Value, ct);
            if (tenant is null || !tenant.CanAccess())
                return Result.Failure<AuthResponse>(Error.Forbidden("Auth.TenantInaccessible", "دسترسی به مستاجر امکان‌پذیر نیست."));
            tenantSlug = tenant.Slug;
        }

        var roles = user.Roles.Where(r => r.TenantId == user.TenantId).Select(r => r.Role).ToArray();
        var permissions = PermissionMap.ResolvePermissions(roles);
        var access = _jwt.IssueAccessToken(new JwtIssueRequest(
            user.Id, user.Email, user.DisplayName, user.TenantId, tenantSlug, roles, permissions));

        // This write intentionally bypasses User's RowVersion. It is an atomic
        // set-based update, so parallel demo logins cannot conflict.
        var securityStateUpdated = await _db.Users.Where(u => u.Id == user.Id).ExecuteUpdateAsync(setters => setters
            .SetProperty(u => u.LastLoginAtUtc, now)
            .SetProperty(u => u.FailedLoginAttempts, 0)
            .SetProperty(u => u.LockoutEndUtc, (DateTime?)null)
            .SetProperty(u => u.IsLockedOut, false), ct);
        if (securityStateUpdated == 0)
            return Result.Failure<AuthResponse>(Error.Unauthorized("Auth.InvalidCredentials", "ایمیل یا گذرواژه نادرست است."));

        var refreshTokenValue = _jwt.IssueRefreshToken();
        var refreshExpires = now.AddDays(AppConstants.RefreshTokenDays);
        _db.RefreshTokens.Add(RefreshToken.Create(user.Id, refreshTokenValue, refreshExpires, request.IpAddress));
        await _db.SaveChangesAsync(ct); // only INSERTs into RefreshTokens; no Users UPDATE is tracked.

        return new AuthResponse(
            access.Token, access.ExpiresAtUtc,
            refreshTokenValue, refreshExpires,
            new AuthenticatedUserDto(user.Id, user.Email, user.DisplayName, user.TenantId, tenantSlug, roles, permissions));
    }
}
// resync-marker
