using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reports;

/// <summary>One worker's part in one car, so "who washed it" has a real answer.</summary>
public sealed record ArchiveWorkerRow(Guid WorkerId, string FullName, string Services, int Minutes, long CommissionRials, long TipRials);

/// <summary>One car, start to finish: where it was, who touched it, when, and what it cost.</summary>
public sealed record OrderArchiveRow(
    Guid OrderId,
    string Number,
    string BayName,
    int BayNumber,
    string VehiclePlate,
    string? VehicleBrand,
    string? VehicleModel,
    string CustomerName,
    string? CustomerPhone,

    OrderStatus Status,
    OrderStage Stage,

    DateTime ReceivedAtUtc,
    DateTime? WashStartedAtUtc,
    DateTime? WashCompletedAtUtc,
    DateTime? ReadyAtUtc,
    DateTime? DeliveredAtUtc,

    /// <summary>Arrival to hand-back — what the customer actually waited.</summary>
    int? TotalMinutes,
    /// <summary>Time in the bay with work happening, once stages are being used.</summary>
    int? WashMinutes,
    /// <summary>Waiting before anyone started, which is where lost time usually hides.</summary>
    int? WaitBeforeWashMinutes,
    int ExpectedDurationMinutes,

    long TotalRials,
    long PaidRials,
    long OutstandingRials,
    PaymentMethod? FinalPaymentMethod,

    IReadOnlyList<ArchiveWorkerRow> Workers,
    string Services);

public sealed record GetOrderArchiveQuery(
    DateOnly FromDate, DateOnly ToDate, Guid? BayId, Guid? WorkerId, int Page, int PageSize)
    : IRequest<Result<PagedList<OrderArchiveRow>>>;

/// <summary>
/// The archive the manager asked for: which bay, which person, what time, which car.
///
/// Everything here was already being recorded — orders carry the bay and the vehicle, lines
/// carry the worker and the money, and stage events now carry the timing — but nothing put
/// them on one line, so answering "who washed that white Peugeot on Tuesday" meant opening
/// orders one at a time. It is paged rather than aggregated on purpose: this is the ledger the
/// other reports summarise, and a manager checking one specific car needs the row itself.
///
/// Durations are only as good as the stages that were actually recorded. An order closed
/// without anyone pressing the stage buttons still reports a total, because arrival and
/// hand-back are always known; the wash and waiting figures stay empty rather than invent a
/// number that would then be averaged into every other report.
/// </summary>
public sealed class GetOrderArchiveHandler
    : IRequestHandler<GetOrderArchiveQuery, Result<PagedList<OrderArchiveRow>>>
{
    private readonly IAppDbContext _db;
    public GetOrderArchiveHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<OrderArchiveRow>>> Handle(GetOrderArchiveQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);

        var query = _db.Orders.AsNoTracking()
            .Where(o => o.StartedAtUtc >= from && o.StartedAtUtc <= to
                        && o.Status != OrderStatus.Cancelled);

        if (q.BayId.HasValue) query = query.Where(o => o.BayId == q.BayId.Value);

        if (q.WorkerId.HasValue)
        {
            var worked = _db.OrderLines.AsNoTracking()
                .Where(l => l.WorkerId == q.WorkerId.Value)
                .Select(l => l.OrderId);
            query = query.Where(o => worked.Contains(o.Id));
        }

        var total = await query.CountAsync(ct);

        var orders = await query
            .OrderByDescending(o => o.StartedAtUtc)
            .Skip((page - 1) * size).Take(size)
            .Select(o => new
            {
                o.Id, o.Number, o.BayId, o.VehiclePlate, o.VehicleBrand, o.VehicleModel,
                o.CustomerName, o.CustomerPhone, o.Status, o.Stage,
                o.StartedAtUtc, o.WashStartedAtUtc, o.WashCompletedAtUtc, o.CompletedAtUtc,
                o.ExpectedDurationMinutes, o.TotalRials, o.PaidRials, o.FinalPaymentMethod,
            })
            .ToListAsync(ct);

        if (orders.Count == 0)
            return Result.Success(new PagedList<OrderArchiveRow>(Array.Empty<OrderArchiveRow>(), page, size, total));

        var ids = orders.Select(o => o.Id).ToList();

        var lines = await _db.OrderLines.AsNoTracking()
            .Where(l => ids.Contains(l.OrderId))
            .Select(l => new
            {
                l.OrderId, l.WorkerId, l.WorkerName, l.ServiceName,
                l.DurationMinutes, l.Quantity, l.WorkerCommissionRials, l.TipRials,
            })
            .ToListAsync(ct);

        // Only the moment the car became ready needs looking up; the rest sit on the order.
        var readyEvents = await _db.OrderStageEvents.AsNoTracking()
            .Where(e => ids.Contains(e.OrderId) && e.Stage == OrderStage.ReadyForPickup)
            .Select(e => new { e.OrderId, e.AtUtc })
            .ToListAsync(ct);
        var readyByOrder = readyEvents
            .GroupBy(e => e.OrderId)
            .ToDictionary(g => g.Key, g => g.Min(e => e.AtUtc));

        var bayIds = orders.Where(o => o.BayId.HasValue).Select(o => o.BayId!.Value).Distinct().ToList();
        var bays = await _db.Bays.AsNoTracking()
            .Where(b => bayIds.Contains(b.Id))
            .Select(b => new { b.Id, b.Name, b.Number })
            .ToDictionaryAsync(b => b.Id, b => b, ct);

        static int? Minutes(DateTime? start, DateTime? end)
            => start.HasValue && end.HasValue
                ? Math.Max(0, (int)Math.Round((end.Value - start.Value).TotalMinutes))
                : null;

        var rows = orders.Select(o =>
        {
            var mine = lines.Where(l => l.OrderId == o.Id).ToList();

            var workers = mine
                .Where(l => l.WorkerId.HasValue)
                .GroupBy(l => new { WorkerId = l.WorkerId!.Value, l.WorkerName })
                .Select(g => new ArchiveWorkerRow(
                    g.Key.WorkerId,
                    g.Key.WorkerName ?? "",
                    string.Join("، ", g.Select(l => l.ServiceName).Distinct()),
                    g.Sum(l => l.DurationMinutes * Math.Max(1, l.Quantity)),
                    g.Sum(l => l.WorkerCommissionRials),
                    g.Sum(l => l.TipRials)))
                .ToList();

            var bay = o.BayId is { } bid && bays.TryGetValue(bid, out var found) ? found : null;
            var ready = readyByOrder.TryGetValue(o.Id, out var r) ? r : (DateTime?)null;

            return new OrderArchiveRow(
                o.Id, o.Number,
                bay?.Name ?? "—", bay?.Number ?? 0,
                o.VehiclePlate, o.VehicleBrand, o.VehicleModel,
                o.CustomerName, o.CustomerPhone,
                o.Status, o.Stage,
                o.StartedAtUtc, o.WashStartedAtUtc, o.WashCompletedAtUtc,
                ready, o.CompletedAtUtc,
                Minutes(o.StartedAtUtc, o.CompletedAtUtc),
                Minutes(o.WashStartedAtUtc, o.WashCompletedAtUtc),
                Minutes(o.StartedAtUtc, o.WashStartedAtUtc),
                o.ExpectedDurationMinutes,
                o.TotalRials, o.PaidRials, Math.Max(0, o.TotalRials - o.PaidRials),
                o.FinalPaymentMethod,
                workers,
                string.Join("، ", mine.Select(l => l.ServiceName).Distinct()));
        }).ToList();

        return Result.Success(new PagedList<OrderArchiveRow>(rows, page, size, total));
    }
}
