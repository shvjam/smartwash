using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Exceptions;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Rosters;

public sealed record ShiftAssignmentDto(
    Guid Id, StaffRole Role,
    Guid? WorkerId, string? WorkerName, string? WorkerAvatarUrl,
    Guid? UserId, string? UserName,
    Guid? BayId, string? BayName,
    string? Note);

public sealed record ShiftRosterDto(
    Guid Id, Guid BranchId, DateOnly Date, string Name,
    TimeOnly StartsAt, TimeOnly EndsAt, string? Notes,
    int HeadCount,
    IReadOnlyList<ShiftAssignmentDto> Assignments);

// ─────────────────────────────────────────────────────────────────────────────

public sealed record ListRostersQuery(DateOnly FromDate, DateOnly ToDate, Guid? BranchId)
    : IRequest<Result<IReadOnlyList<ShiftRosterDto>>>;

/// <summary>
/// The rosters for a stretch of days, with every name filled in.
///
/// Names are resolved here rather than stored on the assignment because a roster is a plan for
/// the future: a worker renamed next week should show under their new name on a shift booked
/// today, unlike a settled payment, which must keep the name it was made out to.
/// </summary>
public sealed class ListRostersHandler : IRequestHandler<ListRostersQuery, Result<IReadOnlyList<ShiftRosterDto>>>
{
    private readonly IAppDbContext _db;
    public ListRostersHandler(IAppDbContext db) => _db = db;

    public async Task<Result<IReadOnlyList<ShiftRosterDto>>> Handle(ListRostersQuery q, CancellationToken ct)
    {
        var query = _db.ShiftRosters.AsNoTracking()
            .Include(r => r.Assignments)
            .Where(r => r.Date >= q.FromDate && r.Date <= q.ToDate);

        if (q.BranchId.HasValue) query = query.Where(r => r.BranchId == q.BranchId.Value);

        var rosters = await query.OrderBy(r => r.Date).ThenBy(r => r.StartsAt).ToListAsync(ct);
        if (rosters.Count == 0)
            return Result.Success<IReadOnlyList<ShiftRosterDto>>(Array.Empty<ShiftRosterDto>());

        var dto = await ToDtosAsync(_db, rosters, ct);
        return Result.Success(dto);
    }

    internal static async Task<IReadOnlyList<ShiftRosterDto>> ToDtosAsync(
        IAppDbContext db, IReadOnlyList<ShiftRoster> rosters, CancellationToken ct)
    {
        var assignments = rosters.SelectMany(r => r.Assignments).ToList();

        var workerIds = assignments.Where(a => a.WorkerId.HasValue).Select(a => a.WorkerId!.Value).Distinct().ToList();
        var userIds = assignments.Where(a => a.UserId.HasValue).Select(a => a.UserId!.Value).Distinct().ToList();
        var bayIds = assignments.Where(a => a.BayId.HasValue).Select(a => a.BayId!.Value).Distinct().ToList();

        var workers = await db.Workers.AsNoTracking()
            .Where(w => workerIds.Contains(w.Id))
            .Select(w => new { w.Id, w.FullName, w.AvatarUrl })
            .ToDictionaryAsync(w => w.Id, ct);
        var users = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = u.DisplayName })
            .ToDictionaryAsync(u => u.Id, ct);
        var bays = await db.Bays.AsNoTracking()
            .Where(b => bayIds.Contains(b.Id))
            .Select(b => new { b.Id, b.Name })
            .ToDictionaryAsync(b => b.Id, ct);

        return rosters.Select(r => new ShiftRosterDto(
            r.Id, r.BranchId, r.Date, r.Name, r.StartsAt, r.EndsAt, r.Notes, r.HeadCount,
            r.Assignments
                .OrderBy(a => a.Role)
                .Select(a => new ShiftAssignmentDto(
                    a.Id, a.Role,
                    a.WorkerId,
                    a.WorkerId.HasValue && workers.TryGetValue(a.WorkerId.Value, out var w) ? w.FullName : null,
                    a.WorkerId.HasValue && workers.TryGetValue(a.WorkerId.Value, out var w2) ? w2.AvatarUrl : null,
                    a.UserId,
                    a.UserId.HasValue && users.TryGetValue(a.UserId.Value, out var u) ? u.Name : null,
                    a.BayId,
                    a.BayId.HasValue && bays.TryGetValue(a.BayId.Value, out var b) ? b.Name : null,
                    a.Note))
                .ToArray()))
            .ToArray();
    }
}

// ─────────────────────────────────────────────────────────────────────────────

public sealed record CreateRosterCommand(Guid BranchId, DateOnly Date, string Name,
    TimeOnly StartsAt, TimeOnly EndsAt, string? Notes)
    : IRequest<Result<ShiftRosterDto>>, ITransactionalRequest;

