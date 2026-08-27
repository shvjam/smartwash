using SmartWash.Domain.Common;

namespace SmartWash.Domain.Operations;

public sealed class AppNotification : Entity<Guid>, ITenantScoped
{
    private AppNotification() { }

    public AppNotification(Guid tenantId, NotificationType type, string title, string body, string? entityType, Guid? entityId)
    {
        Id = Guid.NewGuid();
        TenantId = tenantId;
        Type = type;
        Title = title;
        Body = body;
        EntityType = entityType;
        EntityId = entityId;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public NotificationType Type { get; private set; }
    public string Title { get; private set; } = null!;
    public string Body { get; private set; } = null!;
    public string? EntityType { get; private set; }
    public Guid? EntityId { get; private set; }
    public bool IsRead { get; private set; }
    public DateTime? ReadAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public Guid? UserId { get; private set; }

    public void MarkRead() { IsRead = true; ReadAtUtc = DateTime.UtcNow; }
    public void AssignToUser(Guid userId) => UserId = userId;
}

public enum NotificationType
{
    Info = 0,
    OrderOverdue = 1,
    ReservationReminder = 2,
    LowInventory = 3,
    BillingDue = 4,
    Birthday = 5,
    SupportReply = 6
}

public sealed class SmsMessage : Entity<Guid>, ITenantScoped
{
    private SmsMessage() { }

    public SmsMessage(Guid tenantId, string phone, string body, SmsMessageKind kind, Guid? relatedEntityId)
    {
        Id = Guid.NewGuid();
        TenantId = tenantId;
        Phone = phone;
        Body = body;
        Kind = kind;
        RelatedEntityId = relatedEntityId;
        Status = SmsStatus.Queued;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public string Phone { get; private set; } = null!;
    public string Body { get; private set; } = null!;
    public SmsMessageKind Kind { get; private set; }
    public Guid? RelatedEntityId { get; private set; }
    public SmsStatus Status { get; private set; }
    public string? ProviderMessageId { get; private set; }
    public string? Error { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? SentAtUtc { get; private set; }
    public long CostRials { get; private set; }

    public void MarkSent(string? providerId, long costRials)
    {
        Status = SmsStatus.Sent;
        ProviderMessageId = providerId;
        CostRials = costRials;
        SentAtUtc = DateTime.UtcNow;
    }

    public void MarkFailed(string error)
    {
        Status = SmsStatus.Failed;
        Error = error;
    }
}

public enum SmsMessageKind
{
    Transactional = 0,
    Reminder = 1,
    Campaign = 2,
    Otp = 3
}

public enum SmsStatus
{
    Queued = 0,
    Sent = 1,
    Failed = 2,
    Delivered = 3
}

public sealed class ServiceReminder : Entity<Guid>, ITenantScoped
{
    private ServiceReminder() { }

    public ServiceReminder(Guid tenantId, Guid customerId, Guid? vehicleId, string title, DateTime dueAtUtc, ReminderType type)
    {
        Id = Guid.NewGuid();
        TenantId = tenantId;
        CustomerId = customerId;
        VehicleId = vehicleId;
        Title = title;
        DueAtUtc = dueAtUtc;
        Type = type;
        Status = ReminderStatus.Pending;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public Guid CustomerId { get; private set; }
    public Guid? VehicleId { get; private set; }
    public string Title { get; private set; } = null!;
    public DateTime DueAtUtc { get; private set; }
    public ReminderType Type { get; private set; }
    public ReminderStatus Status { get; private set; }
    public DateTime? SentAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public void MarkSent() { Status = ReminderStatus.Sent; SentAtUtc = DateTime.UtcNow; }
    public void Cancel() { Status = ReminderStatus.Cancelled; }
}

public enum ReminderType
{
    NextWash = 0,
    Polish = 1,
    Detailing = 2,
    Custom = 99
}

public enum ReminderStatus
{
    Pending = 0,
    Sent = 1,
    Cancelled = 2
}
// resync-marker
