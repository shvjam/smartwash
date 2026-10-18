using SmartWash.Application.Abstractions.Caching;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Identity;
using SmartWash.Shared.Constants;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Users;

public sealed record TenantUserDto(Guid Id, string Email, string DisplayName, string? Phone, bool IsActive,
    bool EmailConfirmed, DateTime? LastLoginAtUtc, IReadOnlyList<string> Roles, DateTime CreatedAtUtc);

public sealed record ListTenantUsersQuery : IRequest<Result<IReadOnlyList<TenantUserDto>>>;
public sealed class ListTenantUsersHandler : IRequestHandler<ListTenantUsersQuery, Result<IReadOnlyList<TenantUserDto>>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public ListTenantUsersHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result<IReadOnlyList<TenantUserDto>>> Handle(ListTenantUsersQuery q, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure<IReadOnlyList<TenantUserDto>>(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        var tenantId = _tenant.TenantId.Value;
        var userIds = await _db.UserRoles.AsNoTracking().Where(r => r.TenantId == tenantId).Select(r => r.UserId).Distinct().ToListAsync(ct);
        var users = await _db.Users.AsNoTracking().Include(u => u.Roles).Where(u => userIds.Contains(u.Id)).ToListAsync(ct);
        return Result.Success<IReadOnlyList<TenantUserDto>>(users.Select(u => new TenantUserDto(
            u.Id, u.Email, u.DisplayName, u.Phone, u.IsActive, u.EmailConfirmed, u.LastLoginAtUtc,
            u.Roles.Where(r => r.TenantId == tenantId).Select(r => r.Role).ToArray(), u.CreatedAtUtc)).ToArray());
    }
}

public sealed record InviteUserCommand(string Email, string DisplayName, string? Phone, string Password, string Role)
    : IRequest<Result<TenantUserDto>>, ITransactionalRequest;
public sealed class InviteUserValidator : AbstractValidator<InviteUserCommand>
{
    public InviteUserValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(128);
        RuleFor(x => x.Role).NotEmpty().Must(r => Roles.AllTenantRoles.Contains(r)).WithMessage("نقش معتبر نیست.");
    }
}
public sealed class InviteUserHandler : IRequestHandler<InviteUserCommand, Result<TenantUserDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IPasswordHasher _hasher;
    private readonly ITenantFeatureService _features;
    public InviteUserHandler(IAppDbContext db, ITenantContext tenant, IPasswordHasher hasher, ITenantFeatureService features)
    { _db = db; _tenant = tenant; _hasher = hasher; _features = features; }
    public async Task<Result<TenantUserDto>> Handle(InviteUserCommand c, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure<TenantUserDto>(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        var normalized = c.Email.Trim().ToUpperInvariant();
        if (await _db.Users.AnyAsync(u => u.NormalizedEmail == normalized, ct))
            return Result.Failure<TenantUserDto>(Error.Conflict("User.EmailTaken", "این ایمیل قبلاً ثبت شده است."));
        var limit = await _features.GetLimitAsync("max_users", ct);
        if (limit.HasValue)
        {
            var tid = _tenant.TenantId.Value;
            var count = await _db.UserRoles.Where(r => r.TenantId == tid).Select(r => r.UserId).Distinct().CountAsync(ct);
            if (count >= limit.Value)
                return Result.Failure<TenantUserDto>(Error.Conflict("Quota.Exceeded", $"سقف تعداد کاربران پلن ({limit.Value}) پر شده است."));
        }

        var user = User.CreateTenantUser(_tenant.TenantId.Value, c.Email, c.DisplayName, _hasher.Hash(c.Password), c.Role);
        if (!string.IsNullOrEmpty(c.Phone)) user.UpdateProfile(c.DisplayName, c.Phone, null);
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        return new TenantUserDto(user.Id, user.Email, user.DisplayName, user.Phone, user.IsActive, user.EmailConfirmed, null, new[] { c.Role }, user.CreatedAtUtc);
    }
}

