using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Tenants.GetCurrent;

public sealed record GetCurrentTenantQuery : IRequest<Result<TenantDto>>;

public sealed class GetCurrentTenantQueryHandler : IRequestHandler<GetCurrentTenantQuery, Result<TenantDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public GetCurrentTenantQueryHandler(IAppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<Result<TenantDto>> Handle(GetCurrentTenantQuery request, CancellationToken ct)
    {
        if (!_tenantContext.TenantId.HasValue)
            return Result.Failure<TenantDto>(Error.NotFound("Tenant.NotResolved", "مستاجر مشخص نیست."));

        var tenant = await _db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == _tenantContext.TenantId.Value, ct);

        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFound("Tenant.NotFound", "مستاجر یافت نشد."));

        return new TenantDto(tenant.Id, tenant.Slug, tenant.DisplayName, tenant.OwnerEmail,
            tenant.OwnerPhone, tenant.LogoUrl, tenant.PrimaryColor, tenant.Status,
            tenant.TrialEndsAtUtc, tenant.ActiveSubscriptionId, tenant.CreatedAtUtc);
    }
}
// resync-marker
