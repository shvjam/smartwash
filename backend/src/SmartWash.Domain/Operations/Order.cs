using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

public sealed class Order : TenantAggregateRoot<Guid>
{
    private readonly List<OrderLine> _lines = new();
    private readonly List<OrderPayment> _payments = new();
    private readonly List<OrderStageEvent> _stageEvents = new();
    private readonly List<OrderBayVisit> _bayVisits = new();

    private Order() { }

    public Guid BranchId { get; private set; }
    public string Number { get; private set; } = null!;
    /// <summary>The bay the car was last in; null for a reservation still waiting for one.</summary>
    public Guid? BayId { get; private set; }
    public Guid? CustomerId { get; private set; }
    public Guid? VehicleId { get; private set; }
    public string CustomerName { get; private set; } = null!;
    public string? CustomerPhone { get; private set; }
    public string VehiclePlate { get; private set; } = null!;
    public string? VehicleBrand { get; private set; }
    public string? VehicleModel { get; private set; }
    public OrderStatus Status { get; private set; }

    /// <summary>Where the car is in the wash, as distinct from whether the order is open or closed.</summary>
    public OrderStage Stage { get; private set; }

    /// <summary>Place in the line it is waiting in, or null when it is not waiting.</summary>
    public int? QueuePosition { get; private set; }
    public OrderSource Source { get; private set; }
    public DateTime StartedAtUtc { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }

    /// <summary>When work actually began, as opposed to when the car arrived.</summary>
    public DateTime? WashStartedAtUtc { get; private set; }
    /// <summary>When the bay was released. Time after this is drying, waiting or paying.</summary>
    public DateTime? WashCompletedAtUtc { get; private set; }
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

    /// <summary>Every stage this car passed through, with the moment it happened.</summary>
    public IReadOnlyCollection<OrderStageEvent> StageEvents => _stageEvents.AsReadOnly();

    /// <summary>Every bay this car sat in, with how long it was there.</summary>
    public IReadOnlyCollection<OrderBayVisit> BayVisits => _bayVisits.AsReadOnly();

    /// <summary>
    /// The bay the car is in right now, or null while it waits in a line or after it has left.
    ///
    /// Read from the open bay visit. Orders created before visits were recorded at booking have
    /// none, and those are still sitting in the bay they were booked onto.
    /// </summary>
    public Guid? CurrentBayId =>
        _bayVisits.FirstOrDefault(v => v.LeftAtUtc is null)?.BayId
        ?? (_bayVisits.Count == 0 && Stage == OrderStage.Received && Status == OrderStatus.InProgress ? BayId : null);


    /// <summary>Money still owed on this order. Zero once it is settled.</summary>
    public long OutstandingRials => Math.Max(0, TotalRials - PaidRials);

