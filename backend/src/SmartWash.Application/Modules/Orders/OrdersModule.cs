using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Exceptions;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Orders;

public sealed record OrderLineDto(Guid Id, Guid ServiceId, string ServiceName, long UnitPriceRials, int Quantity, int DurationMinutes, long LineTotalRials, Guid? WorkerId, string? WorkerName, decimal WorkerCommissionRate, long WorkerCommissionRials, long TipRials);
public sealed record OrderPaymentDto(Guid Id, PaymentMethod Method, long AmountRials, string? Reference, DateTime PaidAtUtc);
public sealed record OrderDto(Guid Id, Guid BranchId, string Number, Guid? BayId, Guid? CustomerId, string CustomerName, string? CustomerPhone, string VehiclePlate, string? VehicleBrand, string? VehicleModel,
    OrderStatus Status, OrderStage Stage, OrderSource Source, DateTime StartedAtUtc, DateTime? CompletedAtUtc,
    DateTime? WashStartedAtUtc, DateTime? WashCompletedAtUtc, long OutstandingRials,
    Guid? CurrentBayId, int? QueuePosition, int ExpectedDurationMinutes,
    long SubtotalRials, long DiscountRials, long WalletUsedRials, int LoyaltyPointsUsed, long TotalRials, long PaidRials, PaymentMethod? FinalPaymentMethod, string? Notes,
    IReadOnlyList<OrderLineDto> Lines, IReadOnlyList<OrderPaymentDto> Payments,
    IReadOnlyList<OrderStageEventDto> StageEvents);

public sealed record OrderStageEventDto(OrderStage Stage, DateTime AtUtc, string? Note);

public static class OrderMap
{
    public static OrderDto ToDto(Order o) => new(o.Id, o.BranchId, o.Number, o.BayId, o.CustomerId, o.CustomerName, o.CustomerPhone, o.VehiclePlate, o.VehicleBrand, o.VehicleModel,
        o.Status, o.Stage, o.Source, o.StartedAtUtc, o.CompletedAtUtc,
        o.WashStartedAtUtc, o.WashCompletedAtUtc, o.OutstandingRials,
        o.CurrentBayId, o.QueuePosition, o.ExpectedDurationMinutes,
        o.SubtotalRials, o.DiscountRials, o.WalletUsedRials, o.LoyaltyPointsUsed, o.TotalRials, o.PaidRials, o.FinalPaymentMethod, o.Notes,
        o.Lines.Select(l => new OrderLineDto(l.Id, l.ServiceId, l.ServiceName, l.UnitPriceRials, l.Quantity, l.DurationMinutes, l.LineTotalRials, l.WorkerId, l.WorkerName, l.WorkerCommissionRate, l.WorkerCommissionRials, l.TipRials)).ToArray(),
        o.Payments.Select(p => new OrderPaymentDto(p.Id, p.Method, p.AmountRials, p.Reference, p.PaidAtUtc)).ToArray(),
        o.StageEvents.OrderBy(e => e.AtUtc).Select(e => new OrderStageEventDto(e.Stage, e.AtUtc, e.Note)).ToArray());
}

public sealed record SearchOrdersQuery(Guid? BranchId, OrderStatus? Status, DateTime? FromUtc, DateTime? ToUtc, string? Search, int Page, int PageSize) : IRequest<Result<PagedList<OrderDto>>>;
public sealed class SearchOrdersHandler : IRequestHandler<SearchOrdersQuery, Result<PagedList<OrderDto>>>
{
    private readonly IAppDbContext _db;
    public SearchOrdersHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<OrderDto>>> Handle(SearchOrdersQuery q, CancellationToken ct)
    {
        var query = _db.Orders.AsNoTracking().Include(x => x.Lines).Include(x => x.Payments)
            .Include(x => x.StageEvents).Include(x => x.BayVisits).AsSplitQuery().AsQueryable();
        if (q.BranchId.HasValue) query = query.Where(x => x.BranchId == q.BranchId.Value);
        if (q.Status.HasValue) query = query.Where(x => x.Status == q.Status.Value);
        if (q.FromUtc.HasValue) query = query.Where(x => x.StartedAtUtc >= q.FromUtc.Value);
        if (q.ToUtc.HasValue) query = query.Where(x => x.StartedAtUtc <= q.ToUtc.Value);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(x => x.Number.Contains(s) || x.CustomerName.Contains(s) || x.VehiclePlate.Contains(s) || (x.CustomerPhone != null && x.CustomerPhone.Contains(s)));
        }
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.StartedAtUtc).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return Result.Success(new PagedList<OrderDto>(items.Select(OrderMap.ToDto).ToArray(), page, size, total));
    }
}

