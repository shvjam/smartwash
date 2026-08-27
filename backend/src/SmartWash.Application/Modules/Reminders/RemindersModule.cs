using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reminders;

public sealed record ReminderDto(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    string CustomerPhone,
    Guid? VehicleId,
    string? VehiclePlate,
    string Title,
    DateTime DueAtUtc,
    ReminderType Type,
    ReminderStatus Status,
    DateTime? SentAtUtc,
    DateTime CreatedAtUtc);

public sealed record ListRemindersQuery(ReminderStatus? Status, Guid? CustomerId, int Page, int PageSize)
    : IRequest<Result<PagedList<ReminderDto>>>;

public sealed class ListRemindersHandler : IRequestHandler<ListRemindersQuery, Result<PagedList<ReminderDto>>>
{
    private readonly IAppDbContext _db;
    public ListRemindersHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<ReminderDto>>> Handle(ListRemindersQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);

        var query =
            from r in _db.ServiceReminders.AsNoTracking()
            join c in _db.Customers.AsNoTracking() on r.CustomerId equals c.Id
            join v in _db.CustomerVehicles.AsNoTracking() on r.VehicleId equals v.Id into vj
            from v in vj.DefaultIfEmpty()
            select new { r, c, v };

        if (q.Status.HasValue) query = query.Where(x => x.r.Status == q.Status.Value);
        if (q.CustomerId.HasValue) query = query.Where(x => x.r.CustomerId == q.CustomerId.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(x => x.r.Status)
            .ThenBy(x => x.r.DueAtUtc)
            .Skip((page - 1) * size).Take(size)
            .Select(x => new ReminderDto(
                x.r.Id, x.r.CustomerId, x.c.FullName, x.c.Phone,
                x.r.VehicleId, x.v != null ? x.v.Plate : null,
                x.r.Title, x.r.DueAtUtc, x.r.Type, x.r.Status, x.r.SentAtUtc, x.r.CreatedAtUtc))
            .ToListAsync(ct);

        return Result.Success(new PagedList<ReminderDto>(items, page, size, total));
    }
}

public sealed record CreateReminderCommand(Guid CustomerId, Guid? VehicleId, string Title, DateTime DueAtUtc, ReminderType Type)
    : IRequest<Result<ReminderDto>>, ITransactionalRequest;

public sealed class CreateReminderValidator : AbstractValidator<CreateReminderCommand>
{
    public CreateReminderValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.DueAtUtc).GreaterThan(DateTime.UtcNow.AddMinutes(-1));
    }
}

public sealed class CreateReminderHandler : IRequestHandler<CreateReminderCommand, Result<ReminderDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public CreateReminderHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }

    public async Task<Result<ReminderDto>> Handle(CreateReminderCommand c, CancellationToken ct)
    {
        var tenantId = _tenant.TenantId ?? Guid.Empty;
        if (tenantId == Guid.Empty)
            return Result.Failure<ReminderDto>(Error.Forbidden("Tenant.Missing", "مستاجر تعیین نشده است."));

        var customer = await _db.Customers.FirstOrDefaultAsync(x => x.Id == c.CustomerId, ct);
        if (customer is null) return Result.Failure<ReminderDto>(Error.NotFound("Customer.NotFound", "مشتری یافت نشد."));

        string? plate = null;
        if (c.VehicleId.HasValue)
        {
            var v = await _db.CustomerVehicles.FirstOrDefaultAsync(x => x.Id == c.VehicleId.Value && x.CustomerId == c.CustomerId, ct);
            if (v is null) return Result.Failure<ReminderDto>(Error.NotFound("Vehicle.NotFound", "خودرو یافت نشد."));
            plate = v.Plate;
        }

        var r = new ServiceReminder(tenantId, c.CustomerId, c.VehicleId, c.Title.Trim(), c.DueAtUtc, c.Type);
        _db.ServiceReminders.Add(r);
        await _db.SaveChangesAsync(ct);

        return Result.Success(new ReminderDto(
            r.Id, r.CustomerId, customer.FullName, customer.Phone,
            r.VehicleId, plate, r.Title, r.DueAtUtc, r.Type, r.Status, r.SentAtUtc, r.CreatedAtUtc));
    }
}

public sealed record CancelReminderCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;

public sealed class CancelReminderHandler : IRequestHandler<CancelReminderCommand, Result>
{
    private readonly IAppDbContext _db;
    public CancelReminderHandler(IAppDbContext db) => _db = db;

    public async Task<Result> Handle(CancelReminderCommand c, CancellationToken ct)
    {
        var r = await _db.ServiceReminders.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (r is null) return Result.Failure(Error.NotFound("Reminder.NotFound", "یادآور یافت نشد."));
        r.Cancel();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── ارسال فوری یادآور پیامکی ──────────────────────────────────────────────
public sealed record SendReminderNowCommand(Guid ReminderId) : IRequest<Result>, ITransactionalRequest;

public sealed class SendReminderNowHandler : IRequestHandler<SendReminderNowCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ISmsDispatcher _sms;
    public SendReminderNowHandler(IAppDbContext db, ISmsDispatcher sms) { _db = db; _sms = sms; }

    public async Task<Result> Handle(SendReminderNowCommand c, CancellationToken ct)
    {
        var r = await _db.ServiceReminders.FirstOrDefaultAsync(x => x.Id == c.ReminderId, ct);
        if (r is null)
            return Result.Failure(Error.NotFound("Reminder.NotFound", "یادآور یافت نشد."));
        if (r.Status == ReminderStatus.Sent)
            return Result.Failure(Error.Conflict("Reminder.AlreadySent", "این یادآور قبلاً ارسال شده است."));
        if (r.Status == ReminderStatus.Cancelled)
            return Result.Failure(Error.Conflict("Reminder.Cancelled", "یادآور لغو شده است."));

        var customer = await _db.Customers.FirstOrDefaultAsync(x => x.Id == r.CustomerId, ct);
        if (customer is null || string.IsNullOrWhiteSpace(customer.Phone))
            return Result.Failure(Error.Validation("Reminder.NoPhone", "شماره تلفن مشتری موجود نیست."));

        var settings = await _db.TenantSettings.FirstOrDefaultAsync(ct);
        if (settings is not { SmsEnabled: true })
            return Result.Failure(Error.Validation("Sms.Disabled", "سرویس پیامک در تنظیمات غیرفعال است."));

        var body = $"SmartWash: {r.Title}";
        // ارسال از دروازه‌ی مرکزی: سهمیه‌ی پلن، مجوز قالب و ثبت رخداد همه اینجا اعمال می‌شوند.
        var outcome = await _sms.SendAsync(new SmsSendRequest(r.TenantId, "NextWashReminder", customer.Phone,
            new Dictionary<string, string> { ["title"] = r.Title }, body), ct);
        if (!outcome.Sent)
            return Result.Failure(Error.Validation("Sms.SendFailed", outcome.Error ?? "ارسال پیامک ناموفق بود."));

        r.MarkSent();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
