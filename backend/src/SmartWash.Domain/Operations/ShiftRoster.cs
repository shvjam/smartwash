using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

/// <summary>
/// Who is working, when, and on which bay.
///
/// This is not the same thing as <see cref="Shift"/>, and the difference matters. A Shift is a
/// cash session: a till is opened with a float, money goes through it, and it is counted and
/// closed. A roster is a plan for people: two washers on bay 3 from seven until three, one
/// dryer on bay 9, a cashier at the desk.
///
/// They were conflated before, with the result that the system knew exactly how much cash a
/// shift took and nothing whatever about who had worked it — so "how many people were on
/// yesterday" and "which bay was idle for lack of staff" were both unanswerable.
///
/// A roster stands on its own rather than hanging off a Shift because it is made in advance,
/// often days ahead, while a till is opened on the morning itself.
/// </summary>
public sealed class ShiftRoster : TenantAggregateRoot<Guid>
{
    private readonly List<ShiftAssignment> _assignments = new();

    private ShiftRoster() { }

    public Guid BranchId { get; private set; }
    /// <summary>The working day this roster covers, in local terms rather than UTC.</summary>
    public DateOnly Date { get; private set; }
    public string Name { get; private set; } = null!;
    public TimeOnly StartsAt { get; private set; }
    public TimeOnly EndsAt { get; private set; }
    public string? Notes { get; private set; }

    public IReadOnlyCollection<ShiftAssignment> Assignments => _assignments.AsReadOnly();

    public static ShiftRoster Create(Guid tenantId, Guid branchId, DateOnly date, string name,
        TimeOnly startsAt, TimeOnly endsAt, string? notes = null)
    {
        if (endsAt == startsAt)
            throw new DomainException("Roster.InvalidHours", "ساعت شروع و پایان شیفت نمی‌تواند یکسان باشد.");

        return new ShiftRoster
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Date = date,
            Name = name.Trim(),
            StartsAt = startsAt,
            EndsAt = endsAt,
            Notes = notes?.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
        };
    }

    public void Update(string name, TimeOnly startsAt, TimeOnly endsAt, string? notes)
    {
        if (endsAt == startsAt)
            throw new DomainException("Roster.InvalidHours", "ساعت شروع و پایان شیفت نمی‌تواند یکسان باشد.");
        Name = name.Trim();
        StartsAt = startsAt;
        EndsAt = endsAt;
        Notes = notes?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// Puts someone on this shift.
    ///
    /// Either a worker or a user, and not both: a washer is an operational body who may never
    /// sign in, while a cashier is an account that does. Insisting on one or the other keeps
    /// "three people were on" from quietly counting the same person twice.
    /// </summary>
    public ShiftAssignment Assign(StaffRole role, Guid? workerId, Guid? userId, Guid? bayId, string? note)
    {
        if (workerId is null && userId is null)
            throw new DomainException("Roster.NobodyAssigned", "باید کارگر یا کاربر مشخص شود.");
        if (workerId is not null && userId is not null)
            throw new DomainException("Roster.AmbiguousAssignment", "هر ردیف یا کارگر است یا کاربر، نه هر دو.");

        var duplicate = _assignments.Any(a =>
            (workerId is not null && a.WorkerId == workerId) ||
            (userId is not null && a.UserId == userId));
        if (duplicate)
            throw new DomainException("Roster.AlreadyAssigned", "این نفر در همین شیفت ثبت شده است.");

        var assignment = new ShiftAssignment(Id, TenantId, role, workerId, userId, bayId, note);
        _assignments.Add(assignment);
        UpdatedAtUtc = DateTime.UtcNow;
        return assignment;
    }

    public void Unassign(Guid assignmentId)
    {
        var found = _assignments.FirstOrDefault(a => a.Id == assignmentId)
            ?? throw new DomainException("Roster.AssignmentNotFound", "ردیف موردنظر یافت نشد.");
        _assignments.Remove(found);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>Headcount, which is what the staffing reports are counting.</summary>
    public int HeadCount => _assignments.Count;
}

/// <summary>One person on one shift, optionally tied to one bay.</summary>
public sealed class ShiftAssignment : Entity<Guid>, ITenantScoped
{
    private ShiftAssignment() { }

    public ShiftAssignment(Guid rosterId, Guid tenantId, StaffRole role,
        Guid? workerId, Guid? userId, Guid? bayId, string? note)
    {
        Id = Guid.NewGuid();
        ShiftRosterId = rosterId;
        TenantId = tenantId;
        Role = role;
        WorkerId = workerId;
        UserId = userId;
        BayId = bayId;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    public Guid TenantId { get; private set; }
    public Guid ShiftRosterId { get; private set; }
    public StaffRole Role { get; private set; }
    /// <summary>Set for an operational body who may not have an account.</summary>
    public Guid? WorkerId { get; private set; }
    /// <summary>Set for someone who signs in — a cashier, a shift lead.</summary>
    public Guid? UserId { get; private set; }
    /// <summary>The bay they are on, where the role is tied to one.</summary>
    public Guid? BayId { get; private set; }
    public string? Note { get; private set; }
}

/// <summary>What someone is doing on a shift, which is not the same as what they may click.</summary>
public enum StaffRole
{
    Washer = 0,
    Dryer = 1,
    OptionServices = 2,
    Cashier = 3,
    ShiftLead = 4,
    Other = 5
}