public sealed record GetOrderQuery(Guid Id) : IRequest<Result<OrderDto>>;
public sealed class GetOrderHandler : IRequestHandler<GetOrderQuery, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public GetOrderHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(GetOrderQuery q, CancellationToken ct)
    {
        var o = await _db.Orders.AsNoTracking().Include(x => x.Lines).Include(x => x.Payments).Include(x => x.StageEvents).Include(x => x.BayVisits).FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        return o is null ? Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد.")) : OrderMap.ToDto(o);
    }
}

public sealed record CreateOrderLineInput(Guid ServiceId, int Quantity, Guid? WorkerId);
public sealed record CreateOrderCommand(Guid BranchId, Guid? BayId, Guid? CustomerId, Guid? VehicleId, string CustomerName, string? CustomerPhone,
    string VehiclePlate, string? VehicleBrand, string? VehicleModel, OrderSource Source, Guid? ReservationId, IReadOnlyList<CreateOrderLineInput> Lines) : IRequest<Result<OrderDto>>, ITransactionalRequest;

public sealed class CreateOrderValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.CustomerName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.VehiclePlate).NotEmpty().MaximumLength(20);
        // A bay can be occupied before services are selected; lines are added through /orders/{id}/lines.
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(x => x.ServiceId).NotEmpty();
            l.RuleFor(x => x.Quantity).GreaterThan(0);
        });
    }
}

public sealed class CreateOrderHandler : IRequestHandler<CreateOrderCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public CreateOrderHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result<OrderDto>> Handle(CreateOrderCommand c, CancellationToken ct)
    {
        var tenantId = _tenant.TenantId ?? Guid.Empty;
        // Without a bay the order joins the wash queue; that is how an arriving reservation waits
        // when every wash bay is taken.
        Bay? bay = null;
        if (c.BayId.HasValue)
        {
            bay = await _db.Bays.FirstOrDefaultAsync(x => x.Id == c.BayId.Value, ct);
            if (bay is null) return Result.Failure<OrderDto>(Error.NotFound("Bay.NotFound", "جایگاه یافت نشد."));
            // جایگاه باید به همان شعبه‌ی سفارش تعلق داشته باشد تا گزارش‌های شعبه‌ای مخدوش نشوند
            if (bay.BranchId != c.BranchId) return Result.Failure<OrderDto>(Error.Validation("Bay.WrongBranch", "جایگاه انتخابی متعلق به این شعبه نیست."));
            if (!bay.IsActive) return Result.Failure<OrderDto>(Error.Validation("Bay.Inactive", "جایگاه غیرفعال است."));
            if (bay.Status != BayStatus.Free) return Result.Failure<OrderDto>(Error.Conflict("Bay.NotFree", "جایگاه آزاد نیست."));
        }

        var settings = await _db.TenantSettings.FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            settings = SmartWash.Domain.Operations.TenantSettings.CreateDefault(tenantId);
            _db.TenantSettings.Add(settings);
        }
        // شمارندهٔ سفارش ممکن است بر اثر ریست دیتابیس یا بازساختِ تنظیمات از شماره‌های
        // واقعیِ موجود عقب بماند. پیش از تولید شماره آن را با بزرگ‌ترین شمارهٔ موجودِ
        // همین مستاجر همگام می‌کنیم تا با ایندکس یکتای (TenantId, Number) تصادم نکند
        // و درخواست با ۵۰۰ شکست نخورد.
        var prefix = settings.InvoicePrefix ?? "ORD";
        var lastUsedNumber = await _db.Orders
            .Where(o => o.Number.StartsWith(prefix + "-"))
            .OrderByDescending(o => o.Number)
            .Select(o => o.Number)
            .FirstOrDefaultAsync(ct);
        if (lastUsedNumber is not null)
        {
            var suffix = lastUsedNumber[(lastUsedNumber.LastIndexOf('-') + 1)..];
            if (int.TryParse(suffix, out var lastUsed)) settings.SyncOrderNumber(lastUsed);
        }
        var number = $"{prefix}-{settings.NextOrderNumber():D6}";

        var order = Order.Create(tenantId, c.BranchId, number, c.BayId, c.CustomerId, c.VehicleId,
            c.CustomerName, c.CustomerPhone, c.VehiclePlate, c.VehicleBrand, c.VehicleModel, c.Source, c.ReservationId);

        var serviceIds = c.Lines.Select(l => l.ServiceId).Distinct().ToArray();
        var services = await _db.Services.Where(s => serviceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var workerIds = c.Lines.Where(l => l.WorkerId.HasValue).Select(l => l.WorkerId!.Value).Distinct().ToArray();
        var workers = await _db.Workers.Where(w => workerIds.Contains(w.Id)).ToDictionaryAsync(w => w.Id, ct);

        foreach (var line in c.Lines)
        {
            if (!services.TryGetValue(line.ServiceId, out var svc))
                return Result.Failure<OrderDto>(Error.NotFound("Service.NotFound", "خدمت یافت نشد."));
            string? workerName = null;
            if (line.WorkerId.HasValue && workers.TryGetValue(line.WorkerId.Value, out var w)) workerName = w.FullName;
            order.AddLine(svc.Id, svc.Name, svc.PriceRials, line.Quantity, svc.DurationMinutes, svc.WorkerCommissionRate, line.WorkerId, workerName);
        }

        bay?.Occupy(order.Id);
        _db.Orders.Add(order);
        if (bay is null) await QueueNumbering.RenumberAsync(_db, c.BranchId, order, ct);

        if (c.ReservationId.HasValue)
        {
            var reservation = await _db.Reservations.FirstOrDefaultAsync(r => r.Id == c.ReservationId.Value, ct);
            if (reservation is not null)
            {
                // جلوگیری از تبدیلِ دوباره‌ی یک رزرو به چند سفارش
                if (reservation.Status is not (ReservationStatus.Pending or ReservationStatus.Confirmed))
                    return Result.Failure<OrderDto>(Error.Conflict("Reservation.NotConvertible", "این رزرو قبلاً به سفارش تبدیل شده یا بسته شده است."));
                reservation.MarkArrived(order.Id);
            }
        }

        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(order);
    }
}

