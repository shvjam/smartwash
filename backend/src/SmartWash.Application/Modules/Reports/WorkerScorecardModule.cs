using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reports;

/// <summary>What one worker did most of, so a low order count can be read in context.</summary>
public sealed record WorkerServiceMixRow(Guid ServiceId, string ServiceName, int Count, int TotalMinutes);

public sealed record WorkerScorecardRow(
    Guid WorkerId,
    string FullName,
    string Role,

    // volume
    int OrdersCompleted,
    int ServicesPerformed,

    /// <summary>Distinct days the worker closed at least one order — the stand-in for attendance.</summary>
    int ActiveDays,
    /// <summary>Orders per active day, scaled by 10 so a single integer keeps one decimal place.</summary>
    int OrdersPerActiveDayX10,

    // money
    long RevenueRials,
    long CommissionRials,
    long TipsRials,
    long EarningsRials,
    /// <summary>Average value of one service this worker performed.</summary>
    long AverageServiceValueRials,

    // speed
    int AverageOrderMinutes,
    int OnTimePercent,
    int AverageOverrunMinutes,

    IReadOnlyList<WorkerServiceMixRow> ServiceMix);

/// <summary>The same measures across everyone, so each row can be read as above or below the room.</summary>
public sealed record TeamAverages(
    int OrdersCompleted,
    int ServicesPerformed,
    int ActiveDays,
    int OrdersPerActiveDayX10,
    long RevenueRials,
    long EarningsRials,
    int AverageOrderMinutes,
    int OnTimePercent);

public sealed record WorkerScorecardReport(
    int WorkerCount,
    int TotalOrders,
    TeamAverages Team,
    IReadOnlyList<WorkerScorecardRow> Workers);

public sealed record GetWorkerScorecardsQuery(DateOnly FromDate, DateOnly ToDate)
    : IRequest<Result<WorkerScorecardReport>>;