public sealed record AssignRoleCommand(Guid UserId, string Role) : IRequest<Result>, ITransactionalRequest;
public sealed class AssignRoleHandler : IRequestHandler<AssignRoleCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public AssignRoleHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result> Handle(AssignRoleCommand c, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        if (!Roles.AllTenantRoles.Contains(c.Role)) return Result.Failure(Error.Validation("Role.Invalid", "نقش معتبر نیست."));
        var u = await _db.Users.Include(x => x.Roles).FirstOrDefaultAsync(x => x.Id == c.UserId, ct);
        if (u is null) return Result.Failure(Error.NotFound("User.NotFound", "کاربر یافت نشد."));
        // هدف باید عضو همین مستاجر باشد؛ در غیر این‌صورت مدیرِ یک مجموعه می‌تواند کاربرِ مجموعه‌ای دیگر را دستکاری کند (IDOR بین‌مستاجری).
        var tidA = _tenant.TenantId.Value;
        if (u.TenantId != tidA && !u.Roles.Any(r => r.TenantId == tidA))
            return Result.Failure(Error.Forbidden("User.NotInTenant", "این کاربر عضو این مجموعه نیست."));
        u.AssignRole(_tenant.TenantId.Value, c.Role);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record RemoveRoleCommand(Guid UserId, string Role) : IRequest<Result>, ITransactionalRequest;
public sealed class RemoveRoleHandler : IRequestHandler<RemoveRoleCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public RemoveRoleHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result> Handle(RemoveRoleCommand c, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        var u = await _db.Users.Include(x => x.Roles).FirstOrDefaultAsync(x => x.Id == c.UserId, ct);
        if (u is null) return Result.Failure(Error.NotFound("User.NotFound", "کاربر یافت نشد."));
        var tidR = _tenant.TenantId.Value;
        if (u.TenantId != tidR && !u.Roles.Any(r => r.TenantId == tidR))
            return Result.Failure(Error.Forbidden("User.NotInTenant", "این کاربر عضو این مجموعه نیست."));
        u.RemoveRole(_tenant.TenantId.Value, c.Role);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record SetUserActiveCommand(Guid UserId, bool IsActive) : IRequest<Result>, ITransactionalRequest;
public sealed class SetUserActiveHandler : IRequestHandler<SetUserActiveCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IAppCache _cache;
    public SetUserActiveHandler(IAppDbContext db, ITenantContext tenant, IAppCache cache)
    { _db = db; _tenant = tenant; _cache = cache; }
    public async Task<Result> Handle(SetUserActiveCommand c, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        var u = await _db.Users.Include(x => x.Roles).FirstOrDefaultAsync(x => x.Id == c.UserId, ct);
        if (u is null) return Result.Failure(Error.NotFound("User.NotFound", "کاربر یافت نشد."));
        // فقط کاربرانِ عضوِ همین مستاجر؛ جلوگیری از فعال/غیرفعال‌سازیِ کاربرِ مستاجرِ دیگر یا اونرِ پلتفرم (IDOR).
        var tid = _tenant.TenantId.Value;
        if (u.TenantId != tid && !u.Roles.Any(r => r.TenantId == tid))
            return Result.Failure(Error.Forbidden("User.NotInTenant", "این کاربر عضو این مجموعه نیست."));
        if (c.IsActive) u.Activate(); else u.Deactivate();
        await _db.SaveChangesAsync(ct);
        // The request pipeline caches this flag, so switching someone off has to clear it or
        // they keep working for as long as the cached answer lives.
        await _cache.RemoveAsync(CacheKeys.UserActive(u.Id), ct);
        return Result.Success();
    }
}

public sealed record AdminResetPasswordCommand(Guid UserId, string NewPassword) : IRequest<Result>, ITransactionalRequest;
public sealed class AdminResetPasswordValidator : AbstractValidator<AdminResetPasswordCommand>
{
    public AdminResetPasswordValidator() { RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).MaximumLength(128); }
}
public sealed class AdminResetPasswordHandler : IRequestHandler<AdminResetPasswordCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly ITenantContext _tenant;
    public AdminResetPasswordHandler(IAppDbContext db, IPasswordHasher hasher, ITenantContext tenant) { _db = db; _hasher = hasher; _tenant = tenant; }
    public async Task<Result> Handle(AdminResetPasswordCommand c, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        var u = await _db.Users.Include(x => x.Roles).FirstOrDefaultAsync(x => x.Id == c.UserId, ct);
        if (u is null) return Result.Failure(Error.NotFound("User.NotFound", "کاربر یافت نشد."));
        // بازنشانی گذرواژه فقط برای کاربرانِ عضوِ همین مستاجر؛ جلوگیری از تصاحبِ حسابِ کاربرانِ دیگر مستاجرها/پلتفرم (IDOR بحرانی).
        var tid = _tenant.TenantId.Value;
        if (u.TenantId != tid && !u.Roles.Any(r => r.TenantId == tid))
            return Result.Failure(Error.Forbidden("User.NotInTenant", "این کاربر عضو این مجموعه نیست."));
        u.UpdatePassword(_hasher.Hash(c.NewPassword));
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record ChangeMyPasswordCommand(string CurrentPassword, string NewPassword) : IRequest<Result>, ITransactionalRequest;
public sealed class ChangeMyPasswordValidator : AbstractValidator<ChangeMyPasswordCommand>
{
    public ChangeMyPasswordValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).MaximumLength(128);
    }
}
public sealed class ChangeMyPasswordHandler : IRequestHandler<ChangeMyPasswordCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly ICurrentUser _current;
    public ChangeMyPasswordHandler(IAppDbContext db, IPasswordHasher hasher, ICurrentUser current)
    { _db = db; _hasher = hasher; _current = current; }
    public async Task<Result> Handle(ChangeMyPasswordCommand c, CancellationToken ct)
    {
        if (!_current.UserId.HasValue) return Result.Failure(Error.Unauthorized("Auth.NoUser", "کاربر شناسایی نشد."));
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == _current.UserId.Value, ct);
        if (u is null) return Result.Failure(Error.NotFound("User.NotFound", "کاربر یافت نشد."));
        if (!_hasher.Verify(c.CurrentPassword, u.PasswordHash))
            return Result.Failure(Error.Unauthorized("Auth.BadPassword", "گذرواژه فعلی نادرست است."));
        u.UpdatePassword(_hasher.Hash(c.NewPassword));
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