public sealed record AddOrderLineCommand(Guid OrderId, Guid ServiceId, int Quantity, Guid? WorkerId) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class AddOrderLineHandler : IRequestHandler<AddOrderLineCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public AddOrderLineHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(AddOrderLineCommand c, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Lines).Include(o => o.Payments)
            .Include(o => o.StageEvents).Include(o => o.BayVisits).FirstOrDefaultAsync(o => o.Id == c.OrderId, ct);
        if (order is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));
        var svc = await _db.Services.FirstOrDefaultAsync(s => s.Id == c.ServiceId, ct);
        if (svc is null) return Result.Failure<OrderDto>(Error.NotFound("Service.NotFound", "خدمت یافت نشد."));
        Worker? worker = null;
        if (c.WorkerId.HasValue) worker = await _db.Workers.FirstOrDefaultAsync(w => w.Id == c.WorkerId.Value, ct);
        order.AddLine(svc.Id, svc.Name, svc.PriceRials, c.Quantity, svc.DurationMinutes, svc.WorkerCommissionRate, c.WorkerId, worker?.FullName);
        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(order);
    }
}

public sealed record RemoveOrderLineCommand(Guid OrderId, Guid LineId) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class RemoveOrderLineHandler : IRequestHandler<RemoveOrderLineCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public RemoveOrderLineHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(RemoveOrderLineCommand c, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Lines).Include(o => o.Payments)
            .Include(o => o.StageEvents).Include(o => o.BayVisits).FirstOrDefaultAsync(o => o.Id == c.OrderId, ct);
        if (order is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));
        order.RemoveLine(c.LineId);
        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(order);
    }
}

public sealed record ApplyDiscountCommand(Guid OrderId, long DiscountRials) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class ApplyDiscountHandler : IRequestHandler<ApplyDiscountCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public ApplyDiscountHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(ApplyDiscountCommand c, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Lines).Include(x => x.Payments).Include(x => x.StageEvents).Include(x => x.BayVisits).FirstOrDefaultAsync(x => x.Id == c.OrderId, ct);
        if (o is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));
        o.ApplyDiscount(c.DiscountRials);
        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(o);
    }
}

