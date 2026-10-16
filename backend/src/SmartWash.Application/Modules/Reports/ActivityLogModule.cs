using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reports;

public sealed record ActivityLogRow(
    Guid Id,
    DateTime AtUtc,
    Guid? UserId,
    string UserName,
    string Action,
    string ActionLabel,
    string EntityName,
    string EntityId,
    string? IpAddress);

public sealed record GetActivityLogQuery(
    DateOnly FromDate, DateOnly ToDate, Guid? UserId, string? EntityName, int Page, int PageSize)
    : IRequest<Result<PagedList<ActivityLogRow>>>;

/// <summary>
/// What the people with logins actually did, for the carwash's own manager.
///
/// The audit table has existed from the start and a platform-level endpoint could already read
/// it, but the carwash manager — the person who actually needs to know which cashier changed an
/// invoice — had no way to see any of it. That is the question the manager asked, in those
/// words, and it needed both this and the behaviour that finally writes the entries.
/// </summary>
public sealed class GetActivityLogHandler : IRequestHandler<GetActivityLogQuery, Result<PagedList<ActivityLogRow>>>
{
    private readonly IAppDbContext _db;
    public GetActivityLogHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<ActivityLogRow>>> Handle(GetActivityLogQuery q, CancellationToken ct)
    {
        var from = q.FromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = q.ToDate.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);

        var query = _db.AuditLogs.AsNoTracking()
            .Where(a => a.OccurredAtUtc >= from && a.OccurredAtUtc <= to);

        if (q.UserId.HasValue) query = query.Where(a => a.UserId == q.UserId.Value);
        if (!string.IsNullOrWhiteSpace(q.EntityName)) query = query.Where(a => a.EntityName == q.EntityName);

        var total = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(a => a.OccurredAtUtc)
            .Skip((page - 1) * size).Take(size)
            .Select(a => new { a.Id, a.OccurredAtUtc, a.UserId, a.Action, a.EntityName, a.EntityId, a.IpAddress })
            .ToListAsync(ct);

        var userIds = rows.Where(r => r.UserId.HasValue).Select(r => r.UserId!.Value).Distinct().ToList();
        var users = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        var items = rows.Select(r => new ActivityLogRow(
            r.Id, r.OccurredAtUtc, r.UserId,
            r.UserId.HasValue && users.TryGetValue(r.UserId.Value, out var name) ? name : "سیستم",
            r.Action, Label(r.Action), r.EntityName, r.EntityId, r.IpAddress))
            .ToArray();

        return Result.Success(new PagedList<ActivityLogRow>(items, page, size, total));
    }

    /// <summary>
    /// The command name in Persian, so the screen reads as a sentence rather than as code.
    ///
    /// Anything unrecognised falls through as its own name: a new command showing up untranslated
    /// is far better than one silently missing from the log.
    /// </summary>
    private static string Label(string action) => action switch
    {
        "CreateOrder" => "ایجاد سفارش",
        "CompleteOrder" => "تکمیل سفارش",
        "CancelOrder" => "لغو سفارش",
        "AdvanceOrderStage" => "تغییر مرحله سفارش",
        "AddOrderLine" => "افزودن خدمت به سفارش",
        "RemoveOrderLine" => "حذف خدمت از سفارش",
        "AddOrderPayment" => "ثبت پرداخت",
        "ApplyOrderDiscount" => "اعمال تخفیف",
        "CreateCustomer" => "ایجاد مشتری",
        "UpdateCustomer" => "ویرایش مشتری",
        "CreateWorker" => "افزودن پرسنل",
        "UpdateWorker" => "ویرایش پرسنل",
        "CreateService" => "افزودن خدمت",
        "UpdateService" => "ویرایش خدمت",
        "CreateBay" => "ایجاد جایگاه",
        "UpdateBay" => "ویرایش جایگاه",
        "SetBayMaintenance" => "ارسال جایگاه به تعمیرات",
        "FreeBay" => "آزادسازی جایگاه",
        "CreateRoster" => "ایجاد شیفت",
        "AssignToRoster" => "افزودن نفر به شیفت",
        "UnassignFromRoster" => "حذف نفر از شیفت",
        "SettleTips" => "تسویه انعام",
        "OpenShift" => "باز کردن صندوق",
        "CloseShift" => "بستن صندوق",
        "CreateExpense" => "ثبت هزینه",
        _ => action,
    };
}
