using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Plans.List;

public sealed record ListPlansQuery(bool OnlyPublic) : IRequest<Result<IReadOnlyList<PlanDto>>>;

public sealed class ListPlansQueryHandler : IRequestHandler<ListPlansQuery, Result<IReadOnlyList<PlanDto>>>
{
    private readonly IAppDbContext _db;

    public ListPlansQueryHandler(IAppDbContext db) => _db = db;

    public async Task<Result<IReadOnlyList<PlanDto>>> Handle(ListPlansQuery request, CancellationToken ct)
    {
        var query = _db.Plans.AsNoTracking().Include(p => p.Features).AsQueryable();
        if (request.OnlyPublic) query = query.Where(p => p.IsPublic && p.IsActive);

        var plans = await query.OrderBy(p => p.SortOrder).ToListAsync(ct);

        IReadOnlyList<PlanDto> result = plans.Select(p => new PlanDto(
            p.Id, p.Code, p.DisplayName, p.Description, p.BillingModel,
            p.SetupFeeRials, p.MonthlyPriceRials, p.YearlyPriceRials, p.PerCarPriceRials,
            p.IncludedCarsPerMonth, p.PerCarBrackets, p.SortOrder, p.IsActive, p.IsPublic,
            p.Features.Select(f => new PlanFeatureDto(f.Key, f.Value)).ToArray())).ToList();

        return Result.Success(result);
    }
}
// resync-marker
