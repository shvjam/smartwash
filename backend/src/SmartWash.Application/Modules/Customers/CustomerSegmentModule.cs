using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Customers;

public sealed record SegmentCustomerRow(
    Guid CustomerId,
    string FullName,
    string Phone,
    string? Plate,
    DateTime? LastVisitAtUtc,
    int DaysSinceLastVisit,
    int VisitCount,
    long TotalSpentRials,
    LoyaltyTier Tier,
    /// <summary>Next reminder falling due for this customer, when one is pending.</summary>
    DateTime? NextReminderDueUtc);

public sealed record CustomerSegment(
    int MatchCount,
    IReadOnlyList<SegmentCustomerRow> Customers);

/// <summary>
/// The ways a manager actually describes a group of customers.
///
/// Every field is optional and they combine, so "gold-tier customers who have not been in for
/// two months" is one request rather than two lists compared by hand.
/// </summary>
public sealed record GetCustomerSegmentQuery(
    /// <summary>Reminders falling due on or after this date.</summary>
    DateOnly? DueFrom,
    DateOnly? DueTo,
    /// <summary>Nobody who has visited within this many days.</summary>
    int? NotVisitedInDays,
    /// <summary>Anyone who has visited within this many days.</summary>
    int? VisitedInDays,
    int? MinVisits,
    int? MaxVisits,
    LoyaltyTier? MinTier,
    Guid? ServiceId,
    long? MinTotalSpentRials,
    int Take)
    : IRequest<Result<CustomerSegment>>;

/// <summary>
/// Picks out a group of customers by the things a manager can actually observe about them.
///
/// The reminders screen could already send to a list, but the list had to be built by ticking
/// names — workable with forty customers and impossible with four thousand, which is where this
/// carwash will be within a year. The manager asked for exactly this: due in the next ten days,
/// not seen for a month, the ones who come often.
///
/// It returns the customers rather than sending anything. Choosing a group and messaging it are
/// separate decisions, and a filter that sent as a side effect of being run would be a bad thing
/// to leave lying around.
/// </summary>
public sealed class GetCustomerSegmentHandler : IRequestHandler<GetCustomerSegmentQuery, Result<CustomerSegment>>
{
    private readonly IAppDbContext _db;
    public GetCustomerSegmentHandler(IAppDbContext db) => _db = db;

    public async Task<Result<CustomerSegment>> Handle(GetCustomerSegmentQuery q, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var take = Math.Clamp(q.Take, 1, 2000);

        var customers = _db.Customers.AsNoTracking().Where(c => c.IsActive);

        if (q.MinVisits.HasValue) customers = customers.Where(c => c.TotalVisits >= q.MinVisits.Value);
        if (q.MaxVisits.HasValue) customers = customers.Where(c => c.TotalVisits <= q.MaxVisits.Value);
        if (q.MinTier.HasValue) customers = customers.Where(c => c.Tier >= q.MinTier.Value);
        if (q.MinTotalSpentRials.HasValue) customers = customers.Where(c => c.LifetimeSpendRials >= q.MinTotalSpentRials.Value);

        if (q.NotVisitedInDays is int cold)
        {
            var cutoff = now.AddDays(-cold);
            // Someone who has never been counts as cold: they are exactly who a "win them back"
            // message is for, and excluding them would quietly drop the most dormant names.
            customers = customers.Where(c => c.LastVisitAtUtc == null || c.LastVisitAtUtc < cutoff);
        }

        if (q.VisitedInDays is int warm)
        {
            var cutoff = now.AddDays(-warm);
            customers = customers.Where(c => c.LastVisitAtUtc != null && c.LastVisitAtUtc >= cutoff);
        }

        if (q.ServiceId.HasValue)
        {
            var hadService = _db.OrderLines.AsNoTracking()
                .Where(l => l.ServiceId == q.ServiceId.Value)
                .Join(_db.Orders.AsNoTracking(), l => l.OrderId, o => o.Id, (l, o) => o.CustomerId)
                .Where(id => id != null)
                .Select(id => id!.Value);
            customers = customers.Where(c => hadService.Contains(c.Id));
        }

        if (q.DueFrom.HasValue || q.DueTo.HasValue)
        {
            var dueFrom = (q.DueFrom ?? DateOnly.MinValue).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var dueTo = (q.DueTo ?? DateOnly.MaxValue).ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

            var due = _db.ServiceReminders.AsNoTracking()
                .Where(r => r.Status == ReminderStatus.Pending
                            && r.DueAtUtc >= dueFrom && r.DueAtUtc <= dueTo)
                .Select(r => r.CustomerId);
            customers = customers.Where(c => due.Contains(c.Id));
        }

        var total = await customers.CountAsync(ct);

        var rows = await customers
            .OrderBy(c => c.LastVisitAtUtc ?? DateTime.MinValue)
            .Take(take)
            .Select(c => new
            {
                c.Id, c.FullName, c.Phone, c.LastVisitAtUtc, c.TotalVisits, c.LifetimeSpendRials, c.Tier,
                Plate = c.Vehicles.Select(v => v.Plate).FirstOrDefault(),
            })
            .ToListAsync(ct);

        var ids = rows.Select(r => r.Id).ToList();
        var nextDue = await _db.ServiceReminders.AsNoTracking()
            .Where(r => ids.Contains(r.CustomerId) && r.Status == ReminderStatus.Pending)
            .GroupBy(r => r.CustomerId)
            .Select(g => new { CustomerId = g.Key, Due = g.Min(r => r.DueAtUtc) })
            .ToDictionaryAsync(x => x.CustomerId, x => x.Due, ct);

        var items = rows.Select(r => new SegmentCustomerRow(
            r.Id, r.FullName, r.Phone, r.Plate,
            r.LastVisitAtUtc,
            r.LastVisitAtUtc.HasValue ? (int)Math.Floor((now - r.LastVisitAtUtc.Value).TotalDays) : int.MaxValue,
            r.TotalVisits, r.LifetimeSpendRials, r.Tier,
            nextDue.TryGetValue(r.Id, out var due) ? due : null))
            .ToArray();

        return Result.Success(new CustomerSegment(total, items));
    }
}
