using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

public sealed class Order : TenantAggregateRoot<Guid>
{
    private readonly List<OrderLine> _lines = new();
    private readonly List<OrderPayment> _payments = new();

    private Order() { }

    public Guid BranchId { get; private set; }
    public string Number { get; private set; } = null!;
    public Guid BayId { get; private set; }
    public Guid? CustomerId { get; private set; }
    public Guid? VehicleId { get; private set; }
    public string CustomerName { get; private set; } = null!;
    public string? CustomerPhone { get; private set; }
    public string VehiclePlate { get; private set; } = null!;
    public string? VehicleBrand { get; private set; }
    public string? VehicleModel { get; private set; }
    public OrderStatus Status { get; private set; }
    public OrderSource Source { get; private set; }
    public DateTime StartedAtUtc { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }
    public int ExpectedDurationMinutes { get; private set; }

    public long SubtotalRials { get; private set; }
    public long DiscountRials { get; private set; }
    public long WalletUsedRials { get; private set; }
    public int LoyaltyPointsUsed { get; private set; }
    public long TotalRials { get; private set; }
    public long PaidRials { get; private set; }
    public PaymentMethod? FinalPaymentMethod { get; private set; }
    public string? Notes { get; private set; }
    public Guid? ReservationId { get; private set; }

    public IReadOnlyCollection<OrderLine> Lines => _lines.AsReadOnly();
    public IReadOnlyCollection<OrderPayment> Payments => _payments.AsReadOnly();

