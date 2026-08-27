namespace SmartWash.Application.Abstractions.Multitenancy;

public interface ITenantFeatureService
{
    Task<IReadOnlyDictionary<string, string>> GetFeaturesAsync(CancellationToken ct = default);
    Task<bool> HasFeatureAsync(string key, CancellationToken ct = default);
    Task<int?> GetLimitAsync(string key, CancellationToken ct = default);
    Task InvalidateAsync(Guid tenantId, CancellationToken ct = default);
}
// resync-marker