public sealed record AddOrderPaymentCommand(Guid OrderId, PaymentMethod Method, long AmountRials, string? Reference) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class AddOrderPaymentHandler : IRequestHandler<AddOrderPaymentCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public AddOrderPaymentHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(AddOrderPaymentCommand c, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Lines).Include(x => x.Payments).Include(x => x.StageEvents).Include(x => x.BayVisits).FirstOrDefaultAsync(x => x.Id == c.OrderId, ct);
        if (o is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));
        if (c.Method == PaymentMethod.Wallet)
        {
            if (!o.CustomerId.HasValue) return Result.Failure<OrderDto>(Error.Validation("Order.NoCustomer", "برای پرداخت با کیف پول، مشتری ثبت‌شده لازم است."));
            var cust = await _db.Customers.FirstOrDefaultAsync(x => x.Id == o.CustomerId.Value, ct);
            if (cust is null) return Result.Failure<OrderDto>(Error.NotFound("Customer.NotFound", "مشتری یافت نشد."));
            cust.AdjustWallet(-c.AmountRials);
            _db.WalletTransactions.Add(new WalletTransaction(o.TenantId, cust.Id, WalletTransactionType.Spend, -c.AmountRials, cust.WalletBalanceRials, $"پرداخت سفارش {o.Number}", o.Id));
        }
        o.AddPayment(c.Method, c.AmountRials, c.Reference);
        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(o);
    }
}

public sealed record CompleteOrderCommand(Guid OrderId, PaymentMethod FinalMethod) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class CompleteOrderHandler : IRequestHandler<CompleteOrderCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public CompleteOrderHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(CompleteOrderCommand c, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Lines).Include(x => x.Payments).Include(x => x.StageEvents).Include(x => x.BayVisits).FirstOrDefaultAsync(x => x.Id == c.OrderId, ct);
        if (o is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));

        // اگر روش پرداخت «کیف پول» است، موجودی باید قبل از Complete کسر شود
        // (AddOrderPaymentHandler هم این کار را می‌کند، اما فقط وقتی مستقل فراخوانی شود)
        Customer? custForWallet = null;
        if (c.FinalMethod == PaymentMethod.Wallet && o.CustomerId.HasValue && o.PaidRials < o.TotalRials)
        {
            custForWallet = await _db.Customers.FirstOrDefaultAsync(x => x.Id == o.CustomerId.Value, ct);
            if (custForWallet is null)
                return Result.Failure<OrderDto>(Error.NotFound("Customer.NotFound", "برای پرداخت با کیف پول، مشتری ثبت‌شده لازم است."));
            // کیف پول باید کل باقیمانده را پوشش دهد؛ پرداخت جزئی از کیف پول مجاز نیست تا سفارشِ ناتسویه به‌اشتباه «کامل» ثبت نشود.
            var remaining = o.TotalRials - o.PaidRials;
            if (custForWallet.WalletBalanceRials < remaining)
                return Result.Failure<OrderDto>(Error.Validation("Wallet.InsufficientFunds", "موجودی کیف پول برای تسویه کامل کافی نیست."));
            custForWallet.AdjustWallet(-remaining);
            _db.WalletTransactions.Add(new WalletTransaction(o.TenantId, custForWallet.Id, WalletTransactionType.Spend, -remaining, custForWallet.WalletBalanceRials, $"پرداخت سفارش {o.Number}", o.Id));
            // ثبت پرداخت روی سفارش تا PaidRials درست شود و Complete دوباره پرداخت کیف‌پولی اضافه نکند.
            o.AddPayment(PaymentMethod.Wallet, remaining, null);
        }

        o.Complete(c.FinalMethod);

        // Free the bay the car is actually in. It may not be the one it was booked onto, and
        // after the car moved on that bay may already hold someone else.
        var bay = await _db.Bays.FirstOrDefaultAsync(b => b.CurrentOrderId == o.Id, ct);
        bay?.ReleaseIfHeldBy(o.Id);

        // Update customer stats + loyalty
        if (o.CustomerId.HasValue)
        {
            var cust = custForWallet ?? await _db.Customers.FirstOrDefaultAsync(x => x.Id == o.CustomerId.Value, ct);
            if (cust is not null)
            {
                cust.RecordVisit(o.TotalRials);
                var settings = await _db.TenantSettings.FirstOrDefaultAsync(ct);
                if (settings is { LoyaltyEnabled: true } && settings.LoyaltyPointsPerRial > 0)
                {
                    var earned = (int)(o.TotalRials / Math.Max(1, settings.LoyaltyPointValueRials)) * settings.LoyaltyPointsPerRial;
                    if (earned > 0)
                    {
                        cust.AddLoyaltyPoints(earned);
                        _db.LoyaltyTransactions.Add(new LoyaltyTransaction(o.TenantId, cust.Id, LoyaltyTransactionType.Earned, earned, cust.LoyaltyPoints, $"امتیاز سفارش {o.Number}", o.Id));
                    }
                }
            }
        }

        // Per-car usage event for billing
        var period = DateOnly.FromDateTime(DateTime.UtcNow);
        _db.UsageEvents.Add(new UsageEvent(o.TenantId, o.Id, period, o.TotalRials));

        // Next-wash reminder (default 30 days)
        if (o.CustomerId.HasValue && !string.IsNullOrEmpty(o.CustomerPhone))
        {
            var dueAt = DateTime.UtcNow.AddDays(30);
            var title = $"یادآوری شستشوی بعدی برای خودرو {o.VehiclePlate}";
            _db.ServiceReminders.Add(new ServiceReminder(o.TenantId, o.CustomerId.Value, o.VehicleId, title, dueAt, ReminderType.NextWash));
        }

        // Open shift, if any — include tips and wallet amounts
        var openShift = await _db.Shifts.Where(s => s.BranchId == o.BranchId && s.Status == ShiftStatus.Open).FirstOrDefaultAsync(ct);
        if (openShift is not null)
        {
            long cash = 0, card = 0, online = 0, wallet = 0, tips = 0;
            foreach (var p in o.Payments)
            {
                switch (p.Method)
                {
                    case PaymentMethod.Cash:   cash   += p.AmountRials; break;
                    case PaymentMethod.Card:   card   += p.AmountRials; break;
                    case PaymentMethod.Online: online += p.AmountRials; break;
                    case PaymentMethod.Wallet: wallet += p.AmountRials; break;
                    case PaymentMethod.Tip:    tips   += p.AmountRials; break;
                }
            }
            // Tips from order lines (saved via SetLineTip)
            var lineTips = o.Lines.Sum(l => l.TipRials);
            tips += lineTips;

            openShift.RegisterOrder(cash, card, online, tips, wallet);
        }

        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(o);
    }
}

