using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

public sealed class Bay : TenantAggregateRoot<Guid>
{
    private Bay() { }

    public Guid BranchId { get; private set; }
    public string Name { get; private set; } = null!;
    public int Number { get; private set; }
    public BayStatus Status { get; private set; }
    public Guid? CurrentOrderId { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static Bay Create(Guid tenantId, Guid branchId, string name, int number)
    {
        return new Bay
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Name = name.Trim(),
            Number = number,
            Status = BayStatus.Free,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void Update(string name, int number, string? notes)
    {
        Name = name.Trim();
        Number = number;
        Notes = notes?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Occupy(Guid orderId)
    {
        if (Status == BayStatus.Occupied) throw new DomainException("Bay.AlreadyOccupied", "جایگاه در حال استفاده است.");
        if (Status == BayStatus.Maintenance) throw new DomainException("Bay.InMaintenance", "جایگاه در حال تعمیر است.");
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
// resync-marker
