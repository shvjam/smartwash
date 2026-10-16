using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reports;

// ═════════════════════════════ bay performance ══════════════════════════════

public sealed record BayDowntimeRow(BayDowntimeReason Reason, string ReasonLabel, int Minutes, int Occurrences);

public sealed record BayPerformanceRow(
    Guid BayId, string Name, int Number, BayType Type, bool IsActive,
    int CarsServed,
    int BusyMinutes,
    int DownMinutes,
    /// <summary>Minutes in the period the bay could have worked — the window, less downtime.</summary>
    int AvailableMinutes,
    /// <summary>Share of available time the bay was actually working, 0–100.</summary>
    int UtilisationPercent,
    int AverageMinutesPerCar,
    IReadOnlyList<BayDowntimeRow> Downtime);

public sealed record BayPerformanceReport(
    int WindowMinutes,
    IReadOnlyList<BayPerformanceRow> Bays,
    int TotalCarsServed,
    int TotalDownMinutes);

public sealed record GetBayPerformanceQuery(DateOnly FromDate, DateOnly ToDate)
    : IRequest<Result<BayPerformanceReport>>;

/// <summary>
/// What each bay did, and what it did not do because it could not.
///
/// A bay standing empty looks the same on the board whatever the cause, and the manager was
/// explicit that the difference matters: a bay closed for repairs is a maintenance problem, one
/// closed for lack of anyone to staff it is a rota problem, and they call for opposite
/// responses. Downtime is recorded with its reason at the moment it starts, so the two can be
/// told apart afterwards.
///
/// Utilisation is measured against time the bay could have worked rather than against the whole
/// window, otherwise a bay that was broken for three days would look idle rather than unavailable
/// — and the manager would go looking for a lazy crew instead of a repair invoice.
/// </summary>
public sealed class GetBayPerformanceHandler : IRequestHandler<GetBayPerformanceQuery, Result<BayPerformanceReport>>
{
    private readonly IAppDbContext _db;
    public GetBayPerformanceHandler(IAppDbContext db) => _db = db;

    public async Task<Result<BayPerformanceReport>> Handle(GetBayPerformanceQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
        var windowMinutes = Math.Max(1, (int)Math.Round((to - from).TotalMinutes));

        var bays = await _db.Bays.AsNoTracking()
            .OrderBy(b => b.Number)
            .Select(b => new { b.Id, b.Name, b.Number, b.Type, b.IsActive })
            .ToListAsync(ct);

        if (bays.Count == 0)
            return Result.Success(new BayPerformanceReport(windowMinutes, Array.Empty<BayPerformanceRow>(), 0, 0));

        var visits = await _db.OrderBayVisits.AsNoTracking()
            .Where(v => v.EnteredAtUtc >= from && v.EnteredAtUtc <= to)
            .Select(v => new { v.BayId, v.OrderId, v.EnteredAtUtc, v.LeftAtUtc })
            .ToListAsync(ct);

        // A downtime that began before the window or runs past its end still costs time inside
        // it, so each period is clipped to the window rather than counted or dropped whole.
        var downtimes = await _db.BayDowntimes.AsNoTracking()
            .Where(d => d.FromUtc <= to && (d.ToUtc == null || d.ToUtc >= from))
            .Select(d => new { d.BayId, d.Reason, d.FromUtc, d.ToUtc })
            .ToListAsync(ct);

        var rows = bays.Select(b =>
        {
            var mine = visits.Where(v => v.BayId == b.Id).ToList();
            var busy = mine.Sum(v =>
            {
                var end = v.LeftAtUtc ?? to;
                return Math.Max(0, (int)Math.Round((Min(end, to) - Max(v.EnteredAtUtc, from)).TotalMinutes));
            });

            var myDown = downtimes.Where(d => d.BayId == b.Id).ToList();
            var downRows = myDown
                .GroupBy(d => d.Reason)
                .Select(g => new BayDowntimeRow(
                    g.Key, ReasonLabel(g.Key),
                    g.Sum(d => ClippedMinutes(d.FromUtc, d.ToUtc, from, to)),
                    g.Count()))
                .OrderByDescending(r => r.Minutes)
                .ToList();

            var down = downRows.Sum(r => r.Minutes);
            var available = Math.Max(0, windowMinutes - down);
            var cars = mine.Select(v => v.OrderId).Distinct().Count();

            return new BayPerformanceRow(
                b.Id, b.Name, b.Number, b.Type, b.IsActive,
                cars, busy, down, available,
                available == 0 ? 0 : (int)Math.Round(Math.Min(100.0, busy * 100.0 / available)),
                cars == 0 ? 0 : (int)Math.Round((double)busy / cars),
                downRows);
        })
        .ToList();

        return Result.Success(new BayPerformanceReport(
            windowMinutes, rows, rows.Sum(r => r.CarsServed), rows.Sum(r => r.DownMinutes)));
    }