// ── SetLineTip: انعام هر لاین را ذخیره می‌کند ──────────────────────────────
public sealed record SetLineTipCommand(Guid OrderId, Guid LineId, long TipRials) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class SetLineTipHandler : IRequestHandler<SetLineTipCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public SetLineTipHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(SetLineTipCommand c, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Lines).Include(x => x.Payments).Include(x => x.StageEvents).Include(x => x.BayVisits).FirstOrDefaultAsync(x => x.Id == c.OrderId, ct);
        if (o is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));
        if (o.Status != OrderStatus.InProgress) return Result.Failure<OrderDto>(Error.Conflict("Order.NotEditable", "سفارش قابل ویرایش نیست."));
        var line = o.Lines.FirstOrDefault(l => l.Id == c.LineId);
        if (line is null) return Result.Failure<OrderDto>(Error.NotFound("OrderLine.NotFound", "آیتم سفارش یافت نشد."));
        line.SetTip(c.TipRials);
        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(o);
    }
}

// ── AssignLineWorker: تخصیص کارگر بدون حذف و بازاضافه ──────────────────────
public sealed record AssignLineWorkerCommand(Guid OrderId, Guid LineId, Guid WorkerId) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class AssignLineWorkerHandler : IRequestHandler<AssignLineWorkerCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public AssignLineWorkerHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(AssignLineWorkerCommand c, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Lines).Include(x => x.Payments).Include(x => x.StageEvents).Include(x => x.BayVisits).FirstOrDefaultAsync(x => x.Id == c.OrderId, ct);
        if (o is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));
        if (o.Status != OrderStatus.InProgress) return Result.Failure<OrderDto>(Error.Conflict("Order.NotEditable", "سفارش قابل ویرایش نیست."));
        var line = o.Lines.FirstOrDefault(l => l.Id == c.LineId);
        if (line is null) return Result.Failure<OrderDto>(Error.NotFound("OrderLine.NotFound", "آیتم سفارش یافت نشد."));
        var worker = await _db.Workers.FirstOrDefaultAsync(w => w.Id == c.WorkerId, ct);
        if (worker is null) return Result.Failure<OrderDto>(Error.NotFound("Worker.NotFound", "پرسنل یافت نشد."));
        line.AssignWorker(worker.Id, worker.FullName, worker.CommissionRate);
        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(o);
    }
}

