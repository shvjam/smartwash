using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Bays;

public sealed record BayDto(Guid Id, Guid BranchId, string Name, int Number, BayStatus Status, Guid? CurrentOrderId, string? Notes, bool IsActive);
public static class BayMap
{
    public static BayDto ToDto(Bay b) => new(b.Id, b.BranchId, b.Name, b.Number, b.Status, b.CurrentOrderId, b.Notes, b.IsActive);
}

public sealed record ListBaysQuery(Guid? BranchId, bool OnlyActive) : IRequest<Result<IReadOnlyList<BayDto>>>;
public sealed class ListBaysHandler : IRequestHandler<ListBaysQuery, Result<IReadOnlyList<BayDto>>>
{
    private readonly IAppDbContext _db;
    public ListBaysHandler(IAppDbContext db) => _db = db;
    public async Task<Result<IReadOnlyList<BayDto>>> Handle(ListBaysQuery q, CancellationToken ct)
    {
        var query = _db.Bays.AsNoTracking().AsQueryable();
        if (q.BranchId.HasValue) query = query.Where(x => x.BranchId == q.BranchId.Value);
        if (q.OnlyActive) query = query.Where(x => x.IsActive);
        var items = await query.OrderBy(x => x.BranchId).ThenBy(x => x.Number).ToListAsync(ct);
        return Result.Success<IReadOnlyList<BayDto>>(items.Select(BayMap.ToDto).ToArray());
    }
}

public sealed record CreateBayCommand(Guid BranchId, string Name, int Number) : IRequest<Result<BayDto>>, ITransactionalRequest;
public sealed class CreateBayValidator : AbstractValidator<CreateBayCommand>
{
    public CreateBayValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Number).GreaterThan(0);
    }
}
public sealed class CreateBayHandler : IRequestHandler<CreateBayCommand, Result<BayDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantFeatureService _features;
    public CreateBayHandler(IAppDbContext db, ITenantFeatureService features) { _db = db; _features = features; }
    public async Task<Result<BayDto>> Handle(CreateBayCommand c, CancellationToken ct)
    {
        if (!await _db.Branches.AnyAsync(x => x.Id == c.BranchId, ct))
            return Result.Failure<BayDto>(Error.NotFound("Branch.NotFound", "شعبه یافت نشد."));
        if (await _db.Bays.AnyAsync(x => x.BranchId == c.BranchId && x.Number == c.Number, ct))
            return Result.Failure<BayDto>(Error.Conflict("Bay.NumberTaken", "شماره جایگاه تکراری است."));
        var limit = await _features.GetLimitAsync("max_bays", ct);
        if (limit.HasValue)
        {
            var count = await _db.Bays.CountAsync(ct);
            if (count >= limit.Value)
                return Result.Failure<BayDto>(Error.Conflict("Quota.Exceeded", $"سقف تعداد جایگاه‌های پلن ({limit.Value}) پر شده است."));
        }
        var b = Bay.Create(Guid.Empty, c.BranchId, c.Name, c.Number);
        _db.Bays.Add(b);
        await _db.SaveChangesAsync(ct);
        return BayMap.ToDto(b);
    }
}

public sealed record UpdateBayCommand(Guid Id, string Name, int Number, string? Notes) : IRequest<Result<BayDto>>, ITransactionalRequest;
public sealed class UpdateBayHandler : IRequestHandler<UpdateBayCommand, Result<BayDto>>
{
    private readonly IAppDbContext _db;
    public UpdateBayHandler(IAppDbContext db) => _db = db;
    public async Task<Result<BayDto>> Handle(UpdateBayCommand c, CancellationToken ct)
    {
        var b = await _db.Bays.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure<BayDto>(Error.NotFound("Bay.NotFound", "جایگاه یافت نشد."));
        // شماره جایگاه باید در سطحِ شعبه یکتا بماند؛ همان گاردِ CreateBay هنگام ویرایش هم لازم است.
        if (await _db.Bays.AnyAsync(x => x.BranchId == b.BranchId && x.Number == c.Number && x.Id != b.Id, ct))
            return Result.Failure<BayDto>(Error.Conflict("Bay.NumberTaken", "شماره جایگاه تکراری است."));
        b.Update(c.Name, c.Number, c.Notes);
        await _db.SaveChangesAsync(ct);
        return BayMap.ToDto(b);
    }
}

public sealed record SetBayMaintenanceCommand(Guid Id, string? Notes) : IRequest<Result>, ITransactionalRequest;
public sealed class SetBayMaintenanceHandler : IRequestHandler<SetBayMaintenanceCommand, Result>
{
    private readonly IAppDbContext _db;
    public SetBayMaintenanceHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(SetBayMaintenanceCommand c, CancellationToken ct)
    {
        var b = await _db.Bays.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure(Error.NotFound("Bay.NotFound", "جایگاه یافت نشد."));
        b.EnterMaintenance(c.Notes);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record FreeBayCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class FreeBayHandler : IRequestHandler<FreeBayCommand, Result>
{
    private readonly IAppDbContext _db;
    public FreeBayHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(FreeBayCommand c, CancellationToken ct)
    {
        var b = await _db.Bays.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure(Error.NotFound("Bay.NotFound", "جایگاه یافت نشد."));
        b.Free();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