    public static Order Create(Guid tenantId, Guid branchId, string number, Guid bayId,
        Guid? customerId, Guid? vehicleId, string customerName, string? customerPhone,
        string plate, string? brand, string? model, OrderSource source, Guid? reservationId = null)
    {
        return new Order
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Number = number,
            BayId = bayId,
            CustomerId = customerId,
            VehicleId = vehicleId,
            CustomerName = customerName.Trim(),
            CustomerPhone = customerPhone?.Trim(),
            VehiclePlate = plate.Trim(),
            VehicleBrand = brand?.Trim(),
            VehicleModel = model?.Trim(),
            Status = OrderStatus.InProgress,
            Source = source,
            StartedAtUtc = DateTime.UtcNow,
            ReservationId = reservationId,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public OrderLine AddLine(Guid serviceId, string serviceName, long unitPriceRials, int quantity, int durationMinutes, decimal commissionRate, Guid? workerId, string? workerName)
    {
        if (Status != OrderStatus.InProgress)
            throw new DomainException("Order.NotEditable", "سفارش قابل ویرایش نیست.");

        var line = new OrderLine(Id, TenantId, serviceId, serviceName, unitPriceRials, quantity, durationMinutes, commissionRate, workerId, workerName);
        _lines.Add(line);
        Recalculate();
        return line;
    }

    public void RemoveLine(Guid lineId)
    {
        if (Status != OrderStatus.InProgress)
            throw new DomainException("Order.NotEditable", "سفارش قابل ویرایش نیست.");
        var line = _lines.FirstOrDefault(l => l.Id == lineId);
        if (line is not null)
        {
            _lines.Remove(line);
            Recalculate();
        }
    }

    public void ApplyDiscount(long discountRials)
    {
        if (Status != OrderStatus.InProgress)
            throw new DomainException("Order.NotEditable", "سفارش قابل ویرایش نیست.");
        if (discountRials < 0) throw new DomainException("Order.InvalidDiscount", "تخفیف نامعتبر است.");
        // Recalculate clamps TotalRials at zero, so an oversized discount is invisible on the
        // invoice while DiscountRials keeps the inflated figure and feeds it to the reports.
        if (discountRials > SubtotalRials)
            throw new DomainException("Order.DiscountExceedsTotal", "تخفیف نمی‌تواند از مبلغ سفارش بیشتر باشد.");
        DiscountRials = discountRials;
        Recalculate();
    }

    public void UseWallet(long amountRials)
    {
        if (Status != OrderStatus.InProgress)
            throw new DomainException("Order.NotEditable", "سفارش قابل ویرایش نیست.");
        if (amountRials < 0) throw new DomainException("Order.InvalidWalletAmount", "مبلغ نامعتبر است.");
        WalletUsedRials = amountRials;
        Recalculate();
    }

    public void UseLoyaltyPoints(int points, long discountValueRials)
    {
        if (Status != OrderStatus.InProgress)
            throw new DomainException("Order.NotEditable", "سفارش قابل ویرایش نیست.");
        LoyaltyPointsUsed = points;
        DiscountRials += discountValueRials;
        Recalculate();
    }

    private void Recalculate()
    {
        SubtotalRials = _lines.Sum(l => l.LineTotalRials);
        ExpectedDurationMinutes = _lines.Sum(l => l.DurationMinutes * l.Quantity);
        var afterDiscount = SubtotalRials - DiscountRials;
        TotalRials = Math.Max(0, afterDiscount - WalletUsedRials);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AddPayment(PaymentMethod method, long amountRials, string? reference)
    {
        if (Status == OrderStatus.Cancelled) throw new DomainException("Order.Cancelled", "سفارش لغو شده است.");
        if (Status == OrderStatus.Completed) throw new DomainException("Order.AlreadyCompleted", "سفارش تکمیل شده است.");
        if (amountRials <= 0) throw new DomainException("Order.InvalidPayment", "مبلغ پرداخت باید مثبت باشد.");
        var payment = new OrderPayment(Id, TenantId, method, amountRials, reference);
        _payments.Add(payment);
        // انعام، پرداختِ بدهیِ سفارش نیست؛ پس در مبلغِ پرداخت‌شده (PaidRials) محاسبه نمی‌شود
        // و به شیفت به‌عنوان TipsRials منتقل می‌شود، نه فروش.
        PaidRials = _payments.Where(p => p.Method != PaymentMethod.Tip).Sum(p => p.AmountRials);
        if (method != PaymentMethod.Tip) FinalPaymentMethod = method;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Complete(PaymentMethod finalMethod)
    {
        if (Status != OrderStatus.InProgress) throw new DomainException("Order.NotInProgress", "سفارش در حال انجام نیست.");
        // انعام روشِ تسویه‌ی بدهیِ سفارش نیست؛ نمی‌تواند روشِ نهاییِ پرداخت باشد.
        if (finalMethod == PaymentMethod.Tip) throw new DomainException("Order.InvalidFinalMethod", "انعام نمی‌تواند روش پرداخت نهایی باشد.");
        if (PaidRials < TotalRials)
        {
            var diff = TotalRials - PaidRials;
            AddPayment(finalMethod, diff, null);
        }
        Status = OrderStatus.Completed;
        FinalPaymentMethod = finalMethod;
        CompletedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel(string? reason)
    {
        if (Status == OrderStatus.Completed) throw new DomainException("Order.AlreadyCompleted", "سفارش تکمیل شده است.");
        Status = OrderStatus.Cancelled;
        CancelledAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(reason)) Notes = string.IsNullOrWhiteSpace(Notes) ? reason : $"{Notes}\n{reason}";
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public sealed class OrderLine : Entity<Guid>, ITenantScoped
{
    private OrderLine() { }

    internal OrderLine(Guid orderId, Guid tenantId, Guid serviceId, string serviceName, long unitPriceRials, int quantity, int durationMinutes, decimal commissionRate, Guid? workerId, string? workerName)
    {
        Id = Guid.NewGuid();
        OrderId = orderId;
        TenantId = tenantId;
        ServiceId = serviceId;
        ServiceName = serviceName;
        UnitPriceRials = unitPriceRials;
        Quantity = quantity;
        DurationMinutes = durationMinutes;
        WorkerCommissionRate = commissionRate;
        WorkerId = workerId;
        WorkerName = workerName;
        LineTotalRials = unitPriceRials * quantity;
        // نرخ کمیسیون به‌صورت کسری (۰.۰ تا ۱.۰) ذخیره می‌شود؛ مثلاً ۰.۱ یعنی ۱۰٪.
        WorkerCommissionRials = (long)(LineTotalRials * commissionRate);
    }

    public Guid OrderId { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid ServiceId { get; private set; }
    public string ServiceName { get; private set; } = null!;
    public long UnitPriceRials { get; private set; }
    public int Quantity { get; private set; }
    public int DurationMinutes { get; private set; }
    public long LineTotalRials { get; private set; }
    public Guid? WorkerId { get; private set; }
    public string? WorkerName { get; private set; }
    public decimal WorkerCommissionRate { get; private set; }
    public long WorkerCommissionRials { get; private set; }
    public long TipRials { get; private set; }  // انعام اختصاص‌یافته به این خط

    public void AssignWorker(Guid workerId, string? workerName, decimal commissionRate)
    {
        WorkerId = workerId;
        WorkerName = workerName;
        WorkerCommissionRate = commissionRate;
        // نرخ کمیسیون کسری است (۰.۰ تا ۱.۰)؛ بدون تقسیم بر ۱۰۰.
        WorkerCommissionRials = (long)(LineTotalRials * commissionRate);
    }

    public void SetTip(long tipRials)
    {
        if (tipRials < 0) throw new DomainException("Order.InvalidTip", "انعام نمی‌تواند منفی باشد.");
        TipRials = tipRials;
    }
}

public sealed class OrderPayment : Entity<Guid>, ITenantScoped
{
    private OrderPayment() { }

    internal OrderPayment(Guid orderId, Guid tenantId, PaymentMethod method, long amount, string? reference)
    {
        Id = Guid.NewGuid();
        OrderId = orderId;
        TenantId = tenantId;
        Method = method;
        AmountRials = amount;
        Reference = reference;
        PaidAtUtc = DateTime.UtcNow;
    }

    public Guid OrderId { get; private set; }
    public Guid TenantId { get; private set; }
    public PaymentMethod Method { get; private set; }
    public long AmountRials { get; private set; }
    public string? Reference { get; private set; }
    public DateTime PaidAtUtc { get; private set; }
}

public enum OrderStatus
{
    InProgress = 0,
    Completed = 1,
    Cancelled = 2
}

public enum OrderSource
{
    WalkIn = 0,
    Reservation = 1,
    Online = 2
}

public enum PaymentMethod
{
    Cash = 0,
    Card = 1,
    Online = 2,
    Wallet = 3,
    Mixed = 4,
    Credit = 5,
    Tip = 6        // انعام پرسنل — ثبت جداگانه در payments
}
// resync-marker