// ── ApplyLoyaltyFree: اعمال خدمت رایگان وفاداری ────────────────────────────
public sealed record ApplyLoyaltyFreeCommand(Guid OrderId) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class ApplyLoyaltyFreeHandler : IRequestHandler<ApplyLoyaltyFreeCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public ApplyLoyaltyFreeHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(ApplyLoyaltyFreeCommand c, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Lines).Include(x => x.Payments).Include(x => x.StageEvents).Include(x => x.BayVisits).FirstOrDefaultAsync(x => x.Id == c.OrderId, ct);
        if (o is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));
        if (o.Status != OrderStatus.InProgress) return Result.Failure<OrderDto>(Error.Conflict("Order.NotEditable", "سفارش قابل ویرایش نیست."));
        if (!o.CustomerId.HasValue) return Result.Failure<OrderDto>(Error.Validation("Order.NoCustomer", "برای اعمال خدمت رایگان، مشتری باید مشخص باشد."));
        if (o.Lines.Count == 0) return Result.Failure<OrderDto>(Error.Validation("Order.NoLines", "سفارش خالی است."));
        if (o.LoyaltyPointsUsed > 0) return Result.Failure<OrderDto>(Error.Conflict("Loyalty.AlreadyApplied", "خدمت رایگان قبلاً روی این سفارش اعمال شده است."));

        // بررسی اینکه مشتری واقعاً واجد شرط وفاداری است
        var cust = await _db.Customers.FirstOrDefaultAsync(x => x.Id == o.CustomerId.Value, ct);
        if (cust is null) return Result.Failure<OrderDto>(Error.NotFound("Customer.NotFound", "مشتری یافت نشد."));

        if (!cust.HasFreeServiceAvailable)
            return Result.Failure<OrderDto>(Error.Validation("Loyalty.NotEligible", "مشتری واجد دریافت خدمت رایگان نیست."));

        // ارزانترین خدمت رایگان می‌شود
        var cheapestLine = o.Lines.MinBy(l => l.UnitPriceRials);
        if (cheapestLine is null) return Result.Failure<OrderDto>(Error.Validation("Order.NoLines", "خطا در خطوط سفارش."));

        var discountValue = cheapestLine.UnitPriceRials * cheapestLine.Quantity;
        o.UseLoyaltyPoints(1, discountValue);

        // ثبت استفاده از خدمت رایگان
        cust.UseFreeService();
        _db.LoyaltyTransactions.Add(new LoyaltyTransaction(
            o.TenantId, cust.Id, LoyaltyTransactionType.Redeemed,
            -1, cust.LoyaltyPoints,
            $"خدمت رایگان سفارش {o.Number}", o.Id));

        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(o);
    }
}

public sealed record CancelOrderCommand(Guid OrderId, string? Reason) : IRequest<Result<OrderDto>>, ITransactionalRequest;
public sealed class CancelOrderHandler : IRequestHandler<CancelOrderCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    public CancelOrderHandler(IAppDbContext db) => _db = db;
    public async Task<Result<OrderDto>> Handle(CancelOrderCommand c, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Lines).Include(x => x.Payments).Include(x => x.StageEvents).Include(x => x.BayVisits).FirstOrDefaultAsync(x => x.Id == c.OrderId, ct);
        if (o is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));

        // برگشت اثرهای جانبیِ سفارش روی مشتری (کیف پول و خدمت رایگان) هنگام لغو
        var walletPaid = o.Payments.Where(p => p.Method == PaymentMethod.Wallet).Sum(p => p.AmountRials);
        if (o.CustomerId.HasValue && (walletPaid > 0 || o.LoyaltyPointsUsed > 0))
        {
            var cust = await _db.Customers.FirstOrDefaultAsync(x => x.Id == o.CustomerId.Value, ct);
            if (cust is not null)
            {
                // برگشت مبالغ کیف پول که هنگام «در حال انجام» از حساب مشتری کسر شده بود
                if (walletPaid > 0)
                {
                    cust.AdjustWallet(walletPaid);
                    _db.WalletTransactions.Add(new WalletTransaction(o.TenantId, cust.Id, WalletTransactionType.Refund, walletPaid, cust.WalletBalanceRials, $"برگشت وجه لغو سفارش {o.Number}", o.Id));
                }

                // برگشت خدمت رایگانِ وفاداری که روی این سفارش اعمال شده بود
                if (o.LoyaltyPointsUsed > 0)
                {
                    cust.RestoreFreeService();
                    _db.LoyaltyTransactions.Add(new LoyaltyTransaction(o.TenantId, cust.Id, LoyaltyTransactionType.Adjustment, 0, cust.LoyaltyPoints, $"برگشت خدمت رایگان لغو سفارش {o.Number}", o.Id));
                }
            }
        }

        o.Cancel(c.Reason);
        var bay = await _db.Bays.FirstOrDefaultAsync(b => b.CurrentOrderId == o.Id, ct);
        bay?.ReleaseIfHeldBy(o.Id);
        await QueueNumbering.RenumberAsync(_db, o.BranchId, o, ct);
        await _db.SaveChangesAsync(ct);
        return OrderMap.ToDto(o);
    }
}

