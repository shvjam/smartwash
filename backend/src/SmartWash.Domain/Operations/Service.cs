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

    /// <summary>
    /// The kind of bay this service needs, or null when it can be done anywhere.
    ///
    /// Used to route a car: a polish belongs with the drying crew, not in a wash bay, and the
    /// queue cannot put it in the right line without being told which line that is.
    /// </summary>
    public BayType? RequiredBayType { get; private set; }

    /// <summary>
    /// An add-on offered at the bay rather than booked at the desk — wax, polish and the like.
    ///
    /// Kept apart from ordinary services because the money can work differently: an optional
    /// service is sometimes collected by the operator directly rather than through the till,
    /// and a report that mixed the two would overstate what the carwash actually took.
    /// </summary>
    public bool IsOptional { get; private set; }

    public static Service Create(Guid tenantId, string name, ServiceCategory category, long price, int duration, decimal commission, string? description = null,
        BayType? requiredBayType = null, bool isOptional = false)
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
            RequiredBayType = requiredBayType,
            IsOptional = isOptional,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void Update(string name, string? description, ServiceCategory category, long price, int duration, decimal commission, int sortOrder, string? iconKey,
        BayType? requiredBayType = null, bool? isOptional = null)
    {
        Name = name.Trim();
        Description = description?.Trim();
        Category = category;
        PriceRials = price;
        DurationMinutes = duration;
        WorkerCommissionRate = commission;
        SortOrder = sortOrder;
        IconKey = iconKey;
        RequiredBayType = requiredBayType;
        if (isOptional.HasValue) IsOptional = isOptional.Value;
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
