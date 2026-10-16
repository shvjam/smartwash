using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Exceptions;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Tips;

/// <summary>What one worker is owed, and when they were last paid.</summary>
public sealed record TipBalanceRow(
    Guid WorkerId,
    string FullName,
    string? AvatarUrl,
    /// <summary>Tips earned since the last settlement. This is what is owed.</summary>
    long UnsettledRials,
    int UnsettledOrders,
    /// <summary>Start of the unpaid stretch — the day after the last settlement ended.</summary>
    DateTime? UnsettledFromUtc,
    DateTime? LastSettledAtUtc,
    DateTime? SettledThroughUtc,
    long LifetimeEarnedRials,
    long LifetimePaidRials);

public sealed record TipSettlementRow(
    Guid Id, Guid WorkerId, string WorkerName,
    DateTime PeriodFromUtc, DateTime PeriodToUtc,
    long EarnedRials, long PaidRials,
    DateTime SettledAtUtc, string? Note);

public sealed record TipLedger(
    IReadOnlyList<TipBalanceRow> Balances,
    IReadOnlyList<TipSettlementRow> RecentSettlements,
    long TotalUnsettledRials);

// ─────────────────────────────────────────────────────────────────────────────

public sealed record GetTipLedgerQuery(Guid? BranchId) : IRequest<Result<TipLedger>>;

/// <summary>
/// Who is owed tips, how much, and for what stretch of time.
///
/// The tips themselves were always recorded on the service line, so the earnings side was
/// never in doubt. What nobody could answer was what had been handed over — the manager pays
/// in cash on a Friday and remembers it; the worker remembers a different figure a month later
/// and there is nothing to check either account against.
///
/// The unpaid amount is worked out as "tips on orders completed after the last settlement
/// ended" rather than by flagging individual lines. That keeps the hot table untouched, and it
/// matches the way the money actually moves: a manager settles up to a date, not against a
/// list of car washes.
/// </summary>
public sealed class GetTipLedgerHandler : IRequestHandler<GetTipLedgerQuery, Result<TipLedger>>
{
    private readonly IAppDbContext _db;
    public GetTipLedgerHandler(IAppDbContext db) => _db = db;

    public async Task<Result<TipLedger>> Handle(GetTipLedgerQuery q, CancellationToken ct)
    {
        var workers = await _db.Workers.AsNoTracking()
            .Where(w => w.IsActive)
            .Select(w => new { w.Id, w.FullName, w.AvatarUrl })
            .ToListAsync(ct);

        var settlements = await _db.TipSettlements.AsNoTracking()
            .Where(s => !q.BranchId.HasValue || s.BranchId == q.BranchId.Value)
            .OrderByDescending(s => s.SettledAtUtc)
            .ToListAsync(ct);

        var settledThrough = settlements
            .GroupBy(s => s.WorkerId)
            .ToDictionary(g => g.Key, g => g.Max(s => s.PeriodToUtc));
        var lastSettledAt = settlements
            .GroupBy(s => s.WorkerId)
            .ToDictionary(g => g.Key, g => g.Max(s => s.SettledAtUtc));
        var paidTotals = settlements
            .GroupBy(s => s.WorkerId)
            .ToDictionary(g => g.Key, g => g.Sum(s => s.PaidRials));

        // Tips ride on completed orders, so an order still open is not yet owed to anyone —
        // it can still be cancelled, and paying out on it would have to be clawed back.
        var tipLines = await (
            from l in _db.OrderLines.AsNoTracking()
            join o in _db.Orders.AsNoTracking() on l.OrderId equals o.Id
            where l.WorkerId != null && l.TipRials > 0
                  && o.Status == OrderStatus.Completed && o.CompletedAtUtc != null
                  && (!q.BranchId.HasValue || o.BranchId == q.BranchId.Value)
            select new { WorkerId = l.WorkerId!.Value, l.TipRials, o.Id, CompletedAtUtc = o.CompletedAtUtc!.Value })
            .ToListAsync(ct);

        var byWorker = tipLines.GroupBy(x => x.WorkerId).ToDictionary(g => g.Key, g => g.ToList());

        var balances = workers.Select(w =>
        {
            byWorker.TryGetValue(w.Id, out var mine);
            mine ??= new();

            settledThrough.TryGetValue(w.Id, out var through);
            var unsettled = mine.Where(x => through == default || x.CompletedAtUtc > through).ToList();

            return new TipBalanceRow(
                w.Id, w.FullName, w.AvatarUrl,
                unsettled.Sum(x => x.TipRials),
                unsettled.Select(x => x.Id).Distinct().Count(),
                unsettled.Count == 0 ? null : unsettled.Min(x => x.CompletedAtUtc),
                lastSettledAt.TryGetValue(w.Id, out var at) ? at : null,
                through == default ? null : through,
                mine.Sum(x => x.TipRials),
                paidTotals.TryGetValue(w.Id, out var paid) ? paid : 0);
        })
        .OrderByDescending(r => r.UnsettledRials)
        .ToList();

        var recent = settlements.Take(50)
            .Select(s => new TipSettlementRow(s.Id, s.WorkerId, s.WorkerName,
                s.PeriodFromUtc, s.PeriodToUtc, s.EarnedRials, s.PaidRials, s.SettledAtUtc, s.Note))
            .ToList();

        return Result.Success(new TipLedger(balances, recent, balances.Sum(b => b.UnsettledRials)));
    }
}