    private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;
    private static DateTime Max(DateTime a, DateTime b) => a > b ? a : b;

    private static int ClippedMinutes(DateTime start, DateTime? end, DateTime from, DateTime to)
    {
        var s = start < from ? from : start;
        var e = (end ?? to) > to ? to : (end ?? to);
        return e <= s ? 0 : (int)Math.Round((e - s).TotalMinutes);
    }

    private static string ReasonLabel(BayDowntimeReason r) => r switch
    {
        BayDowntimeReason.Maintenance => "تعمیرات",
        BayDowntimeReason.NoStaff => "نبود نیروی انسانی",
        BayDowntimeReason.ManagementDecision => "تصمیم مدیریتی",
        _ => "سایر",
    };
}

// ═══════════════════════════ waiting and bottleneck ══════════════════════════

public sealed record StageWaitRow(
    OrderStage Stage, string Label,
    int CarsCounted,
    int AverageMinutes,
    int LongestMinutes);

public sealed record WaitingReport(
    int CarsCounted,
    int AverageTotalMinutes,
    IReadOnlyList<StageWaitRow> Stages,
    /// <summary>The stage cars spend longest in — where the site is actually held up.</summary>
    OrderStage? BottleneckStage,
    string? BottleneckLabel,
    int BottleneckMinutes);

public sealed record GetWaitingReportQuery(DateOnly FromDate, DateOnly ToDate)
    : IRequest<Result<WaitingReport>>;

/// <summary>
/// How long cars spend at each step, and which step is the slow one.
///
/// This is the report the whole stage model was built to make possible. Before it, the only
/// measurable figure was arrival-to-departure, which tells a manager that cars take ninety
/// minutes without saying where the eighty-five idle ones went.
///
/// Naming the bottleneck is deliberate rather than leaving the reader to compare columns: it is
/// the single number that tells a manager where another person or another bay would actually
/// help, and the whole point of measuring is to be able to act on it.
/// </summary>
public sealed class GetWaitingReportHandler : IRequestHandler<GetWaitingReportQuery, Result<WaitingReport>>
{
    private readonly IAppDbContext _db;
    public GetWaitingReportHandler(IAppDbContext db) => _db = db;

    public async Task<Result<WaitingReport>> Handle(GetWaitingReportQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var orderIds = await _db.Orders.AsNoTracking()
            .Where(o => o.StartedAtUtc >= from && o.StartedAtUtc <= to && o.Status != OrderStatus.Cancelled)
            .Select(o => o.Id)
            .ToListAsync(ct);

        if (orderIds.Count == 0)
            return Result.Success(new WaitingReport(0, 0, Array.Empty<StageWaitRow>(), null, null, 0));

        var events = await _db.OrderStageEvents.AsNoTracking()
            .Where(e => orderIds.Contains(e.OrderId))
            .Select(e => new { e.OrderId, e.Stage, e.AtUtc })
            .ToListAsync(ct);

        // How long a car sat in a stage is the gap to whatever came next. The last stage of an
        // order that is still moving has no end yet, so it is left out rather than measured
        // against "now" — a car currently being washed has not taken that long, it is taking it.
        var durations = new List<(OrderStage Stage, int Minutes)>();
        var totals = new List<int>();

        foreach (var group in events.GroupBy(e => e.OrderId))
        {
            var ordered = group.OrderBy(e => e.AtUtc).ToList();
            for (var i = 0; i < ordered.Count - 1; i++)
            {
                var minutes = (int)Math.Round((ordered[i + 1].AtUtc - ordered[i].AtUtc).TotalMinutes);
                durations.Add((ordered[i].Stage, Math.Max(0, minutes)));
            }

            if (ordered.Count > 1)
                totals.Add(Math.Max(0, (int)Math.Round((ordered[^1].AtUtc - ordered[0].AtUtc).TotalMinutes)));
        }

        var stages = durations
            .GroupBy(d => d.Stage)
            .Select(g => new StageWaitRow(
                g.Key, StageLabel(g.Key),
                g.Count(),
                (int)Math.Round(g.Average(d => (double)d.Minutes)),
                g.Max(d => d.Minutes)))
            .OrderByDescending(r => r.AverageMinutes)
            .ToList();

        var worst = stages.FirstOrDefault();

        return Result.Success(new WaitingReport(
            orderIds.Count,
            totals.Count == 0 ? 0 : (int)Math.Round(totals.Average()),
            stages,
            worst?.Stage,
            worst?.Label,
            worst?.AverageMinutes ?? 0));
    }

