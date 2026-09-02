using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reports;

/// <summary>How one service's estimate compares with how long the work actually takes.</summary>
public sealed record ServicePunctualityRow(
    Guid ServiceId,
    string ServiceName,
    int TimesPerformed,
    int EstimatedMinutes,
    int AverageActualMinutes,
    int OnTimeCount,
    int LateCount,
    /// <summary>Share of runs finished within the estimate, 0–100.</summary>
    int OnTimePercent,
    /// <summary>Average minutes over the estimate, counting only the late runs. Negative is impossible here.</summary>
    int AverageOverrunMinutes);

/// <summary>How punctual one worker is, across the orders they worked on.</summary>
public sealed record WorkerPunctualityRow(
    Guid WorkerId,
    string FullName,
    int OrderCount,
    int OnTimeCount,
    int OnTimePercent,
    int AverageActualMinutes,
    int AverageOverrunMinutes);

public sealed record PunctualityReport(
    int CompletedOrders,
    int OnTimeOrders,
    int OnTimePercent,
    int AverageEstimatedMinutes,
    int AverageActualMinutes,
    IReadOnlyList<ServicePunctualityRow> Services,
    IReadOnlyList<WorkerPunctualityRow> Workers);

public sealed record GetPunctualityQuery(DateOnly FromDate, DateOnly ToDate)
    : IRequest<Result<PunctualityReport>>;

/// <summary>
/// Turns the per-service duration estimate into something that can be acted on.
///
/// The estimate was only ever used to raise an "order is overdue" notification, so nobody could
/// see whether the estimates themselves were any good, or which jobs habitually run long. Both
/// questions are answerable from data already recorded: an order carries the summed estimate of
/// its lines, and the gap between StartedAtUtc and CompletedAtUtc is what actually happened.
///
/// One honest caveat, which the screen repeats: actual time is measured from the car entering
/// the bay to the order being closed, so it includes waiting and payment, not just labour. It
/// is the same clock the overdue notification already runs on, so comparing the two is fair —
/// but it is a measure of how long the customer waited, not of how fast someone scrubbed.
///
/// Deliberately no scoring, bonus or penalty is computed here. Whether finishing early earns
/// anything is a management decision with real consequences for people's pay, and the right
/// thing for software to do is put the numbers in front of the owner, not invent the policy.
/// </summary>
public sealed class GetPunctualityHandler : IRequestHandler<GetPunctualityQuery, Result<PunctualityReport>>
{
    private readonly IAppDbContext _db;
    public GetPunctualityHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PunctualityReport>> Handle(GetPunctualityQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Completed
                        && o.CompletedAtUtc != null
                        && o.StartedAtUtc >= from && o.StartedAtUtc <= to
                        && o.ExpectedDurationMinutes > 0)
            // The subtraction happens in memory rather than in SQL: DateDiff is provider
            // specific and this layer stays free of the database engine it happens to run on.
            .Select(o => new { o.Id, o.ExpectedDurationMinutes, o.StartedAtUtc, o.CompletedAtUtc })
            .ToListAsync(ct);

        if (orders.Count == 0)
            return Result.Success(new PunctualityReport(0, 0, 0, 0, 0,
                Array.Empty<ServicePunctualityRow>(), Array.Empty<WorkerPunctualityRow>()));

        // An order finished in negative time means the clock moved or a row was edited by hand;
        // clamping keeps one bad row from dragging an average somewhere impossible.
        var byOrder = orders.ToDictionary(o => o.Id, o => (
            Estimated: o.ExpectedDurationMinutes,
            Actual: Math.Max(0, (int)Math.Round((o.CompletedAtUtc!.Value - o.StartedAtUtc).TotalMinutes))));

        var orderIds = byOrder.Keys.ToList();

        var lines = await _db.OrderLines.AsNoTracking()
            .Where(l => orderIds.Contains(l.OrderId))
            .Select(l => new { l.OrderId, l.ServiceId, l.ServiceName, l.WorkerId, l.WorkerName, l.DurationMinutes, l.Quantity })
            .ToListAsync(ct);

        static int Percent(int part, int whole) => whole == 0 ? 0 : (int)Math.Round(part * 100.0 / whole);

        var onTime = byOrder.Values.Count(v => v.Actual <= v.Estimated);

        // Per service: the order's own estimate is not comparable when several services share
        // the bay, so each line is measured against its own share of the order's actual time,
        // split in proportion to the minutes it was expected to take.
        var services = lines
            .GroupBy(l => new { l.ServiceId, l.ServiceName })
            .Select(g =>
            {
                var runs = g.Select(l =>
                {
                    var order = byOrder[l.OrderId];
                    var lineEstimate = l.DurationMinutes * Math.Max(1, l.Quantity);
                    var share = order.Estimated == 0 ? 1.0 : (double)lineEstimate / order.Estimated;
                    return (Estimate: lineEstimate, Actual: (int)Math.Round(order.Actual * share));
                }).ToList();

                var late = runs.Where(r => r.Actual > r.Estimate).ToList();
                return new ServicePunctualityRow(
                    g.Key.ServiceId,
                    g.Key.ServiceName,
                    runs.Count,
                    (int)Math.Round(runs.Average(r => (double)r.Estimate)),
                    (int)Math.Round(runs.Average(r => (double)r.Actual)),
                    runs.Count - late.Count,
                    late.Count,
                    Percent(runs.Count - late.Count, runs.Count),
                    late.Count == 0 ? 0 : (int)Math.Round(late.Average(r => (double)(r.Actual - r.Estimate))));
            })
            .OrderBy(r => r.OnTimePercent)
            .ToList();

        // Per worker: an order counts once for each person who had a line on it. A car worked on
        // by two people counts for both, because both shared the same clock.
        var workers = lines
            .Where(l => l.WorkerId.HasValue)
            .GroupBy(l => new { WorkerId = l.WorkerId!.Value, l.WorkerName })
            .Select(g =>
            {
                var theirOrders = g.Select(l => l.OrderId).Distinct().Select(id => byOrder[id]).ToList();
                var lateOnes = theirOrders.Where(o => o.Actual > o.Estimated).ToList();
                return new WorkerPunctualityRow(
                    g.Key.WorkerId,
                    g.Key.WorkerName ?? "",
                    theirOrders.Count,
                    theirOrders.Count - lateOnes.Count,
                    Percent(theirOrders.Count - lateOnes.Count, theirOrders.Count),
                    (int)Math.Round(theirOrders.Average(o => (double)o.Actual)),
                    lateOnes.Count == 0 ? 0 : (int)Math.Round(lateOnes.Average(o => (double)(o.Actual - o.Estimated))));
            })
            .OrderByDescending(r => r.OnTimePercent)
            .ToList();

        return Result.Success(new PunctualityReport(
            byOrder.Count,
            onTime,
            Percent(onTime, byOrder.Count),
            (int)Math.Round(byOrder.Values.Average(v => (double)v.Estimated)),
            (int)Math.Round(byOrder.Values.Average(v => (double)v.Actual)),
            services,
            workers));
    }
}