// ─────────────────────────────────────────────────────────────────────────────

public sealed record SettleTipsCommand(Guid WorkerId, Guid BranchId, DateTime ThroughUtc, long PaidRials, string? Note)
    : IRequest<Result<TipSettlementRow>>, ITransactionalRequest;

/// <summary>
/// Records that a worker has been paid their tips up to a given moment.
///
/// The earned figure is recomputed here rather than taken from the caller, so the receipt
/// cannot disagree with the books even if the screen was left open while more cars were washed.
/// The amount actually handed over is taken as given, because managers round.
/// </summary>
public sealed class SettleTipsHandler : IRequestHandler<SettleTipsCommand, Result<TipSettlementRow>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public SettleTipsHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<TipSettlementRow>> Handle(SettleTipsCommand c, CancellationToken ct)
    {
        var worker = await _db.Workers.FirstOrDefaultAsync(w => w.Id == c.WorkerId, ct);
        if (worker is null) return Result.Failure<TipSettlementRow>(Error.NotFound("Worker.NotFound", "پرسنل یافت نشد."));

        var previousThrough = await _db.TipSettlements.AsNoTracking()
            .Where(s => s.WorkerId == c.WorkerId)
            .Select(s => (DateTime?)s.PeriodToUtc)
            .OrderByDescending(d => d)
            .FirstOrDefaultAsync(ct);

        // The new period starts where the last one stopped, so no stretch of time is ever
        // settled twice and none is skipped.
        var periodFrom = previousThrough ?? DateTime.UnixEpoch;
        if (c.ThroughUtc <= periodFrom)
            return Result.Failure<TipSettlementRow>(Error.Validation("TipSettlement.AlreadySettled",
                "این بازه قبلاً تسویه شده است."));

        var earned = await (
            from l in _db.OrderLines.AsNoTracking()
            join o in _db.Orders.AsNoTracking() on l.OrderId equals o.Id
            where l.WorkerId == c.WorkerId && l.TipRials > 0
                  && o.Status == OrderStatus.Completed
                  && o.CompletedAtUtc != null
                  && o.CompletedAtUtc > periodFrom && o.CompletedAtUtc <= c.ThroughUtc
            select l.TipRials).SumAsync(ct);

        TipSettlement settlement;
        try
        {
            settlement = TipSettlement.Create(Guid.Empty, c.BranchId, worker.Id, worker.FullName,
                periodFrom, c.ThroughUtc, earned, c.PaidRials, _currentUser.UserId, c.Note);
        }
        catch (DomainException ex)
        {
            return Result.Failure<TipSettlementRow>(Error.Validation(ex.Code, ex.Message));
        }

        _db.TipSettlements.Add(settlement);
        await _db.SaveChangesAsync(ct);

        return Result.Success(new TipSettlementRow(settlement.Id, settlement.WorkerId, settlement.WorkerName,
            settlement.PeriodFromUtc, settlement.PeriodToUtc, settlement.EarnedRials, settlement.PaidRials,
            settlement.SettledAtUtc, settlement.Note));
    }
}
