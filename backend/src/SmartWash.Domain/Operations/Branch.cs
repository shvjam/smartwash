using SmartWash.Domain.Common;

namespace SmartWash.Domain.Operations;

public sealed class Branch : TenantAggregateRoot<Guid>
{
    private Branch() { }

    public string Name { get; private set; } = null!;
    public string? Address { get; private set; }
    public string? Phone { get; private set; }
    public string? Latitude { get; private set; }
    public string? Longitude { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsDefault { get; private set; }

    public static Branch Create(Guid tenantId, string name, string? address, string? phone, bool isDefault = false)
    {
        return new Branch
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name.Trim(),
            Address = address?.Trim(),
            Phone = phone?.Trim(),
            IsDefault = isDefault,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void Update(string name, string? address, string? phone, string? lat, string? lng)
    {
        Name = name.Trim();
        Address = address?.Trim();
        Phone = phone?.Trim();
        Latitude = lat;
        Longitude = lng;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Activate() { IsActive = true; UpdatedAtUtc = DateTime.UtcNow; }
    public void Deactivate() { IsActive = false; UpdatedAtUtc = DateTime.UtcNow; }
    public void SetAsDefault() { IsDefault = true; UpdatedAtUtc = DateTime.UtcNow; }
    public void UnsetDefault() { IsDefault = false; UpdatedAtUtc = DateTime.UtcNow; }
}
// resync-marker
