using SmartWash.Application.Abstractions.Caching;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Abstractions.Billing;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Infrastructure.Multitenancy;

public sealed class TenantFeatureService : ITenantFeatureService
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IAppCache _cache;

    public TenantFeatureService(IAppDbContext db, ITenantContext tenant, IAppCache cache)
    {
        _db = db; _tenant = tenant; _cache = cache;
    }

    private static string KeyFor(Guid tenantId) => $"tenant-features:{tenantId:N}";

    public async Task<IReadOnlyDictionary<string, string>> GetFeaturesAsync(CancellationToken ct = default)
    {
        if (!_tenant.TenantId.HasValue) return EmptyDict.Instance;
        var tid = _tenant.TenantId.Value;
        var box = await _cache.GetOrCreateAsync(KeyFor(tid), async token =>
        {
            // Includes the trial plan while a trial is running, which is what stops a new
            // carwash spending its fortnight unable to take a reservation or print its own
            // logo — and means the plan's limits apply instead of a missing limit reading as
            // "unlimited".
            var planId = await GoverningPlan.ResolveIdAsync(_db, tid, token);
            if (planId is null) return new FeatureBox(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase));
            var feats = await _db.PlanFeatures.AsNoTracking().IgnoreQueryFilters()
                .Where(f => f.PlanId == planId.Value)
                .ToListAsync(token);
            var dict = feats
                .GroupBy(f => f.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase);
            return new FeatureBox(dict);
        }, Ttl, ct);
        return box.Map;
    }

    public async Task<bool> HasFeatureAsync(string key, CancellationToken ct = default)
    {
        var map = await GetFeaturesAsync(ct);
        if (!map.TryGetValue(key, out var v)) return false;
        if (string.IsNullOrWhiteSpace(v)) return true;
        if (bool.TryParse(v, out var b)) return b;
        if (int.TryParse(v, out var i)) return i > 0;
        return !v.Equals("false", StringComparison.OrdinalIgnoreCase) && !v.Equals("0");
    }

    public async Task<int?> GetLimitAsync(string key, CancellationToken ct = default)
    {
        var map = await GetFeaturesAsync(ct);
        if (!map.TryGetValue(key, out var v)) return null;
        if (v.Equals("unlimited", StringComparison.OrdinalIgnoreCase) || v == "-1") return null;
        return int.TryParse(v, out var i) ? i : null;
    }

    public Task InvalidateAsync(Guid tenantId, CancellationToken ct = default) => _cache.RemoveAsync(KeyFor(tenantId), ct);


    private sealed class FeatureBox
    {
        public FeatureBox(Dictionary<string, string> map) { Map = map; }
        public Dictionary<string, string> Map { get; }
    }

    private static class EmptyDict
    {
        public static readonly IReadOnlyDictionary<string, string> Instance =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }
}
// resync-marker