/// <summary>
/// One row per worker with everything a manager needs to compare them, and the team average
/// beside it so a number means something without arithmetic.
///
/// The question this exists to answer is "why did this person wash fewer cars this month",
/// which a bare order count cannot settle. Three readings are separated so the answer is
/// visible rather than guessed at:
///
///   fewer days worked      -> ActiveDays is low, orders per active day is normal
///   slower on each car     -> AverageOrderMinutes and overrun are high
///   different work         -> ServiceMix is weighted to the long jobs
///
/// A detailer who does three ninety-minute jobs is not underperforming next to someone who
/// does nine quick washes, and a report that only counted cars would say otherwise.
///
/// ActiveDays counts days the worker closed at least one order, because the system has no
/// attendance record: shifts belong to the cash register, not to people. Someone present all
/// day with no completed work is invisible to it, so it measures days worked rather than days
/// attended, and the screen says so.
/// </summary>
public sealed class GetWorkerScorecardsHandler
    : IRequestHandler<GetWorkerScorecardsQuery, Result<WorkerScorecardReport>>
{
    private readonly IAppDbContext _db;
    public GetWorkerScorecardsHandler(IAppDbContext db) => _db = db;

    public async Task<Result<WorkerScorecardReport>> Handle(GetWorkerScorecardsQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Completed
                        && o.CompletedAtUtc != null
                        && o.StartedAtUtc >= from && o.StartedAtUtc <= to)
            .Select(o => new { o.Id, o.ExpectedDurationMinutes, o.StartedAtUtc, o.CompletedAtUtc })
            .ToListAsync(ct);

        var orderInfo = orders.ToDictionary(o => o.Id, o => (
            Estimated: o.ExpectedDurationMinutes,
            Actual: Math.Max(0, (int)Math.Round((o.CompletedAtUtc!.Value - o.StartedAtUtc).TotalMinutes)),
            Day: DateOnly.FromDateTime(o.StartedAtUtc)));

        var orderIds = orderInfo.Keys.ToList();

        var lines = await _db.OrderLines.AsNoTracking()
            .Where(l => orderIds.Contains(l.OrderId) && l.WorkerId != null)
            .Select(l => new
            {
                l.OrderId, l.WorkerId, l.WorkerName, l.ServiceId, l.ServiceName,
                l.LineTotalRials, l.WorkerCommissionRials, l.TipRials,
                l.DurationMinutes, l.Quantity,
            })
            .ToListAsync(ct);

        // Role is not copied onto the line, so it comes from the worker record.
        var roles = await _db.Workers.AsNoTracking()
            .Select(w => new { w.Id, w.Role })
            .ToDictionaryAsync(w => w.Id, w => w.Role, ct);

        static int Percent(int part, int whole) => whole == 0 ? 0 : (int)Math.Round(part * 100.0 / whole);

        var rows = lines
            .GroupBy(l => new { WorkerId = l.WorkerId!.Value, l.WorkerName })
            .Select(g =>
            {
                var theirOrderIds = g.Select(l => l.OrderId).Distinct().ToList();
                var theirOrders = theirOrderIds.Select(id => orderInfo[id]).ToList();
                var late = theirOrders.Where(o => o.Actual > o.Estimated).ToList();
                var activeDays = theirOrders.Select(o => o.Day).Distinct().Count();
                var services = g.Sum(l => Math.Max(1, l.Quantity));
                var revenue = g.Sum(l => l.LineTotalRials);
                var commission = g.Sum(l => l.WorkerCommissionRials);
                var tips = g.Sum(l => l.TipRials);

                var mix = g
                    .GroupBy(l => new { l.ServiceId, l.ServiceName })
                    .Select(sg => new WorkerServiceMixRow(
                        sg.Key.ServiceId,
                        sg.Key.ServiceName,
                        sg.Sum(l => Math.Max(1, l.Quantity)),
                        sg.Sum(l => l.DurationMinutes * Math.Max(1, l.Quantity))))
                    .OrderByDescending(m => m.Count)
                    .ToList();

                return new WorkerScorecardRow(
                    g.Key.WorkerId,
                    g.Key.WorkerName ?? "",
                    roles.TryGetValue(g.Key.WorkerId, out var role) ? role : "",
                    theirOrders.Count,
                    services,
                    activeDays,
                    activeDays == 0 ? 0 : (int)Math.Round(theirOrders.Count * 10.0 / activeDays),
                    revenue,
                    commission,
                    tips,
                    commission + tips,
                    services == 0 ? 0 : revenue / services,
                    theirOrders.Count == 0 ? 0 : (int)Math.Round(theirOrders.Average(o => (double)o.Actual)),
                    Percent(theirOrders.Count - late.Count, theirOrders.Count),
                    late.Count == 0 ? 0 : (int)Math.Round(late.Average(o => (double)(o.Actual - o.Estimated))),
                    mix);
            })
            .OrderByDescending(r => r.OrdersCompleted)
            .ToList();

        if (rows.Count == 0)
        {
            return Result.Success(new WorkerScorecardReport(
                0, orderInfo.Count,
                new TeamAverages(0, 0, 0, 0, 0, 0, 0, 0),
                Array.Empty<WorkerScorecardRow>()));
        }

        var team = new TeamAverages(
            (int)Math.Round(rows.Average(r => (double)r.OrdersCompleted)),
            (int)Math.Round(rows.Average(r => (double)r.ServicesPerformed)),
            (int)Math.Round(rows.Average(r => (double)r.ActiveDays)),
            (int)Math.Round(rows.Average(r => (double)r.OrdersPerActiveDayX10)),
            (long)Math.Round(rows.Average(r => (double)r.RevenueRials)),
            (long)Math.Round(rows.Average(r => (double)r.EarningsRials)),
            (int)Math.Round(rows.Average(r => (double)r.AverageOrderMinutes)),
            (int)Math.Round(rows.Average(r => (double)r.OnTimePercent)));

        return Result.Success(new WorkerScorecardReport(rows.Count, orderInfo.Count, team, rows));
    }
}
