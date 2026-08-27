using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Billing;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Platform;

public sealed record PlanFeatureDto(string Key, string Value);
public sealed record PlanDto(Guid Id, string Code, string DisplayName, string? Description, PlanBillingModel BillingModel,
    long SetupFeeRials, long MonthlyPriceRials, long YearlyPriceRials, long PerCarPriceRials,
    int? IncludedCarsPerMonth, int SortOrder, bool IsActive, bool IsPublic, IReadOnlyList<PlanFeatureDto> Features);

public static class PlanMap
{
    public static PlanDto ToDto(Plan p) => new(p.Id, p.Code, p.DisplayName, p.Description, p.BillingModel,
        p.SetupFeeRials, p.MonthlyPriceRials, p.YearlyPriceRials, p.PerCarPriceRials,
        p.IncludedCarsPerMonth, p.SortOrder, p.IsActive, p.IsPublic,
        p.Features.Select(f => new PlanFeatureDto(f.Key, f.Value)).ToArray());
}

public sealed record ListPlansQuery(bool? OnlyActive, bool? OnlyPublic) : IRequest<Result<IReadOnlyList<PlanDto>>>;
public sealed class ListPlansHandler : IRequestHandler<ListPlansQuery, Result<IReadOnlyList<PlanDto>>>
{
    private readonly IAppDbContext _db;
    public ListPlansHandler(IAppDbContext db) => _db = db;
    public async Task<Result<IReadOnlyList<PlanDto>>> Handle(ListPlansQuery q, CancellationToken ct)
    {
        var qry = _db.Plans.AsNoTracking().Include(p => p.Features).AsQueryable();
        if (q.OnlyActive == true) qry = qry.Where(p => p.IsActive);
        if (q.OnlyPublic == true) qry = qry.Where(p => p.IsPublic);
        var list = await qry.OrderBy(p => p.SortOrder).ToListAsync(ct);
        return Result.Success<IReadOnlyList<PlanDto>>(list.Select(PlanMap.ToDto).ToArray());
    }
}

public sealed record GetPlanQuery(Guid Id) : IRequest<Result<PlanDto>>;
public sealed class GetPlanHandler : IRequestHandler<GetPlanQuery, Result<PlanDto>>
{
    private readonly IAppDbContext _db;
    public GetPlanHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PlanDto>> Handle(GetPlanQuery q, CancellationToken ct)
    {
        var p = await _db.Plans.AsNoTracking().Include(x => x.Features).FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        return p is null ? Result.Failure<PlanDto>(Error.NotFound("Plan.NotFound", "پلن یافت نشد.")) : PlanMap.ToDto(p);
    }
}

public sealed record CreatePlanCommand(string Code, string DisplayName, string? Description, PlanBillingModel BillingModel,
    long SetupFeeRials, long MonthlyPriceRials, long YearlyPriceRials, long PerCarPriceRials,
    int SortOrder, bool IsPublic, IReadOnlyList<PlanFeatureDto>? Features) : IRequest<Result<PlanDto>>, ITransactionalRequest;

public sealed class CreatePlanValidator : AbstractValidator<CreatePlanCommand>
{
    public CreatePlanValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(60);
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(120);
        RuleFor(x => x.MonthlyPriceRials).GreaterThanOrEqualTo(0);
        RuleFor(x => x.YearlyPriceRials).GreaterThanOrEqualTo(0);
    }
}

public sealed class CreatePlanHandler : IRequestHandler<CreatePlanCommand, Result<PlanDto>>
{
    private readonly IAppDbContext _db;
    public CreatePlanHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PlanDto>> Handle(CreatePlanCommand c, CancellationToken ct)
    {
        var code = c.Code.Trim().ToLowerInvariant();
        if (await _db.Plans.AnyAsync(p => p.Code == code, ct))
            return Result.Failure<PlanDto>(Error.Conflict("Plan.CodeTaken", "کد پلن تکراری است."));
        var plan = Plan.Create(c.Code, c.DisplayName, c.BillingModel, c.SetupFeeRials, c.MonthlyPriceRials, c.YearlyPriceRials, c.PerCarPriceRials, c.SortOrder, c.IsPublic);
        if (!string.IsNullOrEmpty(c.Description)) plan.SetDescription(c.Description);
        if (c.Features is not null) foreach (var f in c.Features) plan.AddFeature(f.Key, f.Value);
        _db.Plans.Add(plan);
        await _db.SaveChangesAsync(ct);
        return PlanMap.ToDto(plan);
    }
}

public sealed record UpdatePlanCommand(Guid Id, string DisplayName, string? Description, long SetupFeeRials, long MonthlyPriceRials,
    long YearlyPriceRials, long PerCarPriceRials, int SortOrder, bool IsPublic, IReadOnlyList<PlanFeatureDto>? Features) : IRequest<Result<PlanDto>>, ITransactionalRequest;
public sealed class UpdatePlanHandler : IRequestHandler<UpdatePlanCommand, Result<PlanDto>>
{
    private readonly IAppDbContext _db;
    public UpdatePlanHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PlanDto>> Handle(UpdatePlanCommand c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.DisplayName))
            return Result.Failure<PlanDto>(Error.Validation("Plan.NameRequired", "نام پلن الزامی است."));

        // Platform-plan edits are administrator commands, not optimistic document edits.
        // ExecuteUpdate avoids stale RowVersion failures caused by EF tracking the plan
        // and its replaced feature collection in the same SaveChanges batch.
        var changed = await _db.Plans.Where(p => p.Id == c.Id).ExecuteUpdateAsync(setters => setters
            .SetProperty(p => p.DisplayName, c.DisplayName.Trim())
            .SetProperty(p => p.Description, c.Description)
            .SetProperty(p => p.SetupFeeRials, c.SetupFeeRials)
            .SetProperty(p => p.MonthlyPriceRials, c.MonthlyPriceRials)
            .SetProperty(p => p.YearlyPriceRials, c.YearlyPriceRials)
            .SetProperty(p => p.PerCarPriceRials, c.PerCarPriceRials)
            .SetProperty(p => p.SortOrder, c.SortOrder)
            .SetProperty(p => p.IsPublic, c.IsPublic), ct);
        if (changed == 0) return Result.Failure<PlanDto>(Error.NotFound("Plan.NotFound", "پلن یافت نشد."));

        if (c.Features is not null)
        {
            await _db.PlanFeatures.Where(f => f.PlanId == c.Id).ExecuteDeleteAsync(ct);
            _db.PlanFeatures.AddRange(c.Features
                .Where(f => !string.IsNullOrWhiteSpace(f.Key))
                .Select(f => PlanFeature.Create(c.Id, f.Key, f.Value ?? string.Empty)));
            await _db.SaveChangesAsync(ct);
        }

        var updated = await _db.Plans.AsNoTracking().Include(p => p.Features).FirstAsync(p => p.Id == c.Id, ct);
        return Result.Success(PlanMap.ToDto(updated));
    }
}

public sealed record SetPlanActiveCommand(Guid Id, bool IsActive) : IRequest<Result>, ITransactionalRequest;
public sealed class SetPlanActiveHandler : IRequestHandler<SetPlanActiveCommand, Result>
{
    private readonly IAppDbContext _db;
    public SetPlanActiveHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(SetPlanActiveCommand c, CancellationToken ct)
    {
        var p = await _db.Plans.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (p is null) return Result.Failure(Error.NotFound("Plan.NotFound", "پلن یافت نشد."));
        if (c.IsActive) p.Activate(); else p.Deactivate();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
