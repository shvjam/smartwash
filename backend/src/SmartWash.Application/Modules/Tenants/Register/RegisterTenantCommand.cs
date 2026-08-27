using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Application.Modules.Auth;
using SmartWash.Domain.Identity;
using SmartWash.Domain.Operations;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Constants;
using SmartWash.Shared.Identifiers;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Tenants.Register;

public sealed record RegisterTenantCommand(
    string DisplayName,
    string Slug,
    string OwnerEmail,
    string OwnerPhone,
    string OwnerDisplayName,
    string OwnerPassword,
    string? IpAddress) : IRequest<Result<AuthResponse>>, ITransactionalRequest;

public sealed class RegisterTenantCommandValidator : AbstractValidator<RegisterTenantCommand>
{
    public RegisterTenantCommandValidator()
    {
        RuleFor(x => x.DisplayName).NotEmpty().MinimumLength(2).MaximumLength(100);
        RuleFor(x => x.Slug).NotEmpty().MinimumLength(3).MaximumLength(60)
            .Matches("^[a-z0-9][a-z0-9-]*[a-z0-9]$").WithMessage("نامک باید فقط شامل حروف کوچک انگلیسی، اعداد و خط فاصله باشد.");
        RuleFor(x => x.OwnerEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.OwnerPhone).NotEmpty().Matches("^09[0-9]{9}$").WithMessage("شماره موبایل معتبر نیست.");
        RuleFor(x => x.OwnerDisplayName).NotEmpty().MinimumLength(2).MaximumLength(100);
        RuleFor(x => x.OwnerPassword).NotEmpty().MinimumLength(8).MaximumLength(128)
            .Matches("[A-Z]").WithMessage("گذرواژه باید حداقل یک حرف بزرگ داشته باشد.")
            .Matches("[a-z]").WithMessage("گذرواژه باید حداقل یک حرف کوچک داشته باشد.")
            .Matches("[0-9]").WithMessage("گذرواژه باید حداقل یک رقم داشته باشد.");
    }
}

public sealed class RegisterTenantCommandHandler : IRequestHandler<RegisterTenantCommand, Result<AuthResponse>>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public RegisterTenantCommandHandler(IAppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
    }

    public async Task<Result<AuthResponse>> Handle(RegisterTenantCommand request, CancellationToken ct)
    {
        var slug = SlugGenerator.Generate(request.Slug);
        if (string.IsNullOrEmpty(slug))
            return Result.Failure<AuthResponse>(Error.Validation("Tenant.InvalidSlug", "نامک نامعتبر است."));

        if (await _db.Tenants.AnyAsync(t => t.Slug == slug, ct))
            return Result.Failure<AuthResponse>(Error.Conflict("Tenant.SlugTaken", "این نامک قبلاً استفاده شده است."));

        var normalizedEmail = request.OwnerEmail.Trim().ToUpperInvariant();
        if (await _db.Users.AnyAsync(u => u.NormalizedEmail == normalizedEmail, ct))
            return Result.Failure<AuthResponse>(Error.Conflict("Auth.EmailTaken", "این ایمیل قبلاً ثبت شده است."));

        var tenant = Tenant.Create(slug, request.DisplayName, request.OwnerEmail, request.OwnerPhone, AppConstants.TrialDays);
        _db.Tenants.Add(tenant);

        var passwordHash = _hasher.Hash(request.OwnerPassword);
        var owner = User.CreateTenantUser(tenant.Id, request.OwnerEmail, request.OwnerDisplayName, passwordHash, Roles.TenantOwner);
        owner.ConfirmEmail();
        _db.Users.Add(owner);

        // Onboarding seed: default settings + branch + bay + services
        // Note: since we pre-seed all required data, we mark onboarding as complete immediately
        // so the user is not caught in a redirect loop on first login.
        var tenantSettings = SmartWash.Domain.Operations.TenantSettings.CreateDefault(tenant.Id);
        tenantSettings.AdvanceOnboarding(3);
        tenantSettings.CompleteOnboarding();
        _db.TenantSettings.Add(tenantSettings);
        var branch = Branch.Create(tenant.Id, "شعبه اصلی", null, request.OwnerPhone, isDefault: true);
        _db.Branches.Add(branch);
        _db.Bays.Add(Bay.Create(tenant.Id, branch.Id, "جایگاه ۱", 1));
        _db.Bays.Add(Bay.Create(tenant.Id, branch.Id, "جایگاه ۲", 2));
        _db.Services.Add(Service.Create(tenant.Id, "شستشوی معمولی", ServiceCategory.Main, 500_000, 30, 0.10m));
        _db.Services.Add(Service.Create(tenant.Id, "شستشوی کامل (داخل و خارج)", ServiceCategory.Main, 900_000, 60, 0.10m));
        _db.Services.Add(Service.Create(tenant.Id, "صفرشویی موتور", ServiceCategory.Engine, 600_000, 30, 0.10m));
        _db.Services.Add(Service.Create(tenant.Id, "پولیش بدنه", ServiceCategory.Polish, 2_500_000, 120, 0.15m));
        _db.Services.Add(Service.Create(tenant.Id, "نظافت داخل خودرو", ServiceCategory.Interior, 700_000, 45, 0.10m));

        var roles = new[] { Roles.TenantOwner };
        var permissions = PermissionMap.ResolvePermissions(roles);

        var access = _jwt.IssueAccessToken(new JwtIssueRequest(
            owner.Id, owner.Email, owner.DisplayName, tenant.Id, tenant.Slug, roles, permissions));

        var refresh = _jwt.IssueRefreshToken();
        var refreshExpires = DateTime.UtcNow.AddDays(AppConstants.RefreshTokenDays);
        owner.IssueRefreshToken(refresh, refreshExpires, request.IpAddress);

        await _db.SaveChangesAsync(ct);

        return new AuthResponse(
            access.Token, access.ExpiresAtUtc,
            refresh, refreshExpires,
            new AuthenticatedUserDto(owner.Id, owner.Email, owner.DisplayName, tenant.Id, tenant.Slug, roles, permissions));
    }
}
// resync-marker
