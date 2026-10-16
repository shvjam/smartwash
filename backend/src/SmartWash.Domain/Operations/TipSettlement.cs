using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

/// <summary>
/// A payment of accumulated tips to one worker, covering a stated period.
///
/// Tips were being recorded against each service line from the start, so the system always
/// knew what a worker had earned. What it did not know was what had been handed over, which is
/// the question that actually causes arguments on a Friday: the manager remembers paying, the
/// worker remembers a different amount, and nothing written down settles it.
///
/// A settlement covers a period rather than pointing at individual lines. That is deliberate —
/// a manager pays "everything up to the end of last week", not a list of car washes — and it
/// means what is still owed can be worked out by asking for tips earned after the last
/// settlement, without having to mark thousands of rows.
///
/// Periods for one worker may not overlap, because two settlements covering the same day would
/// make "how much has this person been paid" ambiguous, which is the whole thing this exists
/// to prevent.
/// </summary>
public sealed class TipSettlement : TenantAggregateRoot<Guid>
{
    private TipSettlement() { }

    public Guid BranchId { get; private set; }
    public Guid WorkerId { get; private set; }
    /// <summary>Copied at the time, so the record still reads correctly if the worker is renamed.</summary>
    public string WorkerName { get; private set; } = null!;

    public DateTime PeriodFromUtc { get; private set; }
    public DateTime PeriodToUtc { get; private set; }

    /// <summary>What the tips for that period came to when the settlement was made.</summary>
    public long EarnedRials { get; private set; }
    /// <summary>What was actually handed over. Usually equal to earned; rounding happens.</summary>
    public long PaidRials { get; private set; }

    public DateTime SettledAtUtc { get; private set; }
    public Guid? SettledByUserId { get; private set; }
    public string? Note { get; private set; }

    public static TipSettlement Create(Guid tenantId, Guid branchId, Guid workerId, string workerName,
        DateTime periodFromUtc, DateTime periodToUtc, long earnedRials, long paidRials,
        Guid? settledByUserId, string? note)
    {
        if (periodToUtc <= periodFromUtc)
            throw new DomainException("TipSettlement.InvalidPeriod", "بازه‌ی تسویه نامعتبر است.");
        if (paidRials < 0)
            throw new DomainException("TipSettlement.InvalidAmount", "مبلغ تسویه نمی‌تواند منفی باشد.");

        return new TipSettlement
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            WorkerId = workerId,
            WorkerName = workerName.Trim(),
            PeriodFromUtc = periodFromUtc,
            PeriodToUtc = periodToUtc,
            EarnedRials = earnedRials,
            PaidRials = paidRials,
            SettledAtUtc = DateTime.UtcNow,
            SettledByUserId = settledByUserId,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
        };
    }

    /// <summary>The gap between what was earned and what was paid, if the manager rounded.</summary>
    public long DifferenceRials => PaidRials - EarnedRials;
}
