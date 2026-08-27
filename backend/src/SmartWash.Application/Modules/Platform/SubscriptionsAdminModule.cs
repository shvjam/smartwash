using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Platform;

public sealed record AdminSubscriptionDto(Guid Id, Guid TenantId, string TenantSlug, string TenantName, Guid PlanId, string PlanName,
    BillingCycle Cycle, SubscriptionStatus Status, DateTime StartsAtUtc, DateTime CurrentPeriodStartUtc, DateTime CurrentPeriodEndUtc,
    DateTime? CancelledAtUtc, DateTime? GraceEndsAtUtc, long PriceRials, bool AutoRenew);

public sealed record ListSubscriptionsQuery(SubscriptionStatus? Status, Guid? TenantId, int Page, int PageSize) : IRequest<Result<PagedList<AdminSubscriptionDto>>>;
public sealed class ListSubscriptionsHandler : IRequestHandler<ListSubscriptionsQuery, Result<PagedList<AdminSubscriptionDto>>>
{
    private readonly IAppDbContext _db;
    public ListSubscriptionsHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<AdminSubscriptionDto>>> Handle(ListSubscriptionsQuery q, CancellationToken ct)
    {
        var qry = _db.Subscriptions.IgnoreQueryFilters().AsNoTracking().AsQueryable();
        if (q.Status.HasValue) qry = qry.Where(s => s.Status == q.Status.Value);
        if (q.TenantId.HasValue) qry = qry.Where(s => s.TenantId == q.TenantId.Value);
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 50 : q.PageSize, 1, 200);
        var total = await qry.CountAsync(ct);
        var items = await (from s in qry.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * size).Take(size)
                           join t in _db.Tenants.IgnoreQueryFilters().AsNoTracking() on s.TenantId equals t.Id
                           join p in _db.Plans.IgnoreQueryFilters().AsNoTracking() on s.PlanId equals p.Id
                           select new AdminSubscriptionDto(s.Id, t.Id, t.Slug, t.DisplayName, p.Id, p.DisplayName,
                               s.Cycle, s.Status, s.StartsAtUtc, s.CurrentPeriodStartUtc, s.CurrentPeriodEndUtc,
                               s.CancelledAtUtc, s.GraceEndsAtUtc, s.PriceRials, s.AutoRenew)).ToListAsync(ct);
        return Result.Success(new PagedList<AdminSubscriptionDto>(items, page, size, total));
    }
}

public sealed record ExtendSubscriptionCommand(Guid Id, int Days) : IRequest<Result>, ITransactionalRequest;
public sealed class ExtendSubscriptionHandler : IRequestHandler<ExtendSubscriptionCommand, Result>
{
    private readonly IAppDbContext _db;
    public ExtendSubscriptionHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(ExtendSubscriptionCommand c, CancellationToken ct)
    {
        if (c.Days <= 0) return Result.Failure(Error.Validation("Subscription.InvalidDays", "تعداد روز باید مثبت باشد."));
        var s = await _db.Subscriptions.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (s is null) return Result.Failure(Error.NotFound("Subscription.NotFound", "اشتراک یافت نشد."));
        // تمدیدِ واقعی به میزانِ Days روز (قبلاً فقط MarkActive صدا زده می‌شد و Days نادیده گرفته می‌شد).
        s.Extend(c.Days);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record SuspendTenantCommand(Guid TenantId, string Reason) : IRequest<Result>, ITransactionalRequest;
public sealed class SuspendTenantHandler : IRequestHandler<SuspendTenantCommand, Result>
{
    private readonly IAppDbContext _db;
    public SuspendTenantHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(SuspendTenantCommand c, CancellationToken ct)
    {
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == c.TenantId, ct);
        if (t is null) return Result.Failure(Error.NotFound("Tenant.NotFound", "مستاجر یافت نشد."));
        t.Suspend(c.Reason);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record ReactivateTenantCommand(Guid TenantId) : IRequest<Result>, ITransactionalRequest;
public sealed class ReactivateTenantHandler : IRequestHandler<ReactivateTenantCommand, Result>
{
    private readonly IAppDbContext _db;
    public ReactivateTenantHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(ReactivateTenantCommand c, CancellationToken ct)
    {
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == c.TenantId, ct);
        if (t is null) return Result.Failure(Error.NotFound("Tenant.NotFound", "مستاجر یافت نشد."));
        var sub = await _db.Subscriptions.IgnoreQueryFilters().Where(s => s.TenantId == c.TenantId && s.Status == SubscriptionStatus.Active).FirstOrDefaultAsync(ct);
        if (sub is null) return Result.Failure(Error.Validation("Subscription.NoneActive", "اشتراک فعالی برای این مستاجر وجود ندارد."));
        t.Activate(sub.Id);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record CancelSubscriptionAdminCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class CancelSubscriptionAdminHandler : IRequestHandler<CancelSubscriptionAdminCommand, Result>
{
    private readonly IAppDbContext _db;
    public CancelSubscriptionAdminHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(CancelSubscriptionAdminCommand c, CancellationToken ct)
    {
        var s = await _db.Subscriptions.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (s is null) return Result.Failure(Error.NotFound("Subscription.NotFound", "اشتراک یافت نشد."));
        s.Cancel();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