public sealed record AdvanceOrderStageCommand(Guid OrderId, OrderStage Stage, Guid? BayId, string? Note)
    : IRequest<Result<OrderDto>>, ITransactionalRequest;

/// <summary>
/// Moves a car to its next stage, and releases the bay the moment the washing is done.
///
/// Before this existed, a bay stayed occupied until the sale was closed, so a car that had
/// finished being washed but was still drying — or whose owner had wandered off — held a bay
/// that was standing empty. On a four-bay site that is a quarter of the capacity lost to
/// bookkeeping. The bay is now let go as soon as the car leaves it, which is what the person
/// on the floor means when they say the bay is free.
///
/// Closing the sale still frees the bay too, for the ordinary case where a car is washed and
/// driven away without anyone touching the stage buttons.
/// </summary>
public sealed class AdvanceOrderStageHandler : IRequestHandler<AdvanceOrderStageCommand, Result<OrderDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public AdvanceOrderStageHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<OrderDto>> Handle(AdvanceOrderStageCommand c, CancellationToken ct)
    {
        var o = await _db.Orders
            .Include(x => x.Lines).Include(x => x.Payments)
            .Include(x => x.StageEvents).Include(x => x.BayVisits)
            .FirstOrDefaultAsync(x => x.Id == c.OrderId, ct);
        if (o is null) return Result.Failure<OrderDto>(Error.NotFound("Order.NotFound", "سفارش یافت نشد."));

        // The bay record decides which bay the car is in. The order only remembers the last bay
        // it used: an order booked onto a bay is in it from the start, and a car that has left a
        // bay must not still be treated as holding it.
        var holding = await _db.Bays.FirstOrDefaultAsync(b => b.CurrentOrderId == o.Id, ct);
        var allowed = AllowedBays(c.Stage);

        Bay? target = null;
        if (allowed.Length > 0)
        {
            if (c.BayId.HasValue)
            {
                target = holding?.Id == c.BayId ? holding : await _db.Bays.FirstOrDefaultAsync(b => b.Id == c.BayId.Value, ct);
                if (target is null)
                    return Result.Failure<OrderDto>(Error.NotFound("Bay.NotFound", "جایگاه یافت نشد."));
            }
            else if (holding is not null)
            {
                // Already in a bay, so the next step happens there. A car booked onto bay 3 is
                // washed, dried and finished in bay 3; it only moves when the operator moves it.
                // Asking for a bay here is what used to stop the operator mid-journey.
                target = holding;
            }
            else
            {
                return Result.Failure<OrderDto>(Error.Validation("Order.BayRequired",
                    $"برای «{StageLabel(c.Stage)}» یک جایگاه {string.Join(" یا ", allowed.Select(BayTypeLabel))} انتخاب کنید."));
            }

            if (target.Id != holding?.Id && !allowed.Contains(target.Type))
                return Result.Failure<OrderDto>(Error.Validation("Bay.WrongType",
                    $"«{StageLabel(c.Stage)}» در جایگاه {BayTypeLabel(target.Type)} انجام نمی‌شود."));

            if (target.Id != holding?.Id)
            {
                if (!target.IsActive)
                    return Result.Failure<OrderDto>(Error.Validation("Bay.Inactive", "جایگاه مقصد غیرفعال است."));
                if (target.Status == BayStatus.Maintenance)
                    return Result.Failure<OrderDto>(Error.Conflict("Bay.InMaintenance", "جایگاه مقصد در تعمیر است."));
                if (target.Status == BayStatus.Occupied)
                    return Result.Failure<OrderDto>(Error.Conflict("Bay.NotFree", "جایگاه مقصد آزاد نیست."));
            }
        }

        try
        {
            o.AdvanceStage(c.Stage, target?.Id, _currentUser.UserId, c.Note);
        }
        catch (DomainException ex)
        {
            return Result.Failure<OrderDto>(Error.Validation(ex.Code, ex.Message));
        }

        // Leave the old bay, unless the next step happens in it.
        if (holding is not null && holding.Id != target?.Id)
            holding.ReleaseIfHeldBy(o.Id);

        if (target is not null && target.Id != holding?.Id)
            target.Occupy(o.Id);

        // Positions are renumbered in the same save, because a car leaving a line moves everyone
        // behind it forward and the number read out to the customer has to stay true.
        await QueueNumbering.RenumberAsync(_db, o.BranchId, o, ct);
        await _db.SaveChangesAsync(ct);

        return Result.Success(OrderMap.ToDto(o));
    }

    /// <summary>The kinds of bay a stage may happen in; empty when the car is not in a bay.</summary>
    private static BayType[] AllowedBays(OrderStage stage) => stage switch
    {
        OrderStage.Washing => new[] { BayType.Wash, BayType.EngineWash, BayType.Special },
        OrderStage.Drying => new[] { BayType.Dry },
        // Wax and polish usually happen where the car was dried, but a site with its own
        // polishing bay can send it there instead.
        OrderStage.OptionServices => new[] { BayType.Dry, BayType.Wax, BayType.Polish, BayType.Special },
        _ => Array.Empty<BayType>(),
    };

    private static string StageLabel(OrderStage s) => s switch
    {
        OrderStage.Washing => "شستشو",
        OrderStage.Drying => "خشک‌کردن",
        OrderStage.OptionServices => "خدمات آپشن",
        _ => s.ToString(),
    };

    private static string BayTypeLabel(BayType t) => t switch
    {
        BayType.Wash => "شستشو",
        BayType.Dry => "خشک",
        BayType.Wax => "واکس",
        BayType.Polish => "پولیش",
        BayType.EngineWash => "موتورشویی",
        _ => "ویژه",
    };
}

