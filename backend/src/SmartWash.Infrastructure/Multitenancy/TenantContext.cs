using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Infrastructure.Multitenancy;

public sealed class TenantContext : ITenantContext
{
    public Guid? TenantId { get; private set; }
    public string? Slug { get; private set; }
    public bool IsReadOnly { get; private set; }
    public bool HasTenant => TenantId.HasValue;

    public void SetTenant(Guid tenantId, string slug, bool isReadOnly)
    {
        TenantId = tenantId;
        Slug = slug;
        IsReadOnly = isReadOnly;
    }
}

public sealed class TenantResolver : ITenantResolver
{
    private readonly IAppDbContext _db;

    public TenantResolver(IAppDbContext db) => _db = db;

    public async Task<ResolvedTenant?> ResolveAsync(string slug, CancellationToken ct)
    {
        var normalized = slug.Trim().ToLowerInvariant();
        var tenant = await _db.Tenants.AsNoTracking()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Slug == normalized, ct);
        if (tenant is null) return null;
        return new ResolvedTenant(tenant.Id, tenant.Slug, tenant.DisplayName, tenant.Status.ToString(), tenant.IsReadOnly());
    }
}
// resync-marker