public sealed class CreateRosterValidator : AbstractValidator<CreateRosterCommand>
{
    public CreateRosterValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class CreateRosterHandler : IRequestHandler<CreateRosterCommand, Result<ShiftRosterDto>>
{
    private readonly IAppDbContext _db;
    public CreateRosterHandler(IAppDbContext db) => _db = db;

    public async Task<Result<ShiftRosterDto>> Handle(CreateRosterCommand c, CancellationToken ct)
    {
        if (!await _db.Branches.AnyAsync(b => b.Id == c.BranchId, ct))
            return Result.Failure<ShiftRosterDto>(Error.NotFound("Branch.NotFound", "شعبه یافت نشد."));

        ShiftRoster roster;
        try
        {
            roster = ShiftRoster.Create(Guid.Empty, c.BranchId, c.Date, c.Name, c.StartsAt, c.EndsAt, c.Notes);
        }
        catch (DomainException ex)
        {
            return Result.Failure<ShiftRosterDto>(Error.Validation(ex.Code, ex.Message));
        }

        _db.ShiftRosters.Add(roster);
        await _db.SaveChangesAsync(ct);

        var dto = await ListRostersHandler.ToDtosAsync(_db, new[] { roster }, ct);
        return Result.Success(dto[0]);
    }
}

// ─────────────────────────────────────────────────────────────────────────────

public sealed record UpdateRosterCommand(Guid Id, string Name, TimeOnly StartsAt, TimeOnly EndsAt, string? Notes)
    : IRequest<Result<ShiftRosterDto>>, ITransactionalRequest;

public sealed class UpdateRosterHandler : IRequestHandler<UpdateRosterCommand, Result<ShiftRosterDto>>
{
    private readonly IAppDbContext _db;
    public UpdateRosterHandler(IAppDbContext db) => _db = db;

    public async Task<Result<ShiftRosterDto>> Handle(UpdateRosterCommand c, CancellationToken ct)
    {
        var roster = await _db.ShiftRosters.Include(r => r.Assignments).FirstOrDefaultAsync(r => r.Id == c.Id, ct);
        if (roster is null) return Result.Failure<ShiftRosterDto>(Error.NotFound("Roster.NotFound", "شیفت یافت نشد."));

        try { roster.Update(c.Name, c.StartsAt, c.EndsAt, c.Notes); }
        catch (DomainException ex) { return Result.Failure<ShiftRosterDto>(Error.Validation(ex.Code, ex.Message)); }

        await _db.SaveChangesAsync(ct);
        var dto = await ListRostersHandler.ToDtosAsync(_db, new[] { roster }, ct);
        return Result.Success(dto[0]);
    }
}

public sealed record DeleteRosterCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;

public sealed class DeleteRosterHandler : IRequestHandler<DeleteRosterCommand, Result>
{
    private readonly IAppDbContext _db;
    public DeleteRosterHandler(IAppDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteRosterCommand c, CancellationToken ct)
    {
        var roster = await _db.ShiftRosters.FirstOrDefaultAsync(r => r.Id == c.Id, ct);
        if (roster is null) return Result.Failure(Error.NotFound("Roster.NotFound", "شیفت یافت نشد."));
        _db.ShiftRosters.Remove(roster);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ─────────────────────────────────────────────────────────────────────────────

public sealed record AssignToRosterCommand(Guid RosterId, StaffRole Role,
    Guid? WorkerId, Guid? UserId, Guid? BayId, string? Note)
    : IRequest<Result<ShiftRosterDto>>, ITransactionalRequest;

public sealed class AssignToRosterHandler : IRequestHandler<AssignToRosterCommand, Result<ShiftRosterDto>>
{
    private readonly IAppDbContext _db;
    public AssignToRosterHandler(IAppDbContext db) => _db = db;

    public async Task<Result<ShiftRosterDto>> Handle(AssignToRosterCommand c, CancellationToken ct)
    {
        var roster = await _db.ShiftRosters.Include(r => r.Assignments).FirstOrDefaultAsync(r => r.Id == c.RosterId, ct);
        if (roster is null) return Result.Failure<ShiftRosterDto>(Error.NotFound("Roster.NotFound", "شیفت یافت نشد."));

        if (c.WorkerId.HasValue && !await _db.Workers.AnyAsync(w => w.Id == c.WorkerId.Value, ct))
            return Result.Failure<ShiftRosterDto>(Error.NotFound("Worker.NotFound", "پرسنل یافت نشد."));
        if (c.BayId.HasValue && !await _db.Bays.AnyAsync(b => b.Id == c.BayId.Value, ct))
            return Result.Failure<ShiftRosterDto>(Error.NotFound("Bay.NotFound", "جایگاه یافت نشد."));

        try { roster.Assign(c.Role, c.WorkerId, c.UserId, c.BayId, c.Note); }
        catch (DomainException ex) { return Result.Failure<ShiftRosterDto>(Error.Validation(ex.Code, ex.Message)); }

        await _db.SaveChangesAsync(ct);
        var dto = await ListRostersHandler.ToDtosAsync(_db, new[] { roster }, ct);
        return Result.Success(dto[0]);
    }
}

public sealed record UnassignFromRosterCommand(Guid RosterId, Guid AssignmentId)
    : IRequest<Result<ShiftRosterDto>>, ITransactionalRequest;

public sealed class UnassignFromRosterHandler : IRequestHandler<UnassignFromRosterCommand, Result<ShiftRosterDto>>
{
    private readonly IAppDbContext _db;
    public UnassignFromRosterHandler(IAppDbContext db) => _db = db;

    public async Task<Result<ShiftRosterDto>> Handle(UnassignFromRosterCommand c, CancellationToken ct)
    {
        var roster = await _db.ShiftRosters.Include(r => r.Assignments).FirstOrDefaultAsync(r => r.Id == c.RosterId, ct);
        if (roster is null) return Result.Failure<ShiftRosterDto>(Error.NotFound("Roster.NotFound", "شیفت یافت نشد."));

        try { roster.Unassign(c.AssignmentId); }
        catch (DomainException ex) { return Result.Failure<ShiftRosterDto>(Error.Validation(ex.Code, ex.Message)); }

        await _db.SaveChangesAsync(ct);
        var dto = await ListRostersHandler.ToDtosAsync(_db, new[] { roster }, ct);
        return Result.Success(dto[0]);
    }
}
