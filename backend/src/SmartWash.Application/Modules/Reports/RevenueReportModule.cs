using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reports;

/// <summary>One service line of the takings, with the same figure from the period before it.</summary>
public sealed record RevenueServiceRow(
    Guid ServiceId, string ServiceName, ServiceCategory Category,
    int TimesSold, long RevenueRials,
    /// <summary>Collected by an operator rather than through the till. Part of the work, not the takings.</summary>
    long DirectToWorkerRials,
    long PreviousRevenueRials,
    /// <summary>Change against the previous period, as a percentage. Null when there is nothing to compare to.</summary>
    int? ChangePercent);

public sealed record RevenueBucketRow(string Label, DateOnly Date, long RevenueRials, int Orders);

public sealed record RevenueReport(
    // layer one — the whole
    long RevenueRials,
    long DiscountRials,
    long TipsRials,
    long DirectToWorkerRials,
    int Orders,
    long AverageOrderRials,

    // layer two — by service
    IReadOnlyList<RevenueServiceRow> Services,

    // layer three — over time
    IReadOnlyList<RevenueBucketRow> Buckets,

    // layer four — against the period before
    long PreviousRevenueRials,
    int PreviousOrders,
    int? RevenueChangePercent,
    int? OrdersChangePercent,
    DateOnly PreviousFromDate,
    DateOnly PreviousToDate);

public sealed record GetRevenueReportQuery(DateOnly FromDate, DateOnly ToDate, string Bucket)
    : IRequest<Result<RevenueReport>>;

/// <summary>
/// The takings, in the four layers the manager asked for: the total, what it was made of, how it
/// moved over the period, and how that compares with the period before.
///
/// The comparison period is the same length immediately before the one asked for, so September
/// is measured against August rather than against an arbitrary window — which is what makes
/// "eighteen percent up on last month" a sentence a manager can act on.
///
/// Money an operator took directly for an add-on is reported beside the takings but never
/// inside them. It is real work and belongs in the worker's tally, but counting it as carwash
/// revenue would inflate every financial figure with money that never reached the till.
/// </summary>
public sealed class GetRevenueReportHandler : IRequestHandler<GetRevenueReportQuery, Result<RevenueReport>>
{
    private readonly IAppDbContext _db;
    public GetRevenueReportHandler(IAppDbContext db) => _db = db;

    public async Task<Result<RevenueReport>> Handle(GetRevenueReportQuery q, CancellationToken ct)
    {
        var days = Math.Max(1, q.ToDate.DayNumber - q.FromDate.DayNumber + 1);
        var previousTo = q.FromDate.AddDays(-1);
        var previousFrom = previousTo.AddDays(-(days - 1));

        var current = await LoadAsync(q.FromDate, q.ToDate, ct);
        var previous = await LoadAsync(previousFrom, previousTo, ct);

        var previousByService = previous.Lines
            .GroupBy(l => l.ServiceId)
            .ToDictionary(g => g.Key, g => g.Where(l => !l.PaidDirectly).Sum(l => l.LineTotalRials));

        var services = current.Lines
            .GroupBy(l => new { l.ServiceId, l.ServiceName, l.Category })
            .Select(g =>
            {
                var revenue = g.Where(l => !l.PaidDirectly).Sum(l => l.LineTotalRials);
                var prior = previousByService.TryGetValue(g.Key.ServiceId, out var p) ? p : 0;
                return new RevenueServiceRow(
                    g.Key.ServiceId, g.Key.ServiceName, g.Key.Category,
                    g.Sum(l => Math.Max(1, l.Quantity)),
                    revenue,
                    g.Where(l => l.PaidDirectly).Sum(l => l.LineTotalRials),
                    prior,
                    Change(revenue, prior));
            })
            .OrderByDescending(r => r.RevenueRials)
            .ToList();

        var buckets = Bucketise(current.Orders, q.Bucket);

        var revenue = current.Orders.Sum(o => o.TotalRials);
        var priorRevenue = previous.Orders.Sum(o => o.TotalRials);

        return Result.Success(new RevenueReport(
            revenue,
            current.Orders.Sum(o => o.DiscountRials),
            current.Tips,
            current.Lines.Where(l => l.PaidDirectly).Sum(l => l.LineTotalRials),
            current.Orders.Count,
            current.Orders.Count == 0 ? 0 : revenue / current.Orders.Count,
            services,
            buckets,
            priorRevenue,
            previous.Orders.Count,
            Change(revenue, priorRevenue),
            Change(current.Orders.Count, previous.Orders.Count),
            previousFrom, previousTo));
    }

    private sealed record Slice(
        List<OrderRow> Orders,
        List<LineRow> Lines,
        long Tips);

    private sealed record OrderRow(Guid Id, DateTime CompletedAtUtc, long TotalRials, long DiscountRials);
    private sealed record LineRow(Guid ServiceId, string ServiceName, ServiceCategory Category,
        int Quantity, long LineTotalRials, bool PaidDirectly);

    private async Task<Slice> LoadAsync(DateOnly fromDate, DateOnly toDate, CancellationToken ct)
    {
        var from = fromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = toDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        // Completed orders only: an open order has not earned anything yet, and a cancelled one
        // never will.
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Completed && o.CompletedAtUtc != null
                        && o.CompletedAtUtc >= from && o.CompletedAtUtc <= to)
            .Select(o => new OrderRow(o.Id, o.CompletedAtUtc!.Value, o.TotalRials, o.DiscountRials))
            .ToListAsync(ct);

        if (orders.Count == 0) return new Slice(orders, new List<LineRow>(), 0);

        var ids = orders.Select(o => o.Id).ToList();

        var lines = await (
            from l in _db.OrderLines.AsNoTracking()
            join s in _db.Services.AsNoTracking() on l.ServiceId equals s.Id into sj
            from s in sj.DefaultIfEmpty()
            where ids.Contains(l.OrderId)
            select new LineRow(l.ServiceId, l.ServiceName,
                s != null ? s.Category : ServiceCategory.Main,
                l.Quantity, l.LineTotalRials, l.PaidDirectlyToWorker))
            .ToListAsync(ct);

        var tips = await _db.OrderLines.AsNoTracking()
            .Where(l => ids.Contains(l.OrderId))
            .SumAsync(l => l.TipRials, ct);

        return new Slice(orders, lines, tips);
    }

    private static List<RevenueBucketRow> Bucketise(List<OrderRow> orders, string bucket)
    {
        Func<DateTime, DateOnly> key = bucket?.ToLowerInvariant() switch
        {
            "month" => d => new DateOnly(d.Year, d.Month, 1),
            "week" => d => DateOnly.FromDateTime(d.AddDays(-(int)d.DayOfWeek)),
            _ => DateOnly.FromDateTime,
        };

        return orders
            .GroupBy(o => key(o.CompletedAtUtc))
            .Select(g => new RevenueBucketRow(
                g.Key.ToString("yyyy-MM-dd"), g.Key, g.Sum(o => o.TotalRials), g.Count()))
            .OrderBy(r => r.Date)
            .ToList();
    }

    /// <summary>
    /// Growth against a previous figure. Null when there was nothing before, because "up one
    /// hundred percent from zero" is a statement about arithmetic rather than about the business.
    /// </summary>
    private static int? Change(long now, long before)
        => before == 0 ? null : (int)Math.Round((now - before) * 100.0 / before);
}
