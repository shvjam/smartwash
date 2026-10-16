using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Bays;

using static SmartWash.Application.Modules.Bays.BayDowntimeTracking;

public sealed record BayDto(Guid Id, Guid BranchId, string Name, int Number, BayType Type,
    int ServiceCapacity, int QueueCapacity, BayStatus Status, Guid? CurrentOrderId, string? Notes, bool IsActive,
    /// <summary>Cars currently waiting for this kind of bay.</summary>
    int QueueLength);
public static class BayMap
{
    public static BayDto ToDto(Bay b, int queueLength = 0) => new(b.Id, b.BranchId, b.Name, b.Number, b.Type,
        b.ServiceCapacity, b.QueueCapacity, b.Status, b.CurrentOrderId, b.Notes, b.IsActive, queueLength);
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

        // A queue belongs to a kind of bay rather than to one bay: cars wait for "a wash bay",
        // not for bay 3 specifically, and whichever frees up first takes the next one.
        var waiting = await _db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.InProgress
                        && (o.Stage == OrderStage.QueuedForWash || o.Stage == OrderStage.QueuedForDry))
            .Select(o => new { o.BranchId, o.Stage })
            .ToListAsync(ct);

        var queueByBranchAndType = waiting
            .GroupBy(w => new { w.BranchId, Type = w.Stage == OrderStage.QueuedForWash ? BayType.Wash : BayType.Dry })
            .ToDictionary(g => g.Key, g => g.Count());

        int QueueFor(Bay b)
            => queueByBranchAndType.TryGetValue(new { b.BranchId, b.Type }, out var n) ? n : 0;

        return Result.Success<IReadOnlyList<BayDto>>(items.Select(b => BayMap.ToDto(b, QueueFor(b))).ToArray());
    }
}

public sealed record CreateBayCommand(Guid BranchId, string Name, int Number,
    BayType Type, int ServiceCapacity, int QueueCapacity) : IRequest<Result<BayDto>>, ITransactionalRequest;
public sealed class CreateBayValidator : AbstractValidator<CreateBayCommand>
{
    public CreateBayValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Number).GreaterThan(0);
        RuleFor(x => x.ServiceCapacity).InclusiveBetween(1, 20);
        RuleFor(x => x.QueueCapacity).InclusiveBetween(0, 100);
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
        var b = Bay.Create(Guid.Empty, c.BranchId, c.Name, c.Number, c.Type, c.ServiceCapacity, c.QueueCapacity);
        _db.Bays.Add(b);
        await _db.SaveChangesAsync(ct);
        return BayMap.ToDto(b);
    }
}

public sealed record UpdateBayCommand(Guid Id, string Name, int Number, string? Notes,
    BayType? Type, int? ServiceCapacity, int? QueueCapacity) : IRequest<Result<BayDto>>, ITransactionalRequest;
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
        b.Update(c.Name, c.Number, c.Notes, c.Type, c.ServiceCapacity, c.QueueCapacity);
        await _db.SaveChangesAsync(ct);
        return BayMap.ToDto(b);
    }
}

public sealed record SetBayMaintenanceCommand(Guid Id, string? Notes) : IRequest<Result>, ITransactionalRequest;
public sealed class SetBayMaintenanceHandler : IRequestHandler<SetBayMaintenanceCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public SetBayMaintenanceHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }
    public async Task<Result> Handle(SetBayMaintenanceCommand c, CancellationToken ct)
    {
        var b = await _db.Bays.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure(Error.NotFound("Bay.NotFound", "جایگاه یافت نشد."));
        b.EnterMaintenance(c.Notes);
        await OpenDowntimeAsync(_db, b, BayDowntimeReason.Maintenance, c.Notes, _currentUser.UserId, ct);
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
        var wasDown = b.Status == BayStatus.Maintenance;
        b.Free();
        if (wasDown) await CloseDowntimeAsync(_db, b.Id, ct);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
/// <summary>
/// Opening and closing the record of a bay being out of use.
///
/// Kept beside the handlers that change a bay's status rather than inside the entity, because
/// a downtime spans two separate operations minutes or days apart and an aggregate cannot see
/// the earlier one without being handed it.
/// </summary>
public static class BayDowntimeTracking
{
    public static async Task OpenDowntimeAsync(IAppDbContext db, Bay bay, BayDowntimeReason reason,
        string? note, Guid? byUserId, CancellationToken ct)
    {
        // A bay already recorded as down must not collect a second open period, or the minutes
        // lost would be counted twice in the report.
        var alreadyOpen = await db.BayDowntimes.AnyAsync(d => d.BayId == bay.Id && d.ToUtc == null, ct);
        if (alreadyOpen) return;
        db.BayDowntimes.Add(new BayDowntime(bay.Id, bay.TenantId, reason, note, byUserId));
    }

    public static async Task CloseDowntimeAsync(IAppDbContext db, Guid bayId, CancellationToken ct)
    {
        var open = await db.BayDowntimes.FirstOrDefaultAsync(d => d.BayId == bayId && d.ToUtc == null, ct);
        open?.Close();
    }
}
// resync-marker
