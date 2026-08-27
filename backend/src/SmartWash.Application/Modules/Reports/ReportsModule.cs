using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reports;

public sealed record DashboardDto(
    long TodayRevenueRials,
    int TodayOrders,
    int TodayCustomers,
    int ActiveBays,
    int FreeBays,
    int OccupiedBays,
    int PendingReservations,
    long MonthRevenueRials,
    int MonthOrders,
    long MonthExpensesRials,
    long MonthNetRials);

// FromDate/ToDate اختیاری‌اند — اگر null باشند، «امروز» و «این ماه» پیش‌فرض است
public sealed record GetDashboardQuery(Guid? BranchId, DateOnly? FromDate = null, DateOnly? ToDate = null) : IRequest<Result<DashboardDto>>;
public sealed class GetDashboardHandler : IRequestHandler<GetDashboardQuery, Result<DashboardDto>>
{
    private readonly IAppDbContext _db;
    public GetDashboardHandler(IAppDbContext db) => _db = db;
    public async Task<Result<DashboardDto>> Handle(GetDashboardQuery q, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var todayStart = new DateTime(now.Year, now.Month, now.Day, 0, 0, 0, DateTimeKind.Utc);
        // اگر بازه تاریخی داده شده، از آن استفاده کن؛ در غیر این صورت «امروز»
        var rangeStart = q.FromDate.HasValue
            ? q.FromDate.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)
            : todayStart;
        var rangeEnd = q.ToDate.HasValue
            ? q.ToDate.Value.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc)
            : now;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var today = DateOnly.FromDateTime(now);
        var monthStartDate = DateOnly.FromDateTime(monthStart);

        var orders = _db.Orders.AsNoTracking().AsQueryable();
        var bays = _db.Bays.AsNoTracking().AsQueryable();
        var reservations = _db.Reservations.AsNoTracking().AsQueryable();
        var expenses = _db.Expenses.AsNoTracking().AsQueryable();
        if (q.BranchId.HasValue)
        {
            orders = orders.Where(x => x.BranchId == q.BranchId.Value);
            bays = bays.Where(x => x.BranchId == q.BranchId.Value);
            reservations = reservations.Where(x => x.BranchId == q.BranchId.Value);
            expenses = expenses.Where(x => x.BranchId == q.BranchId.Value);
        }

        // بازه‌ی کاستوم یا «امروز» به‌عنوان دوره اول
        var todayOrdersQ = orders.Where(o => o.StartedAtUtc >= rangeStart && o.StartedAtUtc <= rangeEnd && o.Status == OrderStatus.Completed);
        var monthOrdersQ = orders.Where(o => o.StartedAtUtc >= monthStart && o.Status == OrderStatus.Completed);

        var todayRevenue = await todayOrdersQ.SumAsync(o => (long?)o.TotalRials, ct) ?? 0;
        var todayOrderCount = await todayOrdersQ.CountAsync(ct);
        var todayCustomers = await todayOrdersQ.Where(o => o.CustomerId.HasValue).Select(o => o.CustomerId).Distinct().CountAsync(ct);

        var bayList = await bays.GroupBy(b => b.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var freeBays = bayList.FirstOrDefault(x => x.Key == BayStatus.Free)?.Count ?? 0;
        var occupiedBays = bayList.FirstOrDefault(x => x.Key == BayStatus.Occupied)?.Count ?? 0;
        var activeBays = bayList.Sum(x => x.Count);

        var pendingReservations = await reservations.CountAsync(r => r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed, ct);

        var monthRevenue = await monthOrdersQ.SumAsync(o => (long?)o.TotalRials, ct) ?? 0;
        var monthOrderCount = await monthOrdersQ.CountAsync(ct);
        var monthExpenses = await expenses.Where(e => e.Date >= monthStartDate).SumAsync(e => (long?)e.AmountRials, ct) ?? 0;

        return Result.Success(new DashboardDto(todayRevenue, todayOrderCount, todayCustomers, activeBays, freeBays, occupiedBays,
            pendingReservations, monthRevenue, monthOrderCount, monthExpenses, monthRevenue - monthExpenses));
    }
}

public sealed record DailyRevenuePoint(DateOnly Date, long RevenueRials, int OrderCount);
public sealed record GetRevenueSeriesQuery(Guid? BranchId, DateOnly FromDate, DateOnly ToDate) : IRequest<Result<IReadOnlyList<DailyRevenuePoint>>>;
public sealed class GetRevenueSeriesHandler : IRequestHandler<GetRevenueSeriesQuery, Result<IReadOnlyList<DailyRevenuePoint>>>
{
    private readonly IAppDbContext _db;
    public GetRevenueSeriesHandler(IAppDbContext db) => _db = db;
    public async Task<Result<IReadOnlyList<DailyRevenuePoint>>> Handle(GetRevenueSeriesQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
        var query = _db.Orders.AsNoTracking().Where(o => o.Status == OrderStatus.Completed && o.StartedAtUtc >= from && o.StartedAtUtc <= to);
        if (q.BranchId.HasValue) query = query.Where(o => o.BranchId == q.BranchId.Value);
        var rows = await query
            .GroupBy(o => new { o.StartedAtUtc.Year, o.StartedAtUtc.Month, o.StartedAtUtc.Day })
            .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Day, Revenue = g.Sum(o => (long?)o.TotalRials) ?? 0L, Count = g.Count() })
            .ToListAsync(ct);
        var result = rows.Select(r => new DailyRevenuePoint(new DateOnly(r.Year, r.Month, r.Day), r.Revenue, r.Count))
            .OrderBy(x => x.Date).ToArray();
        return Result.Success<IReadOnlyList<DailyRevenuePoint>>(result);
    }
}

public sealed record WorkerPerformanceRow(Guid WorkerId, string FullName, int OrderCount, long RevenueRials, long CommissionRials);
public sealed record GetWorkerPerformanceQuery(DateOnly FromDate, DateOnly ToDate) : IRequest<Result<IReadOnlyList<WorkerPerformanceRow>>>;
public sealed class GetWorkerPerformanceHandler : IRequestHandler<GetWorkerPerformanceQuery, Result<IReadOnlyList<WorkerPerformanceRow>>>
{
    private readonly IAppDbContext _db;
    public GetWorkerPerformanceHandler(IAppDbContext db) => _db = db;
    public async Task<Result<IReadOnlyList<WorkerPerformanceRow>>> Handle(GetWorkerPerformanceQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
        var rows = await _db.OrderLines.AsNoTracking()
            .Where(l => l.WorkerId.HasValue)
            .Join(_db.Orders.AsNoTracking().Where(o => o.Status == OrderStatus.Completed && o.StartedAtUtc >= from && o.StartedAtUtc <= to),
                l => l.OrderId, o => o.Id, (l, o) => l)
            .GroupBy(l => new { WorkerId = l.WorkerId!.Value, l.WorkerName })
            .Select(g => new WorkerPerformanceRow(g.Key.WorkerId, g.Key.WorkerName ?? "",
                g.Select(x => x.OrderId).Distinct().Count(),
                g.Sum(x => x.LineTotalRials),
                g.Sum(x => x.WorkerCommissionRials)))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<WorkerPerformanceRow>>(rows);
    }
}
// resync-marker
