using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Shifts;

public sealed record ShiftDto(Guid Id, Guid BranchId, Guid OpenedByUserId, Guid? ClosedByUserId,
    DateTime OpenedAtUtc, DateTime? ClosedAtUtc, long OpeningCashRials, long ClosingCashRials, long ExpectedCashRials,
    long CashSalesRials, long CardSalesRials, long OnlineSalesRials, long TipsRials, long WalletSalesRials,
    long ExpensesRials, int OrderCount,
    ShiftStatus Status, long Variance, string? Notes);

public static class ShiftMap
{
    public static ShiftDto ToDto(Shift s) => new(s.Id, s.BranchId, s.OpenedByUserId, s.ClosedByUserId,
        s.OpenedAtUtc, s.ClosedAtUtc, s.OpeningCashRials, s.ClosingCashRials, s.ExpectedCashRials,
        s.CashSalesRials, s.CardSalesRials, s.OnlineSalesRials, s.TipsRials, s.WalletSalesRials,
        s.ExpensesRials, s.OrderCount, s.Status, s.Variance, s.Notes);
}

public sealed record GetOpenShiftQuery(Guid BranchId) : IRequest<Result<ShiftDto?>>;
public sealed class GetOpenShiftHandler : IRequestHandler<GetOpenShiftQuery, Result<ShiftDto?>>
{
    private readonly IAppDbContext _db;
    public GetOpenShiftHandler(IAppDbContext db) => _db = db;
    public async Task<Result<ShiftDto?>> Handle(GetOpenShiftQuery q, CancellationToken ct)
    {
        var s = await _db.Shifts.AsNoTracking().FirstOrDefaultAsync(x => x.BranchId == q.BranchId && x.Status == ShiftStatus.Open, ct);
        return Result.Success<ShiftDto?>(s is null ? null : ShiftMap.ToDto(s));
    }
}

public sealed record OpenShiftCommand(Guid BranchId, long OpeningCashRials) : IRequest<Result<ShiftDto>>, ITransactionalRequest;
public sealed class OpenShiftValidator : AbstractValidator<OpenShiftCommand>
{
    public OpenShiftValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.OpeningCashRials).GreaterThanOrEqualTo(0);
    }
}
public sealed class OpenShiftHandler : IRequestHandler<OpenShiftCommand, Result<ShiftDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _user;
    public OpenShiftHandler(IAppDbContext db, ICurrentUser user) { _db = db; _user = user; }
    public async Task<Result<ShiftDto>> Handle(OpenShiftCommand c, CancellationToken ct)
    {
        if (!_user.UserId.HasValue) return Result.Failure<ShiftDto>(Error.Unauthorized("Shift.NoUser", "کاربر شناسایی نشد."));
        if (await _db.Shifts.AnyAsync(s => s.BranchId == c.BranchId && s.Status == ShiftStatus.Open, ct))
            return Result.Failure<ShiftDto>(Error.Conflict("Shift.AlreadyOpen", "یک شیفت باز برای این شعبه وجود دارد."));
        var s = Shift.Open(Guid.Empty, c.BranchId, _user.UserId.Value, c.OpeningCashRials);
        _db.Shifts.Add(s);
        await _db.SaveChangesAsync(ct);
        return ShiftMap.ToDto(s);
    }
}

public sealed record CloseShiftCommand(Guid Id, long ClosingCashRials, string? Notes) : IRequest<Result<ShiftDto>>, ITransactionalRequest;
public sealed class CloseShiftValidator : AbstractValidator<CloseShiftCommand>
{
    public CloseShiftValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.ClosingCashRials).GreaterThanOrEqualTo(0);
    }
}
public sealed class CloseShiftHandler : IRequestHandler<CloseShiftCommand, Result<ShiftDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _user;
    public CloseShiftHandler(IAppDbContext db, ICurrentUser user) { _db = db; _user = user; }
    public async Task<Result<ShiftDto>> Handle(CloseShiftCommand c, CancellationToken ct)
    {
        if (!_user.UserId.HasValue) return Result.Failure<ShiftDto>(Error.Unauthorized("Shift.NoUser", "کاربر شناسایی نشد."));
        var s = await _db.Shifts.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (s is null) return Result.Failure<ShiftDto>(Error.NotFound("Shift.NotFound", "شیفت یافت نشد."));
        s.Close(_user.UserId.Value, c.ClosingCashRials, c.Notes);
        await _db.SaveChangesAsync(ct);
        return ShiftMap.ToDto(s);
    }
}
// resync-marker
