using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Workers;

public sealed record WorkerDto(Guid Id, Guid BranchId, Guid? UserId, string FullName, string Role, string? Phone, string? NationalId, string? AvatarUrl, decimal CommissionRate, bool IsActive, DateTime? HiredAtUtc, DateTime? TerminatedAtUtc);
public static class WorkerMap
{
    public static WorkerDto ToDto(Worker w) => new(w.Id, w.BranchId, w.UserId, w.FullName, w.Role, w.Phone, w.NationalId, w.AvatarUrl, w.CommissionRate, w.IsActive, w.HiredAtUtc, w.TerminatedAtUtc);
}

public sealed record ListWorkersQuery(Guid? BranchId, bool OnlyActive) : IRequest<Result<IReadOnlyList<WorkerDto>>>;
public sealed class ListWorkersHandler : IRequestHandler<ListWorkersQuery, Result<IReadOnlyList<WorkerDto>>>
{
    private readonly IAppDbContext _db;
    public ListWorkersHandler(IAppDbContext db) => _db = db;
    public async Task<Result<IReadOnlyList<WorkerDto>>> Handle(ListWorkersQuery q, CancellationToken ct)
    {
        var query = _db.Workers.AsNoTracking().AsQueryable();
        if (q.BranchId.HasValue) query = query.Where(x => x.BranchId == q.BranchId.Value);
        if (q.OnlyActive) query = query.Where(x => x.IsActive);
        var items = await query.OrderBy(x => x.FullName).ToListAsync(ct);
        return Result.Success<IReadOnlyList<WorkerDto>>(items.Select(WorkerMap.ToDto).ToArray());
    }
}

public sealed record CreateWorkerCommand(Guid BranchId, string FullName, string Role, string? Phone, decimal CommissionRate) : IRequest<Result<WorkerDto>>, ITransactionalRequest;
public sealed class CreateWorkerValidator : AbstractValidator<CreateWorkerCommand>
{
    public CreateWorkerValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Role).NotEmpty().MaximumLength(60);
        RuleFor(x => x.CommissionRate).InclusiveBetween(0m, 1m).WithMessage("نرخ کمیسیون باید کسری بین ۰ تا ۱ باشد (مثلاً ۰.۱ برای ۱۰٪).");
    }
}
public sealed class CreateWorkerHandler : IRequestHandler<CreateWorkerCommand, Result<WorkerDto>>
{
    private readonly IAppDbContext _db;
    public CreateWorkerHandler(IAppDbContext db) => _db = db;
    public async Task<Result<WorkerDto>> Handle(CreateWorkerCommand c, CancellationToken ct)
    {
        if (!await _db.Branches.AnyAsync(x => x.Id == c.BranchId, ct))
            return Result.Failure<WorkerDto>(Error.NotFound("Branch.NotFound", "شعبه یافت نشد."));
        var w = Worker.Create(Guid.Empty, c.BranchId, c.FullName, c.Role, c.Phone, c.CommissionRate);
        _db.Workers.Add(w);
        await _db.SaveChangesAsync(ct);
        return WorkerMap.ToDto(w);
    }
}

public sealed record UpdateWorkerCommand(Guid Id, string FullName, string Role, string? Phone, string? NationalId, decimal CommissionRate, string? AvatarUrl) : IRequest<Result<WorkerDto>>, ITransactionalRequest;
public sealed class UpdateWorkerHandler : IRequestHandler<UpdateWorkerCommand, Result<WorkerDto>>
{
    private readonly IAppDbContext _db;
    public UpdateWorkerHandler(IAppDbContext db) => _db = db;
    public async Task<Result<WorkerDto>> Handle(UpdateWorkerCommand c, CancellationToken ct)
    {
        var w = await _db.Workers.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (w is null) return Result.Failure<WorkerDto>(Error.NotFound("Worker.NotFound", "کارکن یافت نشد."));
        w.Update(c.FullName, c.Role, c.Phone, c.NationalId, c.CommissionRate, c.AvatarUrl);
        await _db.SaveChangesAsync(ct);
        return WorkerMap.ToDto(w);
    }
}

public sealed record SetWorkerActiveCommand(Guid Id, bool IsActive) : IRequest<Result>, ITransactionalRequest;
public sealed class SetWorkerActiveHandler : IRequestHandler<SetWorkerActiveCommand, Result>
{
    private readonly IAppDbContext _db;
    public SetWorkerActiveHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(SetWorkerActiveCommand c, CancellationToken ct)
    {
        var w = await _db.Workers.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (w is null) return Result.Failure(Error.NotFound("Worker.NotFound", "کارکن یافت نشد."));
        if (c.IsActive) w.Activate(); else w.Terminate();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
