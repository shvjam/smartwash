namespace SmartWash.Application.Abstractions.Multitenancy;

public interface ITenantContext
{
    Guid? TenantId { get; }
    string? Slug { get; }
    bool HasTenant { get; }
    bool IsReadOnly { get; }
    void SetTenant(Guid tenantId, string slug, bool isReadOnly);
}

public interface ITenantResolver
{
    Task<ResolvedTenant?> ResolveAsync(string slug, CancellationToken ct);
}

public sealed record ResolvedTenant(Guid Id, string Slug, string DisplayName, string Status, bool IsReadOnly);
// resync-marker
