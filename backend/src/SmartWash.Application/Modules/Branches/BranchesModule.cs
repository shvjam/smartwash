using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Branches;

public sealed record BranchDto(Guid Id, string Name, string? Address, string? Phone, string? Latitude, string? Longitude, bool IsActive, bool IsDefault, DateTime CreatedAtUtc);

public static class BranchMap
{
    public static BranchDto ToDto(Branch b) => new(b.Id, b.Name, b.Address, b.Phone, b.Latitude, b.Longitude, b.IsActive, b.IsDefault, b.CreatedAtUtc);
}

public sealed record ListBranchesQuery(bool OnlyActive) : IRequest<Result<IReadOnlyList<BranchDto>>>;
public sealed class ListBranchesHandler : IRequestHandler<ListBranchesQuery, Result<IReadOnlyList<BranchDto>>>
{
    private readonly IAppDbContext _db;
    public ListBranchesHandler(IAppDbContext db) => _db = db;
    public async Task<Result<IReadOnlyList<BranchDto>>> Handle(ListBranchesQuery q, CancellationToken ct)
    {
        var query = _db.Branches.AsNoTracking().AsQueryable();
        if (q.OnlyActive) query = query.Where(x => x.IsActive);
        var items = await query.OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name).ToListAsync(ct);
        return Result.Success<IReadOnlyList<BranchDto>>(items.Select(BranchMap.ToDto).ToArray());
    }
}

public sealed record GetBranchQuery(Guid Id) : IRequest<Result<BranchDto>>;
public sealed class GetBranchHandler : IRequestHandler<GetBranchQuery, Result<BranchDto>>
{
    private readonly IAppDbContext _db;
    public GetBranchHandler(IAppDbContext db) => _db = db;
    public async Task<Result<BranchDto>> Handle(GetBranchQuery q, CancellationToken ct)
    {
        var b = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        return b is null ? Result.Failure<BranchDto>(Error.NotFound("Branch.NotFound", "شعبه یافت نشد.")) : BranchMap.ToDto(b);
    }
}

public sealed record CreateBranchCommand(string Name, string? Address, string? Phone, bool IsDefault) : IRequest<Result<BranchDto>>, ITransactionalRequest;
public sealed class CreateBranchValidator : AbstractValidator<CreateBranchCommand>
{
    public CreateBranchValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Phone).MaximumLength(20);
    }
}
public sealed class CreateBranchHandler : IRequestHandler<CreateBranchCommand, Result<BranchDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantFeatureService _features;
    public CreateBranchHandler(IAppDbContext db, ITenantFeatureService features) { _db = db; _features = features; }
    public async Task<Result<BranchDto>> Handle(CreateBranchCommand c, CancellationToken ct)
    {
        var limit = await _features.GetLimitAsync("limit.branches", ct);
        if (limit.HasValue)
        {
            var count = await _db.Branches.CountAsync(ct);
            if (count >= limit.Value)
                return Result.Failure<BranchDto>(Error.Conflict("Quota.Exceeded", $"سقف تعداد شعب پلن ({limit.Value}) پر شده است."));
        }
        var b = Branch.Create(Guid.Empty, c.Name, c.Address, c.Phone, c.IsDefault);
        _db.Branches.Add(b);
        if (c.IsDefault)
        {
            var others = await _db.Branches.Where(x => x.IsDefault).ToListAsync(ct);
            foreach (var o in others) o.UnsetDefault();
        }
        await _db.SaveChangesAsync(ct);
        return BranchMap.ToDto(b);
    }
}

public sealed record UpdateBranchCommand(Guid Id, string Name, string? Address, string? Phone, string? Latitude, string? Longitude) : IRequest<Result<BranchDto>>, ITransactionalRequest;
public sealed class UpdateBranchValidator : AbstractValidator<UpdateBranchCommand>
{
    public UpdateBranchValidator() { RuleFor(x => x.Name).NotEmpty().MaximumLength(120); }
}
public sealed class UpdateBranchHandler : IRequestHandler<UpdateBranchCommand, Result<BranchDto>>
{
    private readonly IAppDbContext _db;
    public UpdateBranchHandler(IAppDbContext db) => _db = db;
    public async Task<Result<BranchDto>> Handle(UpdateBranchCommand c, CancellationToken ct)
    {
        var b = await _db.Branches.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure<BranchDto>(Error.NotFound("Branch.NotFound", "شعبه یافت نشد."));
        b.Update(c.Name, c.Address, c.Phone, c.Latitude, c.Longitude);
        await _db.SaveChangesAsync(ct);
        return BranchMap.ToDto(b);
    }
}

public sealed record SetBranchActiveCommand(Guid Id, bool IsActive) : IRequest<Result>, ITransactionalRequest;
public sealed class SetBranchActiveHandler : IRequestHandler<SetBranchActiveCommand, Result>
{
    private readonly IAppDbContext _db;
    public SetBranchActiveHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(SetBranchActiveCommand c, CancellationToken ct)
    {
        var b = await _db.Branches.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure(Error.NotFound("Branch.NotFound", "شعبه یافت نشد."));
        if (c.IsActive) b.Activate(); else b.Deactivate();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record SetDefaultBranchCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class SetDefaultBranchHandler : IRequestHandler<SetDefaultBranchCommand, Result>
{
    private readonly IAppDbContext _db;
    public SetDefaultBranchHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(SetDefaultBranchCommand c, CancellationToken ct)
    {
        var b = await _db.Branches.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure(Error.NotFound("Branch.NotFound", "شعبه یافت نشد."));
        var others = await _db.Branches.Where(x => x.IsDefault && x.Id != c.Id).ToListAsync(ct);
        foreach (var o in others) o.UnsetDefault();
        b.SetAsDefault();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
