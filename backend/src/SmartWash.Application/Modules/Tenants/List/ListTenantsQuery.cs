using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Tenants.List;

public sealed record ListTenantsQuery(PageRequest Page, TenantStatus? Status) : IRequest<Result<PagedList<TenantSummaryDto>>>;

public sealed class ListTenantsQueryHandler : IRequestHandler<ListTenantsQuery, Result<PagedList<TenantSummaryDto>>>
{
    private readonly IAppDbContext _db;

    public ListTenantsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<TenantSummaryDto>>> Handle(ListTenantsQuery request, CancellationToken ct)
    {
        var query = _db.Tenants.AsNoTracking().IgnoreQueryFilters();

        if (request.Status.HasValue)
            query = query.Where(t => t.Status == request.Status.Value);

        if (!string.IsNullOrWhiteSpace(request.Page.Search))
        {
            var s = request.Page.Search.Trim().ToLower();
            query = query.Where(t => t.Slug.Contains(s) || t.DisplayName.Contains(s) || t.OwnerEmail.Contains(s));
        }

        var total = await query.CountAsync(ct);
        // به‌ازای هر مستاجر، اطلاعات اشتراک فعال (وضعیت/کد پلن/پایان دوره) را با subquery ضمیمه می‌کنیم
        // تا ستون‌های «مالک/پلن/سررسید» در لیست ادمین واقعی باشند (بدون تغییر اسکیما — فقط projection).
        var subs = _db.Subscriptions.IgnoreQueryFilters();
        var plans = _db.Plans.IgnoreQueryFilters();
        var items = await query
            .OrderByDescending(t => t.CreatedAtUtc)
            .Skip(request.Page.Skip)
            .Take(request.Page.Take)
            .Select(t => new TenantSummaryDto(
                t.Id, t.Slug, t.DisplayName, t.Status, t.TrialEndsAtUtc, t.CreatedAtUtc,
                t.OwnerEmail,
                subs.Where(s => s.Id == t.ActiveSubscriptionId).Select(s => (SubscriptionStatus?)s.Status).FirstOrDefault(),
                (from s in subs where s.Id == t.ActiveSubscriptionId
                 from p in plans where p.Id == s.PlanId
                 select p.Code).FirstOrDefault(),
                subs.Where(s => s.Id == t.ActiveSubscriptionId).Select(s => (DateTime?)s.CurrentPeriodEndUtc).FirstOrDefault()))
            .ToListAsync(ct);

        return new PagedList<TenantSummaryDto>(items, request.Page.NormalizedPage, request.Page.Take, total);
    }
}
// resync-marker
