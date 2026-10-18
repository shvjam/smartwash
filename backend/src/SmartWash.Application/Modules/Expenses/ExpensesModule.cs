using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Expenses;

public sealed record ExpenseDto(Guid Id, Guid BranchId, ExpenseCategory Category, string Title, long AmountRials,
    PaymentMethod PaymentMethod, DateOnly Date, string? Description, string? ReceiptUrl, Guid? RelatedWorkerId);

public static class ExpenseMap
{
    public static ExpenseDto ToDto(Expense e) => new(e.Id, e.BranchId, e.Category, e.Title, e.AmountRials,
        e.PaymentMethod, e.Date, e.Description, e.ReceiptUrl, e.RelatedWorkerId);
}

public sealed record SearchExpensesQuery(Guid? BranchId, ExpenseCategory? Category, DateOnly? FromDate, DateOnly? ToDate, int Page, int PageSize)
    : IRequest<Result<PagedList<ExpenseDto>>>;
public sealed class SearchExpensesHandler : IRequestHandler<SearchExpensesQuery, Result<PagedList<ExpenseDto>>>
{
    private readonly IAppDbContext _db;
    public SearchExpensesHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<ExpenseDto>>> Handle(SearchExpensesQuery q, CancellationToken ct)
    {
        var query = _db.Expenses.AsNoTracking().AsQueryable();
        if (q.BranchId.HasValue) query = query.Where(x => x.BranchId == q.BranchId.Value);
        if (q.Category.HasValue) query = query.Where(x => x.Category == q.Category.Value);
        if (q.FromDate.HasValue) query = query.Where(x => x.Date >= q.FromDate.Value);
        if (q.ToDate.HasValue) query = query.Where(x => x.Date <= q.ToDate.Value);
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.Date).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return Result.Success(new PagedList<ExpenseDto>(items.Select(ExpenseMap.ToDto).ToArray(), page, size, total));
    }
}

public sealed record CreateExpenseCommand(Guid BranchId, ExpenseCategory Category, string Title, long AmountRials,
    PaymentMethod PaymentMethod, DateOnly Date, string? Description, Guid? RelatedWorkerId) : IRequest<Result<ExpenseDto>>, ITransactionalRequest;

public sealed class CreateExpenseValidator : AbstractValidator<CreateExpenseCommand>
{
    public CreateExpenseValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AmountRials).GreaterThan(0);
    }
}

public sealed class CreateExpenseHandler : IRequestHandler<CreateExpenseCommand, Result<ExpenseDto>>
{
    private readonly IAppDbContext _db;
    public CreateExpenseHandler(IAppDbContext db) => _db = db;
    public async Task<Result<ExpenseDto>> Handle(CreateExpenseCommand c, CancellationToken ct)
    {
        var e = Expense.Create(Guid.Empty, c.BranchId, c.Category, c.Title, c.AmountRials, c.PaymentMethod, c.Date, c.Description, c.RelatedWorkerId);
        _db.Expenses.Add(e);

        // فقط هزینه‌ی نقدی از صندوقِ نقدی شیفت کم می‌شود؛ هزینه‌ی کارتی/آنلاین واریانس صندوق را جابه‌جا نمی‌کند.
        if (c.PaymentMethod == PaymentMethod.Cash)
        {
            var openShift = await _db.Shifts.Where(s => s.BranchId == c.BranchId && s.Status == ShiftStatus.Open).FirstOrDefaultAsync(ct);
            openShift?.RegisterExpense(c.AmountRials);
        }

        await _db.SaveChangesAsync(ct);
        return ExpenseMap.ToDto(e);
    }
}

public sealed record UpdateExpenseCommand(Guid Id, ExpenseCategory Category, string Title, long AmountRials,
    PaymentMethod PaymentMethod, DateOnly Date, string? Description) : IRequest<Result<ExpenseDto>>, ITransactionalRequest;
public sealed class UpdateExpenseHandler : IRequestHandler<UpdateExpenseCommand, Result<ExpenseDto>>
{
    private readonly IAppDbContext _db;
    public UpdateExpenseHandler(IAppDbContext db) => _db = db;
    public async Task<Result<ExpenseDto>> Handle(UpdateExpenseCommand c, CancellationToken ct)
    {
        var e = await _db.Expenses.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (e is null) return Result.Failure<ExpenseDto>(Error.NotFound("Expense.NotFound", "هزینه یافت نشد."));

        // سهمِ نقدیِ قبلی و جدیدِ این هزینه در صندوقِ شیفت را پیش از تغییر محاسبه می‌کنیم
        // تا واریانسِ صندوقِ شیفتِ باز پس از ویرایش (تغییر مبلغ یا روشِ پرداخت) دقیق بماند.
        var oldCashContribution = e.PaymentMethod == PaymentMethod.Cash ? e.AmountRials : 0;
        var newCashContribution = c.PaymentMethod == PaymentMethod.Cash ? c.AmountRials : 0;
        var branchId = e.BranchId;

        e.Update(c.Category, c.Title, c.AmountRials, c.PaymentMethod, c.Date, c.Description);

        var delta = newCashContribution - oldCashContribution;
        if (delta != 0)
        {
            var shift = await ExpenseShift.OwningOpenShiftAsync(_db, e, ct);
            shift?.AdjustExpense(delta);
        }

        await _db.SaveChangesAsync(ct);
        return ExpenseMap.ToDto(e);
    }
}

public sealed record DeleteExpenseCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class DeleteExpenseHandler : IRequestHandler<DeleteExpenseCommand, Result>
{
    private readonly IAppDbContext _db;
    public DeleteExpenseHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(DeleteExpenseCommand c, CancellationToken ct)
    {
        var e = await _db.Expenses.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (e is null) return Result.Failure(Error.NotFound("Expense.NotFound", "هزینه یافت نشد."));

        // A cash expense took money out of the till; removing it puts that money back in the
        // shift it came out of — but only while that shift is still open. A closed shift has
        // already been counted and signed off, and rewriting it would make its variance lie.
        if (e.PaymentMethod == PaymentMethod.Cash)
        {
            var shift = await ExpenseShift.OwningOpenShiftAsync(_db, e, ct);
            shift?.AdjustExpense(-e.AmountRials);
        }

        _db.Expenses.Remove(e);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

/// <summary>
/// The open shift an expense was recorded in, if it is still open.
///
/// Editing or deleting an expense has to correct the till it came out of. The first version
/// corrected whichever shift happened to be open at the time of the edit, so changing an
/// expense from last week moved today's cash variance by the difference — a till that was
/// right in the morning became wrong without anyone touching it. An expense belongs to the
/// shift that was open when it was recorded, and only that one.
/// </summary>
internal static class ExpenseShift
{
    public static Task<Shift?> OwningOpenShiftAsync(IAppDbContext db, Expense e, CancellationToken ct) =>
        db.Shifts
            .Where(s => s.BranchId == e.BranchId && s.Status == ShiftStatus.Open && s.OpenedAtUtc <= e.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);
}
// resync-marker
