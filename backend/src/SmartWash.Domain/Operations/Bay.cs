using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

public sealed class Bay : TenantAggregateRoot<Guid>
{
    private Bay() { }

    public Guid BranchId { get; private set; }
    public string Name { get; private set; } = null!;
    public int Number { get; private set; }

    /// <summary>
    /// What this bay is for. A carwash washes in one bay and dries in another, staffed by
    /// different people, and until this existed the two were indistinguishable — so a car
    /// could not be moved from washing to drying, and no report could tell which part of the
    /// site was the slow one.
    /// </summary>
    public BayType Type { get; private set; }

    /// <summary>How many cars fit inside the bay at once. Almost always one.</summary>
    public int ServiceCapacity { get; private set; } = 1;

    /// <summary>
    /// How many cars may wait for this bay. Zero means no queue is kept in front of it.
    /// Separate from <see cref="ServiceCapacity"/> because they answer different questions:
    /// one is how much work can happen, the other is how much work may pile up.
    /// </summary>
    public int QueueCapacity { get; private set; }

    public BayStatus Status { get; private set; }
    public Guid? CurrentOrderId { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static Bay Create(Guid tenantId, Guid branchId, string name, int number,
        BayType type = BayType.Wash, int serviceCapacity = 1, int queueCapacity = 0)
    {
        return new Bay
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Name = name.Trim(),
            Number = number,
            Type = type,
            ServiceCapacity = Math.Max(1, serviceCapacity),
            QueueCapacity = Math.Max(0, queueCapacity),
            Status = BayStatus.Free,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void Update(string name, int number, string? notes,
        BayType? type = null, int? serviceCapacity = null, int? queueCapacity = null)
    {
        Name = name.Trim();
        Number = number;
        Notes = notes?.Trim();
        if (type.HasValue) Type = type.Value;
        if (serviceCapacity.HasValue) ServiceCapacity = Math.Max(1, serviceCapacity.Value);
        if (queueCapacity.HasValue) QueueCapacity = Math.Max(0, queueCapacity.Value);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Occupy(Guid orderId)
    {
        if (Status == BayStatus.Occupied) throw new DomainException("Bay.AlreadyOccupied", "جایگاه در حال استفاده است.");
        if (Status == BayStatus.Maintenance) throw new DomainException("Bay.InMaintenance", "جایگاه در حال تعمیر است.");
        if (!IsActive) throw new DomainException("Bay.Inactive", "جایگاه غیرفعال است.");
        Status = BayStatus.Occupied;
        CurrentOrderId = orderId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Free()
    {
        Status = BayStatus.Free;
        CurrentOrderId = null;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// Frees the bay only if this particular order is the one in it.
    ///
    /// An order remembers the last bay it used, but by the time it is closed another car may
    /// be in that bay. Freeing by the order's memory rather than by the bay's own record
    /// would throw the second car off the board — so every release on behalf of an order goes
    /// through here.
    /// </summary>
    public bool ReleaseIfHeldBy(Guid orderId)
    {
        if (CurrentOrderId != orderId) return false;
        Free();
        return true;
    }

    public void EnterMaintenance(string? notes = null)
    {
        Status = BayStatus.Maintenance;
        if (notes is not null) Notes = notes;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Activate() { IsActive = true; UpdatedAtUtc = DateTime.UtcNow; }
    public void Deactivate() { IsActive = false; UpdatedAtUtc = DateTime.UtcNow; }
}

public enum BayStatus
{
    Free = 0,
    Occupied = 1,
    Maintenance = 2
}

/// <summary>
/// The kinds of bay a carwash runs. Open-ended on purpose — a site that adds a ceramic-coating
/// bay should not need a release, which is why <see cref="BayType.Special"/> exists alongside
/// the named ones and the bay carries its own name anyway.
/// </summary>
public enum BayType
{
    Wash = 0,
    Dry = 1,
    Wax = 2,
    Polish = 3,
    EngineWash = 4,
    Special = 5
}

/// <summary>
/// A period during which a bay was out of use, and why.
///
/// The manager asked to tell a bay closed for repairs apart from one standing idle because
/// nobody was rostered on it. Both look identical on the board — the bay is simply not
/// working — but one is a maintenance cost and the other is a staffing decision, and only the
/// reason recorded at the time can separate them afterwards.
/// </summary>
public sealed class BayDowntime : Entity<Guid>, ITenantScoped
{
    private BayDowntime() { }

    public BayDowntime(Guid bayId, Guid tenantId, BayDowntimeReason reason, string? note, Guid? byUserId)
    {
        Id = Guid.NewGuid();
        BayId = bayId;
        TenantId = tenantId;
        Reason = reason;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ByUserId = byUserId;
        FromUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public Guid BayId { get; private set; }
    public BayDowntimeReason Reason { get; private set; }
    public string? Note { get; private set; }
    public DateTime FromUtc { get; private set; }
    public DateTime? ToUtc { get; private set; }
    public Guid? ByUserId { get; private set; }

    /// <summary>Minutes lost, or minutes lost so far while the bay is still down.</summary>
    public int MinutesLost => (int)Math.Round(((ToUtc ?? DateTime.UtcNow) - FromUtc).TotalMinutes);

    public void Close() => ToUtc ??= DateTime.UtcNow;
}

public enum BayDowntimeReason
{
    Maintenance = 0,
    NoStaff = 1,
    ManagementDecision = 2,
    Other = 3
}
