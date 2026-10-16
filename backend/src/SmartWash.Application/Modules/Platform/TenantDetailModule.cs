using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Platform;

public sealed record TenantSubscriptionHistoryDto(
    Guid Id, Guid PlanId, string PlanName, BillingCycle Cycle, SubscriptionStatus Status,
    DateTime StartsAtUtc, DateTime CurrentPeriodStartUtc, DateTime CurrentPeriodEndUtc,
    DateTime? CancelledAtUtc, DateTime? GraceEndsAtUtc, long PriceRials, bool AutoRenew, DateTime CreatedAtUtc);

public sealed record TenantInvoiceDto(
    Guid Id, string Number, InvoiceKind Kind, InvoiceStatus Status,
    DateTime IssuedAtUtc, DateTime DueAtUtc, DateTime? PaidAtUtc,
    long SubtotalRials, long TaxRials, long TotalRials);

public sealed record TenantStatsDto(
    int Branches, int Bays, int Workers, int Services, int Customers, int Orders, int Users);

public sealed record TenantDetailDto(
    Guid Id, string Slug, string DisplayName, string OwnerEmail, string? OwnerPhone,
    string? LogoUrl, string? PrimaryColor, TenantStatus Status,
    DateTime? TrialEndsAtUtc, DateTime? SuspendedAtUtc, string? SuspendReason,
    Guid? ActiveSubscriptionId, DateTime CreatedAtUtc,
    Guid? ActivePlanId, string? ActivePlanName,
    TenantStatsDto Stats,
    IReadOnlyList<TenantSubscriptionHistoryDto> Subscriptions,
    IReadOnlyList<TenantInvoiceDto> RecentInvoices);

public sealed record GetTenantDetailQuery(Guid TenantId) : IRequest<Result<TenantDetailDto>>;

public sealed class GetTenantDetailHandler : IRequestHandler<GetTenantDetailQuery, Result<TenantDetailDto>>
{
    private readonly IAppDbContext _db;
    public GetTenantDetailHandler(IAppDbContext db) => _db = db;

    public async Task<Result<TenantDetailDto>> Handle(GetTenantDetailQuery q, CancellationToken ct)
    {
        var t = await _db.Tenants.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.TenantId, ct);
        if (t is null) return Result.Failure<TenantDetailDto>(Error.NotFound("Tenant.NotFound", "مستاجر یافت نشد."));

        var subs = await (from s in _db.Subscriptions.IgnoreQueryFilters().AsNoTracking().Where(s => s.TenantId == q.TenantId)
                          join p in _db.Plans.IgnoreQueryFilters().AsNoTracking() on s.PlanId equals p.Id
                          orderby s.CreatedAtUtc descending
                          select new TenantSubscriptionHistoryDto(s.Id, p.Id, p.DisplayName, s.Cycle, s.Status,
                              s.StartsAtUtc, s.CurrentPeriodStartUtc, s.CurrentPeriodEndUtc,
                              s.CancelledAtUtc, s.GraceEndsAtUtc, s.PriceRials, s.AutoRenew, s.CreatedAtUtc))
                          .ToListAsync(ct);

        var invoices = await _db.Invoices.IgnoreQueryFilters().AsNoTracking()
            .Where(i => i.TenantId == q.TenantId)
            .OrderByDescending(i => i.IssuedAtUtc)
            .Take(20)
            .Select(i => new TenantInvoiceDto(i.Id, i.Number, i.Kind, i.Status,
                i.IssuedAtUtc, i.DueAtUtc, i.PaidAtUtc,
                i.SubtotalRials, i.TaxRials, i.TotalRials))
            .ToListAsync(ct);

        Guid? activePlanId = null;
        string? activePlanName = null;
        if (t.ActiveSubscriptionId.HasValue)
        {
            var active = subs.FirstOrDefault(s => s.Id == t.ActiveSubscriptionId.Value);
            if (active is not null) { activePlanId = active.PlanId; activePlanName = active.PlanName; }
        }

        var stats = new TenantStatsDto(
            Branches: await _db.Branches.IgnoreQueryFilters().CountAsync(x => x.TenantId == q.TenantId, ct),
            Bays: await _db.Bays.IgnoreQueryFilters().CountAsync(x => x.TenantId == q.TenantId, ct),
            Workers: await _db.Workers.IgnoreQueryFilters().CountAsync(x => x.TenantId == q.TenantId, ct),
            Services: await _db.Services.IgnoreQueryFilters().CountAsync(x => x.TenantId == q.TenantId, ct),
            Customers: await _db.Customers.IgnoreQueryFilters().CountAsync(x => x.TenantId == q.TenantId, ct),
            Orders: await _db.Orders.IgnoreQueryFilters().CountAsync(x => x.TenantId == q.TenantId, ct),
            Users: await _db.Users.IgnoreQueryFilters().CountAsync(x => x.TenantId == q.TenantId, ct));

        var dto = new TenantDetailDto(
            t.Id, t.Slug, t.DisplayName, t.OwnerEmail, t.OwnerPhone,
            t.LogoUrl, t.PrimaryColor, t.Status,
            t.TrialEndsAtUtc, t.SuspendedAtUtc, t.SuspendReason,
            t.ActiveSubscriptionId, t.CreatedAtUtc,
            activePlanId, activePlanName,
            stats, subs, invoices);

        return Result.Success(dto);
    }
}

public sealed record AssignPlanCommand(Guid TenantId, Guid PlanId, BillingCycle Cycle, bool ActivateImmediately)
    : IRequest<Result<Guid>>, ITransactionalRequest;

public sealed class AssignPlanHandler : IRequestHandler<AssignPlanCommand, Result<Guid>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantFeatureService _features;
    public AssignPlanHandler(IAppDbContext db, ITenantFeatureService features) { _db = db; _features = features; }

    public async Task<Result<Guid>> Handle(AssignPlanCommand c, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == c.TenantId, ct);
        if (tenant is null) return Result.Failure<Guid>(Error.NotFound("Tenant.NotFound", "مستاجر یافت نشد."));
        var plan = await _db.Plans.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == c.PlanId, ct);
        if (plan is null) return Result.Failure<Guid>(Error.NotFound("Plan.NotFound", "پلن یافت نشد."));

        var price = c.Cycle == BillingCycle.Yearly ? plan.YearlyPriceRials : plan.MonthlyPriceRials;
        var sub = Subscription.Create(c.TenantId, c.PlanId, c.Cycle, price);
        _db.Subscriptions.Add(sub);
        await _db.SaveChangesAsync(ct);

        if (c.ActivateImmediately)
        {
            // اشتراک‌های فعال/سررسیدگذشته‌ی قبلی باید لغو شوند تا چند اشتراکِ فعالِ هم‌زمان نداشته باشیم
            // (که daily-billing برای همه‌شان فاکتور تمدید صادر می‌کند و Reactivate اشتراکِ نامعین برمی‌دارد).
            var priorActive = await _db.Subscriptions.IgnoreQueryFilters()
                .Where(s => s.TenantId == c.TenantId && s.Id != sub.Id
                    && (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.PastDue))
                .ToListAsync(ct);
            foreach (var old in priorActive) old.Cancel();

            sub.MarkActive();
            tenant.Activate(sub.Id);
            await _db.SaveChangesAsync(ct);
            // The tenant's features are cached; without this a newly granted plan stayed
            // invisible to the carwash for up to five minutes.
            await _features.InvalidateAsync(c.TenantId, ct);
        }

        return Result.Success(sub.Id);
    }
}
// resync-marker
