using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Shared.Constants;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Auth.Refresh;

public sealed record RefreshTokenCommand(string RefreshToken, string? IpAddress)
    : IRequest<Result<AuthResponse>>, ITransactionalRequest;

public sealed class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator() =>
        RuleFor(x => x.RefreshToken).NotEmpty().MinimumLength(32);
}

public sealed class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, Result<AuthResponse>>
{
    private readonly IAppDbContext _db;
    private readonly IJwtTokenService _jwt;

    public RefreshTokenCommandHandler(IAppDbContext db, IJwtTokenService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    public async Task<Result<AuthResponse>> Handle(RefreshTokenCommand request, CancellationToken ct)
    {
        var user = await _db.Users
            .Include(u => u.Roles)
            .Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(u => u.RefreshTokens.Any(rt => rt.Token == request.RefreshToken), ct);

        if (user is null)
            return Result.Failure<AuthResponse>(Error.Unauthorized("Auth.InvalidRefresh", "توکن نوسازی نامعتبر است."));

        var existing = user.RefreshTokens.FirstOrDefault(rt => rt.Token == request.RefreshToken);
        if (existing is null || !existing.IsActive)
            return Result.Failure<AuthResponse>(Error.Unauthorized("Auth.InvalidRefresh", "توکن نوسازی منقضی یا باطل است."));

        if (!user.IsActive)
            return Result.Failure<AuthResponse>(Error.Forbidden("Auth.UserInactive", "حساب کاربری غیرفعال است."));

        string? tenantSlug = null;
        if (user.TenantId.HasValue)
        {
            var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == user.TenantId.Value, ct);
            if (tenant is null || !tenant.CanAccess())
                return Result.Failure<AuthResponse>(Error.Forbidden("Auth.TenantInaccessible", "دسترسی به مستاجر امکان‌پذیر نیست."));
            tenantSlug = tenant.Slug;
        }

        var newRefresh = _jwt.IssueRefreshToken();
        var newRefreshExpires = DateTime.UtcNow.AddDays(AppConstants.RefreshTokenDays);

        user.RevokeRefreshToken(existing.Token, request.IpAddress, newRefresh);
        user.IssueRefreshToken(newRefresh, newRefreshExpires, request.IpAddress);

        // فقط نقش‌های هم‌اسکوپ با مستاجرِ توکن؛ نقش‌های مستاجرهای دیگر نباید در توکن نشت کنند.
        var roles = user.Roles.Where(r => r.TenantId == user.TenantId).Select(r => r.Role).ToArray();
        var permissions = PermissionMap.ResolvePermissions(roles);

        var access = _jwt.IssueAccessToken(new JwtIssueRequest(
            user.Id, user.Email, user.DisplayName, user.TenantId, tenantSlug, roles, permissions));

        await _db.SaveChangesAsync(ct);

        return new AuthResponse(
            access.Token, access.ExpiresAtUtc,
            newRefresh, newRefreshExpires,
            new AuthenticatedUserDto(user.Id, user.Email, user.DisplayName, user.TenantId, tenantSlug, roles, permissions));
    }
}
// resync-marker
