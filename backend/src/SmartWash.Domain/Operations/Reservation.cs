using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

public sealed class Reservation : TenantAggregateRoot<Guid>
{
    private readonly List<ReservationService> _services = new();

    private Reservation() { }

    public Guid BranchId { get; private set; }
    public Guid? CustomerId { get; private set; }
    public string CustomerName { get; private set; } = null!;
    public string CustomerPhone { get; private set; } = null!;
    public string VehiclePlate { get; private set; } = null!;
    public string? VehicleBrand { get; private set; }
    public string? VehicleModel { get; private set; }
    public DateTime ScheduledAtUtc { get; private set; }
    public int EstimatedDurationMinutes { get; private set; }
    public Guid? PreferredBayId { get; private set; }
    public ReservationStatus Status { get; private set; }
    public DateTime? ConvertedAtUtc { get; private set; }
    public Guid? ConvertedOrderId { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }
    public string? CancelReason { get; private set; }
    public string? Notes { get; private set; }

    public IReadOnlyCollection<ReservationService> Services => _services.AsReadOnly();

    public static Reservation Create(Guid tenantId, Guid branchId, Guid? customerId, string customerName, string customerPhone,
        string plate, string? brand, string? model, DateTime scheduledAtUtc, int estimatedMinutes, Guid? preferredBayId, string? notes)
    {
        if (scheduledAtUtc < DateTime.UtcNow.AddMinutes(-5))
            throw new DomainException("Reservation.InvalidTime", "زمان رزرو نمی‌تواند گذشته باشد.");

        return new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            CustomerId = customerId,
            CustomerName = customerName.Trim(),
            CustomerPhone = customerPhone.Trim(),
            VehiclePlate = plate.Trim(),
            VehicleBrand = brand?.Trim(),
            VehicleModel = model?.Trim(),
            ScheduledAtUtc = scheduledAtUtc,
            EstimatedDurationMinutes = estimatedMinutes,
            PreferredBayId = preferredBayId,
            Status = ReservationStatus.Pending,
            Notes = notes?.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void AddService(Guid serviceId, string name, long price, int duration)
    {
        _services.Add(new ReservationService(Id, TenantId, serviceId, name, price, duration));
        EstimatedDurationMinutes = _services.Sum(s => s.DurationMinutes);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Confirm()
    {
        if (Status != ReservationStatus.Pending) throw new DomainException("Reservation.NotPending", "رزرو در وضعیت در انتظار نیست.");
        Status = ReservationStatus.Confirmed;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkArrived(Guid orderId)
    {
        // فقط رزروِ در انتظار یا تأییدشده می‌تواند به سفارش تبدیل شود؛ جلوگیری از تبدیلِ دوباره یا احیای رزروِ بسته‌شده.
        if (Status is not (ReservationStatus.Pending or ReservationStatus.Confirmed))
            throw new DomainException("Reservation.NotConvertible", "رزرو در وضعیت قابل تبدیل به سفارش نیست.");
        Status = ReservationStatus.Arrived;
        ConvertedAtUtc = DateTime.UtcNow;
        ConvertedOrderId = orderId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel(string? reason)
    {
        if (Status is ReservationStatus.Cancelled or ReservationStatus.NoShow or ReservationStatus.Arrived)
            throw new DomainException("Reservation.AlreadyClosed", "رزرو در وضعیت قابل لغو نیست.");
        Status = ReservationStatus.Cancelled;
        CancelledAtUtc = DateTime.UtcNow;
        CancelReason = reason;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkNoShow()
    {
        // فقط رزروِ در انتظار یا تأییدشده می‌تواند «عدم مراجعه» شود؛ نه رزروِ تبدیل‌شده/لغوشده.
        if (Status is not (ReservationStatus.Pending or ReservationStatus.Confirmed))
            throw new DomainException("Reservation.NotClosable", "رزرو در وضعیت قابل ثبتِ عدم‌مراجعه نیست.");
        Status = ReservationStatus.NoShow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public sealed class ReservationService : Entity<Guid>, ITenantScoped
{
    private ReservationService() { }

    internal ReservationService(Guid reservationId, Guid tenantId, Guid serviceId, string name, long price, int duration)
    {
        Id = Guid.NewGuid();
        ReservationId = reservationId;
        TenantId = tenantId;
        ServiceId = serviceId;
        ServiceName = name;
        PriceRials = price;
        DurationMinutes = duration;
    }

    public Guid ReservationId { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid ServiceId { get; private set; }
    public string ServiceName { get; private set; } = null!;
    public long PriceRials { get; private set; }
    public int DurationMinutes { get; private set; }
}

public enum ReservationStatus
{
    Pending = 0,
    Confirmed = 1,
    Arrived = 2,
    NoShow = 3,
    Cancelled = 4
}
// resync-marker