/// <summary>
/// Keeps the waiting lines numbered from one.
///
/// A position is only meaningful next to everyone else waiting, so it cannot be assigned when a
/// car joins and then left alone — the moment a car ahead is pulled into a bay, every number
/// behind it is wrong. Renumbering the whole line after any movement is cheap at carwash scale
/// (a line is a handful of cars, never thousands) and it is the only version that is always
/// right, which matters when the number has been read out loud to a customer.
/// </summary>
public static class QueueNumbering
{
    /// <param name="moving">
    /// The order whose stage just changed in memory. The database still holds its old stage, so
    /// it is placed in, or taken out of, the lines by its new stage here.
    /// </param>
    public static async Task RenumberAsync(IAppDbContext db, Guid branchId, Order? moving, CancellationToken ct)
    {
        var waiting = await db.Orders
            .Include(o => o.StageEvents)
            .Where(o => o.BranchId == branchId
                        && o.Status == OrderStatus.InProgress
                        && (o.Stage == OrderStage.QueuedForWash || o.Stage == OrderStage.QueuedForDry))
            .ToListAsync(ct);

        if (moving is not null)
        {
            waiting.RemoveAll(o => o.Id == moving.Id);
            if (moving.Status == OrderStatus.InProgress && OrderStageRules.IsQueue(moving.Stage))
                waiting.Add(moving);
            else if (moving.QueuePosition is not null)
                moving.SetQueuePosition(null);
        }

        // Earliest to join the line goes first; joining is the moment it entered the queue stage.
        foreach (var line in waiting.GroupBy(o => o.Stage))
        {
            var position = 1;
            foreach (var order in line.OrderBy(JoinedAt))
            {
                if (order.QueuePosition != position) order.SetQueuePosition(position);
                position++;
            }
        }
    }

    private static DateTime JoinedAt(Order o)
        => o.StageEvents.Where(e => e.Stage == o.Stage).Select(e => (DateTime?)e.AtUtc).Max()
           ?? o.UpdatedAtUtc ?? o.StartedAtUtc;
}

// resync-marker