    internal static string StageLabel(OrderStage s) => s switch
    {
        OrderStage.Received => "پذیرش",
        OrderStage.QueuedForWash => "صف شستشو",
        OrderStage.Washing => "شستشو",
        OrderStage.QueuedForDry => "صف خشک",
        OrderStage.Drying => "خشک‌کردن",
        OrderStage.OptionServices => "خدمات آپشن",
        OrderStage.ReadyForPickup => "آماده تحویل",
        _ => "تحویل",
    };
}

// ════════════════════════════ staffing over time ═════════════════════════════

public sealed record StaffingDayRow(
    DateOnly Date, int HeadCount, int Shifts,
    int Washers, int Dryers, int OptionStaff, int Cashiers,
    int CarsServed);

public sealed record StaffingReport(
    IReadOnlyList<StaffingDayRow> Days,
    int AverageHeadCount,
    int TotalWorkers,
    int ActiveWorkers,
    int InactiveWorkers);

public sealed record GetStaffingReportQuery(DateOnly FromDate, DateOnly ToDate)
    : IRequest<Result<StaffingReport>>;

/// <summary>
/// How many people were on, day by day, beside how many cars they got through.
///
/// The two are put on one row on purpose. Headcount alone invites a manager to cut it; cars per
/// head shows what cutting it would cost, which is the comparison the decision actually needs.
/// </summary>
public sealed class GetStaffingReportHandler : IRequestHandler<GetStaffingReportQuery, Result<StaffingReport>>
{
    private readonly IAppDbContext _db;
    public GetStaffingReportHandler(IAppDbContext db) => _db = db;

    public async Task<Result<StaffingReport>> Handle(GetStaffingReportQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var rosters = await _db.ShiftRosters.AsNoTracking()
            .Include(r => r.Assignments)
            .Where(r => r.Date >= q.FromDate && r.Date <= q.ToDate)
            .ToListAsync(ct);

        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.StartedAtUtc >= from && o.StartedAtUtc <= to && o.Status != OrderStatus.Cancelled)
            .Select(o => o.StartedAtUtc)
            .ToListAsync(ct);

        var carsByDay = orders
            .GroupBy(d => DateOnly.FromDateTime(d))
            .ToDictionary(g => g.Key, g => g.Count());

        var days = new List<StaffingDayRow>();
        for (var day = q.FromDate; day <= q.ToDate; day = day.AddDays(1))
        {
            var forDay = rosters.Where(r => r.Date == day).ToList();
            var assignments = forDay.SelectMany(r => r.Assignments).ToList();

            days.Add(new StaffingDayRow(
                day,
                assignments.Count,
                forDay.Count,
                assignments.Count(a => a.Role == StaffRole.Washer),
                assignments.Count(a => a.Role == StaffRole.Dryer),
                assignments.Count(a => a.Role == StaffRole.OptionServices),
                assignments.Count(a => a.Role == StaffRole.Cashier),
                carsByDay.TryGetValue(day, out var cars) ? cars : 0));
        }

        var workerCounts = await _db.Workers.AsNoTracking()
            .GroupBy(w => w.IsActive)
            .Select(g => new { Active = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var active = workerCounts.FirstOrDefault(x => x.Active)?.Count ?? 0;
        var inactive = workerCounts.FirstOrDefault(x => !x.Active)?.Count ?? 0;

        var staffedDays = days.Where(d => d.HeadCount > 0).ToList();

        return Result.Success(new StaffingReport(
            days,
            staffedDays.Count == 0 ? 0 : (int)Math.Round(staffedDays.Average(d => (double)d.HeadCount)),
            active + inactive, active, inactive));
    }
}
