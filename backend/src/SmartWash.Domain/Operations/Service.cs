using SmartWash.Domain.Common;

namespace SmartWash.Domain.Operations;

public sealed class Service : TenantAggregateRoot<Guid>
{
    private Service() { }

    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public ServiceCategory Category { get; private set; }
    public long PriceRials { get; private set; }
    public int DurationMinutes { get; private set; }
    public decimal WorkerCommissionRate { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int SortOrder { get; private set; }
    public string? IconKey { get; private set; }

    public static Service Create(Guid tenantId, string name, ServiceCategory category, long price, int duration, decimal commission, string? description = null)
    {
        return new Service
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name.Trim(),
            Description = description?.Trim(),
            Category = category,
            PriceRials = price,
            DurationMinutes = duration,
            WorkerCommissionRate = commission,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void Update(string name, string? description, ServiceCategory category, long price, int duration, decimal commission, int sortOrder, string? iconKey)
    {
        Name = name.Trim();
        Description = description?.Trim();
        Category = category;
        PriceRials = price;
        DurationMinutes = duration;
        WorkerCommissionRate = commission;
        SortOrder = sortOrder;
        IconKey = iconKey;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Activate() { IsActive = true; UpdatedAtUtc = DateTime.UtcNow; }
    public void Deactivate() { IsActive = false; UpdatedAtUtc = DateTime.UtcNow; }
}

public enum ServiceCategory
{
    Main = 0,
    Side = 1,
    Detailing = 2,
    Polish = 3,
    Interior = 4,
    Engine = 5
}
// resync-marker
