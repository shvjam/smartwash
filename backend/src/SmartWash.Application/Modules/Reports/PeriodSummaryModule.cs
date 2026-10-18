using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reports;

public sealed record PeriodDayRow(DateOnly Date, long RevenueRials, long TipsRials, int Orders);

public sealed record PeriodWorkerRow(Guid WorkerId, string FullName, string? AvatarUrl,
    long RevenueRials, long TipsRials, int Orders, int Services);

public sealed record PeriodServiceRow(Guid ServiceId, string ServiceName, int Count, long RevenueRials);

public sealed record PeriodCustomerRow(Guid CustomerId, string FullName, string Phone, string? Plate,
    long RevenueRials, int Orders, int Services, int TotalVisits, long LifetimeSpendRials,
    int FreeServicesEarned, int FreeServicesUsed);

public sealed record PeriodSummary(
    long RevenueRials, long TipsRials, long DiscountRials, int Orders, int Services,
    IReadOnlyList<PeriodDayRow> Days,
    IReadOnlyList<PeriodWorkerRow> Workers,
    IReadOnlyList<PeriodServiceRow> ServiceRows,
    IReadOnlyList<PeriodCustomerRow> Customers);

public sealed record GetPeriodSummaryQuery(DateOnly FromDate, DateOnly ToDate, Guid? BranchId)
    : IRequest<Result<PeriodSummary>>;

/// <summary>
/// The period at a glance — by day, by worker, by service, by customer — computed from every
/// completed order in it.
///
/// The reports page used to build these tables in the browser from the orders it already held,
/// and it holds the two hundred most recent. A carwash washing fifty cars a day passes that in
/// four days, so a chart titled "monthly revenue" was showing the last four days, and the worker,
/// service and customer tables were ranking people on less than a week while saying nine months.
/// Nothing looked wrong; the numbers were just small.
///
/// The definitions match the revenue report's so the tabs agree with each other: completed
/// orders only, dated by completion, revenue as the order total (which carries neither tips nor
/// wallet spend), tips counted separately from the lines they were left on.
/// </summary>
public sealed class GetPeriodSummaryHandler : IRequestHandler<GetPeriodSummaryQuery, Result<PeriodSummary>>
{
    private const int CustomerRows = 100;
    private readonly IAppDbContext _db;
    public GetPeriodSummaryHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PeriodSummary>> Handle(GetPeriodSummaryQuery q, CancellationToken ct)
    {
        if (q.ToDate < q.FromDate)
            return Result.Failure<PeriodSummary>(Error.Validation("Report.InvalidRange", "تاریخ پایان نباید پیش از تاریخ شروع باشد."));

        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var ordersQuery = _db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Completed && o.CompletedAtUtc != null
                        && o.CompletedAtUtc >= from && o.CompletedAtUtc <= to);
        if (q.BranchId.HasValue) ordersQuery = ordersQuery.Where(o => o.BranchId == q.BranchId.Value);

        var orders = await ordersQuery
            .Select(o => new { o.Id, o.CompletedAtUtc, o.TotalRials, o.DiscountRials, o.CustomerId, o.VehiclePlate })
            .ToListAsync(ct);

        if (orders.Count == 0)
            return Result.Success(new PeriodSummary(0, 0, 0, 0, 0, [], [], [], []));

        var ids = orders.Select(o => o.Id).ToList();
        var lines = await _db.OrderLines.AsNoTracking()
            .Where(l => ids.Contains(l.OrderId))
            .Select(l => new { l.OrderId, l.ServiceId, l.ServiceName, l.Quantity, l.LineTotalRials, l.WorkerId, l.TipRials })
            .ToListAsync(ct);
        var linesByOrder = lines.GroupBy(l => l.OrderId).ToDictionary(g => g.Key, g => g.ToList());
        long TipsOf(Guid orderId) => linesByOrder.TryGetValue(orderId, out var ls) ? ls.Sum(l => l.TipRials) : 0;
        int ServicesOf(Guid orderId) => linesByOrder.TryGetValue(orderId, out var ls) ? ls.Count : 0;

        var days = orders
            .GroupBy(o => DateOnly.FromDateTime(o.CompletedAtUtc!.Value))
            .Select(g => new PeriodDayRow(g.Key, g.Sum(o => o.TotalRials), g.Sum(o => TipsOf(o.Id)), g.Count()))
            .OrderBy(d => d.Date)
            .ToList();

        var services = lines
            .GroupBy(l => new { l.ServiceId, l.ServiceName })
            .Select(g => new PeriodServiceRow(g.Key.ServiceId, g.Key.ServiceName,
                g.Sum(l => Math.Max(1, l.Quantity)), g.Sum(l => l.LineTotalRials)))
            .OrderByDescending(s => s.RevenueRials)
            .ToList();

        var workerLines = lines.Where(l => l.WorkerId.HasValue).ToList();
        var workerIds = workerLines.Select(l => l.WorkerId!.Value).Distinct().ToList();
        var workerInfo = await _db.Workers.AsNoTracking()
            .Where(w => workerIds.Contains(w.Id))
            .Select(w => new { w.Id, w.FullName, w.AvatarUrl })
            .ToDictionaryAsync(w => w.Id, ct);
        var workers = workerLines
            .GroupBy(l => l.WorkerId!.Value)
            .Select(g => new PeriodWorkerRow(
                g.Key,
                workerInfo.TryGetValue(g.Key, out var w) ? w.FullName : "پرسنل حذف‌شده",
                workerInfo.TryGetValue(g.Key, out var w2) ? w2.AvatarUrl : null,
                g.Sum(l => l.LineTotalRials),
                g.Sum(l => l.TipRials),
                g.Select(l => l.OrderId).Distinct().Count(),
                g.Count()))
            .OrderByDescending(r => r.RevenueRials)
            .ToList();

        var byCustomer = orders
            .Where(o => o.CustomerId.HasValue)
            .GroupBy(o => o.CustomerId!.Value)
            .Select(g => new
            {
                CustomerId = g.Key,
                Revenue = g.Sum(o => o.TotalRials),
                Orders = g.Count(),
                Services = g.Sum(o => ServicesOf(o.Id)),
                Plate = g.OrderByDescending(o => o.CompletedAtUtc).First().VehiclePlate,
            })
            .OrderByDescending(c => c.Revenue)
            .Take(CustomerRows)
            .ToList();
        var customerIds = byCustomer.Select(c => c.CustomerId).ToList();
        var customerInfo = await _db.Customers.AsNoTracking()
            .Where(c => customerIds.Contains(c.Id))
            .Select(c => new { c.Id, c.FullName, c.Phone, c.TotalVisits, c.LifetimeSpendRials, c.FreeServicesUsed })
            .ToDictionaryAsync(c => c.Id, ct);
        var customers = byCustomer
            .Where(c => customerInfo.ContainsKey(c.CustomerId))
            .Select(c =>
            {
                var info = customerInfo[c.CustomerId];
                return new PeriodCustomerRow(c.CustomerId, info.FullName, info.Phone, c.Plate,
                    c.Revenue, c.Orders, c.Services, info.TotalVisits, info.LifetimeSpendRials,
                    // Same rule as Customer.EarnedFreeServices: one free wash per three visits.
                    info.TotalVisits / 3, info.FreeServicesUsed);
            })
            .ToList();

        return Result.Success(new PeriodSummary(
            orders.Sum(o => o.TotalRials),
            lines.Sum(l => l.TipRials),
            orders.Sum(o => o.DiscountRials),
            orders.Count,
            lines.Count,
            days, workers, services, customers));
    }
}