    public static Order Create(Guid tenantId, Guid branchId, string number, Guid? bayId,
        Guid? customerId, Guid? vehicleId, string customerName, string? customerPhone,
        string plate, string? brand, string? model, OrderSource source, Guid? reservationId = null)
    {
        var order = new Order
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

        order.Stage = OrderStage.Received;
        order._stageEvents.Add(new OrderStageEvent(order.Id, tenantId, OrderStage.Received, null, null));
        if (bayId is { } bay)
        {
            // Booked onto a bay, which is occupied the same moment: the car is in it already, and
            // recording that is what lets every later step happen there without asking for a bay.
            order._bayVisits.Add(new OrderBayVisit(order.Id, tenantId, bay, OrderStage.Received));
        }
        else
        {
            // No bay free when it arrived: it waits in the wash queue for one.
            order.Stage = OrderStage.QueuedForWash;
            order._stageEvents.Add(new OrderStageEvent(order.Id, tenantId, OrderStage.QueuedForWash, null, null));
        }
        return order;
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

    /// <summary>
    /// Moves the car one step along, recording when it happened and where it went.
    ///
    /// Stages only ever go forward. Letting them go back would make the recorded timeline a
    /// story about which buttons were pressed rather than about what happened to the car, and
    /// every duration measured from it would be guesswork. A stage entered by mistake is
    /// corrected by cancelling the order, not by rewinding it.
    ///
    /// Skipping ahead is allowed, because sites differ: a carwash with no drying bay sends a
    /// car straight from washing to ready, and refusing that would force it to record two
    /// stages that never happened.
    ///
    /// <paramref name="bayId"/> is required by the stages that put the car inside a bay, and
    /// rejected by the ones that do not — a car waiting in line is not in a bay, and recording
    /// one would overstate how long that bay was busy.
    ///
    /// Handing the car back is the one stage that can be refused outright: it closes the order,
    /// and an order cannot close while it is still owed money.
    /// </summary>
    public void AdvanceStage(OrderStage next, Guid? bayId, Guid? byUserId, string? note)
    {
        if (Status == OrderStatus.Cancelled) throw new DomainException("Order.Cancelled", "سفارش لغو شده است.");
        if (Status == OrderStatus.Completed) throw new DomainException("Order.AlreadyCompleted", "سفارش تکمیل شده است.");
        if (next <= Stage)
            throw new DomainException("Order.StageNotForward", "مرحله‌ی سفارش فقط رو به جلو تغییر می‌کند.");

        if (next == OrderStage.Delivered && _lines.Count == 0)
            throw new DomainException("Order.NoLines", "هیچ خدمتی روی سفارش ثبت نشده؛ ابتدا خدمت اضافه کنید یا سفارش را لغو کنید.");
        if (next == OrderStage.Delivered && OutstandingRials > 0)
            throw new DomainException("Order.NotSettled",
                $"تا تسویه‌ی کامل نمی‌توان خودرو را تحویل داد. مانده: {OutstandingRials:N0} ریال.");

        var needsBay = OrderStageRules.OccupiesBay(next);
        if (needsBay && bayId is null)
            throw new DomainException("Order.BayRequired", "برای این مرحله باید جایگاه مشخص شود.");
        if (!needsBay) bayId = null;

        var open = _bayVisits.FirstOrDefault(v => v.LeftAtUtc is null);
        var stayingPut = needsBay && open is not null && open.BayId == bayId;
        // Whatever bay it was in, it is not in it any more — unless the next step happens in
        // the very same bay, in which case the visit carries on.
        if (!stayingPut) CloseOpenBayVisit();

        Stage = next;
        _stageEvents.Add(new OrderStageEvent(Id, TenantId, next, byUserId, note));

        if (needsBay)
        {
            BayId = bayId;
            // Order.BayRequired above refuses this stage without a bay, so by here there is
            // one; the compiler cannot see that through the reassignment a few lines up.
            if (!stayingPut) _bayVisits.Add(new OrderBayVisit(Id, TenantId, bayId!.Value, next));
            QueuePosition = null;
        }

        if (next == OrderStage.Washing && WashStartedAtUtc is null) WashStartedAtUtc = DateTime.UtcNow;
        if (next is OrderStage.QueuedForDry or OrderStage.Drying && WashCompletedAtUtc is null)
            WashCompletedAtUtc = DateTime.UtcNow;

        if (next == OrderStage.Delivered)
        {
            Status = OrderStatus.Completed;
            CompletedAtUtc = DateTime.UtcNow;
            QueuePosition = null;
        }

        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// Where this car stands in the line it is currently waiting in.
    ///
    /// Set by the queue rather than by the car, because a position only means anything relative
    /// to everyone else waiting. It is what the desk reads out when the ticket is printed.
    /// </summary>
    public void SetQueuePosition(int? position)
    {
        QueuePosition = position is > 0 ? position : null;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    private void CloseOpenBayVisit()
    {
        var open = _bayVisits.FirstOrDefault(v => v.LeftAtUtc is null);
        open?.Leave();
    }

    /// <summary>
    /// Settles whatever is still owed and hands the car back in one step — the ordinary
    /// counter transaction, where the customer pays and drives away.
    ///
    /// The payment is recorded before the order closes rather than after, so an order is never
    /// marked delivered on the strength of money that was never taken.
    /// </summary>
    public void Complete(PaymentMethod finalMethod)
    {
        if (Status != OrderStatus.InProgress) throw new DomainException("Order.NotInProgress", "سفارش در حال انجام نیست.");
        // انعام روشِ تسویه‌ی بدهیِ سفارش نیست؛ نمی‌تواند روشِ نهاییِ پرداخت باشد.
        if (finalMethod == PaymentMethod.Tip) throw new DomainException("Order.InvalidFinalMethod", "انعام نمی‌تواند روش پرداخت نهایی باشد.");
        // Handing back a car that had nothing done to it closes a sale worth nothing, and hides the
        // work from every report. A mistaken booking is cancelled instead.
        if (_lines.Count == 0)
            throw new DomainException("Order.NoLines", "هیچ خدمتی روی سفارش ثبت نشده؛ ابتدا خدمت اضافه کنید یا سفارش را لغو کنید.");
        if (PaidRials < TotalRials)
        {
            var diff = TotalRials - PaidRials;
            AddPayment(finalMethod, diff, null);
        }

        FinalPaymentMethod = finalMethod;

        if (Stage != OrderStage.Delivered)
        {
            CloseOpenBayVisit();
            Stage = OrderStage.Delivered;
            _stageEvents.Add(new OrderStageEvent(Id, TenantId, OrderStage.Delivered, null, null));
        }
        QueuePosition = null;

        Status = OrderStatus.Completed;
        CompletedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel(string? reason)
    {
        if (Status == OrderStatus.Completed) throw new DomainException("Order.AlreadyCompleted", "سفارش تکمیل شده است.");
        CloseOpenBayVisit();
        QueuePosition = null;
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

    /// <summary>
    /// The operator collected this one in cash, so it never passed through the till.
    ///
    /// Recorded rather than left off the order entirely, which is what happens today: the work
    /// still counts towards the worker's tally and the car's history, but the money is kept out
    /// of the carwash's takings so the revenue figures stay true.
    /// </summary>
    public bool PaidDirectlyToWorker { get; private set; }

    public void SetPaidDirectly(bool paidDirectly) => PaidDirectlyToWorker = paidDirectly;

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

/// <summary>
/// Where the car is, from arriving to driving away.
///
/// This is deliberately separate from <see cref="OrderStatus"/>. Status answers a commercial
/// question — is this order open, closed or void — and everything already written against it,
/// including every report, keeps working untouched. Stage answers an operational one: is the
/// car being washed, drying, or waiting for its owner. The two used to be the same field,
/// which is why a bay could only be released by closing the sale.
///
/// The order matters: stages only move forward, and the comparison that enforces that relies
/// on these numbers ascending.
/// </summary>
public enum OrderStage
{
    /// <summary>Booked in at the desk. Not yet queued for anything.</summary>
    Received = 0,
    /// <summary>Waiting for a wash bay. Carries a queue position the customer is told.</summary>
    QueuedForWash = 1,
    Washing = 2,
    /// <summary>Out of the wash bay — which is free again — and waiting for a dry bay.</summary>
    QueuedForDry = 3,
    Drying = 4,
    /// <summary>Wax, polish or another add-on, usually done by the drying crew.</summary>
    OptionServices = 5,
    ReadyForPickup = 6,
    /// <summary>Handed back. Only reachable once nothing is owed.</summary>
    Delivered = 7
}

/// <summary>Which part of the journey a stage belongs to, for bay handling and reporting.</summary>
public static class OrderStageRules
{
    /// <summary>Stages where the car is sitting inside a bay rather than waiting for one.</summary>
    public static bool OccupiesBay(OrderStage s) =>
        s is OrderStage.Washing or OrderStage.Drying or OrderStage.OptionServices;

    /// <summary>Stages where the car is in a line, and therefore has a position in it.</summary>
    public static bool IsQueue(OrderStage s) =>
        s is OrderStage.QueuedForWash or OrderStage.QueuedForDry;

    /// <summary>The kind of bay a stage needs, or null when it needs none.</summary>
    public static BayType? RequiredBay(OrderStage s) => s switch
    {
        OrderStage.Washing => BayType.Wash,
        OrderStage.Drying => BayType.Dry,
        OrderStage.OptionServices => BayType.Dry,
        _ => null,
    };
}

/// <summary>
/// One car sitting in one bay, from the moment it drove in to the moment it left.
///
/// The order records the bay it is in right now, which is all the board needs. This records
/// every bay it was ever in, which is what the reports need: a car is washed in bay 3 and
/// dried in bay 9, and "how many cars did bay 9 handle today" cannot be answered from a single
/// field that has since been overwritten.
/// </summary>
public sealed class OrderBayVisit : Entity<Guid>, ITenantScoped
{
    private OrderBayVisit() { }

    public OrderBayVisit(Guid orderId, Guid tenantId, Guid bayId, OrderStage stage)
    {
        Id = Guid.NewGuid();
        OrderId = orderId;
        TenantId = tenantId;
        BayId = bayId;
        Stage = stage;
        EnteredAtUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public Guid OrderId { get; private set; }
    public Guid BayId { get; private set; }
    /// <summary>What was being done to the car while it was in this bay.</summary>
    public OrderStage Stage { get; private set; }
    public DateTime EnteredAtUtc { get; private set; }
    public DateTime? LeftAtUtc { get; private set; }

    public int? Minutes => LeftAtUtc.HasValue
        ? Math.Max(0, (int)Math.Round((LeftAtUtc.Value - EnteredAtUtc).TotalMinutes))
        : null;

    public void Leave() => LeftAtUtc ??= DateTime.UtcNow;
}

/// <summary>
/// One stage change, kept rather than overwritten.
///
/// The current stage alone would answer "where is this car"; the manager also asked how long
/// each part took and who moved it along, which only a log can answer. Storing the moments
/// means a duration is measured rather than estimated.
/// </summary>
public sealed class OrderStageEvent : Entity<Guid>, ITenantScoped
{
    private OrderStageEvent() { }

    public OrderStageEvent(Guid orderId, Guid tenantId, OrderStage stage, Guid? byUserId, string? note)
    {
        Id = Guid.NewGuid();
        OrderId = orderId;
        TenantId = tenantId;
        Stage = stage;
        ByUserId = byUserId;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        AtUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public Guid OrderId { get; private set; }
    public OrderStage Stage { get; private set; }
    public DateTime AtUtc { get; private set; }
    public Guid? ByUserId { get; private set; }
    public string? Note { get; private set; }
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
