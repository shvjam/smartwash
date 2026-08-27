using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Support;

/// <summary>
/// تیکت پشتیبانی بین مستاجر و پلتفرم. مالکیت رکورد با مستاجر است (ITenantScoped)
/// و پنل پلتفرم با IgnoreQueryFilters همه‌ی تیکت‌ها را می‌بیند.
/// </summary>
public sealed class Ticket : TenantAggregateRoot<Guid>
{
    private Ticket() { }

    public string Number { get; private set; } = null!;
    public string Subject { get; private set; } = null!;
    public TicketCategory Category { get; private set; }
    public TicketPriority Priority { get; private set; }
    public TicketStatus Status { get; private set; }

    public Guid RequesterUserId { get; private set; }
    public string RequesterName { get; private set; } = null!;
    public string? RequesterPhone { get; private set; }
    public Guid? BranchId { get; private set; }

    /// <summary>موجودیت مرتبط اختیاری (سفارش، فاکتور، اشتراک…) برای پیوند سریع.</summary>
    public string? RelatedEntityType { get; private set; }
    public Guid? RelatedEntityId { get; private set; }

    public Guid? AssignedToUserId { get; private set; }
    public DateTime? AssignedAtUtc { get; private set; }

    // SLA
    public DateTime DueAtUtc { get; private set; }
    public DateTime? FirstResponseAtUtc { get; private set; }
    public DateTime? ResolvedAtUtc { get; private set; }
    public DateTime? ClosedAtUtc { get; private set; }
    public Guid? ClosedByUserId { get; private set; }

    // وضعیت گفتگو
    public DateTime LastMessageAtUtc { get; private set; }
    public TicketActorSide LastMessageSide { get; private set; }
    public int MessageCount { get; private set; }
    public int UnreadForTenant { get; private set; }
    public int UnreadForPlatform { get; private set; }
    public int ReopenCount { get; private set; }

    // رضایت‌سنجی
    public int? SatisfactionRating { get; private set; }
    public string? SatisfactionComment { get; private set; }
    public DateTime? RatedAtUtc { get; private set; }

    public bool IsOpen => Status is not (TicketStatus.Resolved or TicketStatus.Closed or TicketStatus.Cancelled);

    /// <summary>نقض SLA فقط تا زمانی معنا دارد که هنوز پاسخ اولی داده نشده باشد.</summary>
    public bool IsSlaBreached(DateTime nowUtc) =>
        FirstResponseAtUtc is null && IsOpen && nowUtc > DueAtUtc;

    public static Ticket Create(
        Guid tenantId, string number, string subject, TicketCategory category, TicketPriority priority,
        Guid requesterUserId, string requesterName, string? requesterPhone, Guid? branchId,
        string? relatedEntityType, Guid? relatedEntityId)
    {
        if (string.IsNullOrWhiteSpace(subject))
            throw new DomainException("Ticket.SubjectRequired", "عنوان تیکت الزامی است.");

        var now = DateTime.UtcNow;
        return new Ticket
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Number = number,
            Subject = subject.Trim(),
            Category = category,
            Priority = priority,
            Status = TicketStatus.New,
            RequesterUserId = requesterUserId,
            RequesterName = requesterName.Trim(),
            RequesterPhone = string.IsNullOrWhiteSpace(requesterPhone) ? null : requesterPhone.Trim(),
            BranchId = branchId,
            RelatedEntityType = string.IsNullOrWhiteSpace(relatedEntityType) ? null : relatedEntityType.Trim(),
            RelatedEntityId = relatedEntityId,
            DueAtUtc = now.AddHours(SlaHours(priority)),
            LastMessageAtUtc = now,
            LastMessageSide = TicketActorSide.Tenant,
            MessageCount = 1,
            UnreadForPlatform = 1,
            CreatedAtUtc = now,
        };
    }

    /// <summary>مهلت پاسخ اولیه بر حسب ساعت، بر اساس اولویت.</summary>
    public static int SlaHours(TicketPriority priority) => priority switch
    {
        TicketPriority.Urgent => 4,
        TicketPriority.High => 12,
        TicketPriority.Normal => 48,
        _ => 96,
    };

    /// <summary>ثبت یک پیام جدید در گفتگو و به‌روزرسانی وضعیت/شمارنده‌ها.</summary>
    public void RegisterMessage(TicketActorSide side, bool isInternalNote)
    {
        if (Status == TicketStatus.Cancelled)
            throw new DomainException("Ticket.Cancelled", "تیکت لغو شده است و امکان ارسال پیام وجود ندارد.");

        var now = DateTime.UtcNow;
        MessageCount++;
        UpdatedAtUtc = now;

        // یادداشت داخلی فقط برای تیم پلتفرم است؛ نه SLA را می‌بندد نه به مستاجر نشان داده می‌شود.
        if (isInternalNote) return;

        LastMessageAtUtc = now;
        LastMessageSide = side;

        if (side == TicketActorSide.Platform)
        {
            FirstResponseAtUtc ??= now;
            UnreadForTenant++;
            UnreadForPlatform = 0;
            if (Status is TicketStatus.New or TicketStatus.InProgress)
                Status = TicketStatus.AwaitingCustomer;
        }
        else
        {
            UnreadForPlatform++;
            UnreadForTenant = 0;
            // پاسخ مستاجر روی تیکت حل‌شده، آن را دوباره باز می‌کند.
            if (Status == TicketStatus.Resolved)
            {
                ResolvedAtUtc = null;
                ReopenCount++;
                Status = TicketStatus.InProgress;
            }
            else if (Status is TicketStatus.AwaitingCustomer or TicketStatus.New)
            {
                Status = TicketStatus.InProgress;
            }
        }
    }

    public void MarkReadBy(TicketActorSide side)
    {
        if (side == TicketActorSide.Platform) UnreadForPlatform = 0;
        else UnreadForTenant = 0;
    }

    public void ChangeStatus(TicketStatus status, Guid? actorUserId)
    {
        if (Status == status) return;
        if (Status == TicketStatus.Closed && status != TicketStatus.InProgress)
            throw new DomainException("Ticket.Closed", "تیکت بسته شده است؛ ابتدا باید بازگشایی شود.");

        Status = status;
        var now = DateTime.UtcNow;
        UpdatedAtUtc = now;

        switch (status)
        {
            case TicketStatus.Resolved:
                ResolvedAtUtc = now;
                break;
            case TicketStatus.Closed:
            case TicketStatus.Cancelled:
                ClosedAtUtc = now;
                ClosedByUserId = actorUserId;
                break;
            case TicketStatus.InProgress:
                ResolvedAtUtc = null;
                ClosedAtUtc = null;
                ClosedByUserId = null;
                break;
        }
    }

    public void Reopen(Guid? actorUserId)
    {
        if (IsOpen) throw new DomainException("Ticket.AlreadyOpen", "این تیکت هم‌اکنون باز است.");
        Status = TicketStatus.InProgress;
        ResolvedAtUtc = null;
        ClosedAtUtc = null;
        ClosedByUserId = null;
        ReopenCount++;
        // مهلت پاسخ برای دور جدید بازنشانی می‌شود.
        FirstResponseAtUtc = null;
        DueAtUtc = DateTime.UtcNow.AddHours(SlaHours(Priority));
        UpdatedAtUtc = DateTime.UtcNow;
        _ = actorUserId;
    }

    public void ChangePriority(TicketPriority priority)
    {
        if (Priority == priority) return;
        Priority = priority;
        // تا وقتی پاسخ اولی داده نشده، تغییر اولویت مهلت را بازمحاسبه می‌کند.
        if (FirstResponseAtUtc is null)
            DueAtUtc = CreatedAtUtc.AddHours(SlaHours(priority));
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void ChangeCategory(TicketCategory category)
    {
        Category = category;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AssignTo(Guid? agentUserId)
    {
        AssignedToUserId = agentUserId;
        AssignedAtUtc = agentUserId.HasValue ? DateTime.UtcNow : null;
        if (agentUserId.HasValue && Status == TicketStatus.New)
            Status = TicketStatus.InProgress;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Rate(int rating, string? comment)
    {
        if (rating is < 1 or > 5)
            throw new DomainException("Ticket.RatingInvalid", "امتیاز باید بین ۱ تا ۵ باشد.");
        if (IsOpen)
            throw new DomainException("Ticket.NotResolved", "ثبت رضایت فقط پس از حل یا بستن تیکت ممکن است.");
        if (SatisfactionRating.HasValue)
            throw new DomainException("Ticket.AlreadyRated", "برای این تیکت قبلاً امتیاز ثبت شده است.");

        SatisfactionRating = rating;
        SatisfactionComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        RatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = RatedAtUtc;
    }
}

/// <summary>یک پیام در گفتگوی تیکت. یادداشت داخلی فقط برای پلتفرم قابل مشاهده است.</summary>
public sealed class TicketMessage : Entity<Guid>, ITenantScoped
{
    private TicketMessage() { }

    public Guid TenantId { get; private set; }
    public Guid TicketId { get; private set; }
    public Guid? AuthorUserId { get; private set; }
    public string AuthorName { get; private set; } = null!;
    public TicketActorSide AuthorSide { get; private set; }
    public string Body { get; private set; } = null!;
    public bool IsInternalNote { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public static TicketMessage Create(Guid tenantId, Guid ticketId, Guid? authorUserId, string authorName,
        TicketActorSide side, string body, bool isInternalNote)
    {
        if (string.IsNullOrWhiteSpace(body))
            throw new DomainException("TicketMessage.BodyRequired", "متن پیام الزامی است.");
        return new TicketMessage
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TicketId = ticketId,
            AuthorUserId = authorUserId,
            AuthorName = authorName.Trim(),
            AuthorSide = side,
            Body = body.Trim(),
            // یادداشت داخلی فقط از سمت پلتفرم معنا دارد.
            IsInternalNote = isInternalNote && side == TicketActorSide.Platform,
            CreatedAtUtc = DateTime.UtcNow,
        };
    }
}

public sealed class TicketAttachment : Entity<Guid>, ITenantScoped
{
    private TicketAttachment() { }

    public Guid TenantId { get; private set; }
    public Guid TicketId { get; private set; }
    public Guid? MessageId { get; private set; }
    public string FileName { get; private set; } = null!;
    public string Path { get; private set; } = null!;
    public string Url { get; private set; } = null!;
    public string ContentType { get; private set; } = null!;
    public long SizeBytes { get; private set; }
    public Guid? UploadedByUserId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public static TicketAttachment Create(Guid tenantId, Guid ticketId, Guid? messageId, string fileName,
        string path, string url, string contentType, long sizeBytes, Guid? uploadedByUserId) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        TicketId = ticketId,
        MessageId = messageId,
        FileName = fileName.Trim(),
        Path = path,
        Url = url,
        ContentType = contentType,
        SizeBytes = sizeBytes,
        UploadedByUserId = uploadedByUserId,
        CreatedAtUtc = DateTime.UtcNow,
    };
}

/// <summary>تاریخچه‌ی تغییرات تیکت برای حسابرسی و نمایش timeline.</summary>
public sealed class TicketEvent : Entity<Guid>, ITenantScoped
{
    private TicketEvent() { }

    public Guid TenantId { get; private set; }
    public Guid TicketId { get; private set; }
    public TicketEventType Type { get; private set; }
    public string? FromValue { get; private set; }
    public string? ToValue { get; private set; }
    public string? Note { get; private set; }
    public Guid? ActorUserId { get; private set; }
    public string ActorName { get; private set; } = null!;
    public TicketActorSide ActorSide { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }

    public static TicketEvent Create(Guid tenantId, Guid ticketId, TicketEventType type, Guid? actorUserId,
        string actorName, TicketActorSide side, string? fromValue = null, string? toValue = null, string? note = null) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        TicketId = ticketId,
        Type = type,
        ActorUserId = actorUserId,
        ActorName = actorName.Trim(),
        ActorSide = side,
        FromValue = fromValue,
        ToValue = toValue,
        Note = note,
        OccurredAtUtc = DateTime.UtcNow,
    };
}

public enum TicketStatus
{
    New = 0,
    InProgress = 1,
    AwaitingCustomer = 2,
    Resolved = 3,
    Closed = 4,
    Cancelled = 5,
}

public enum TicketPriority
{
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3,
}

public enum TicketCategory
{
    Technical = 0,
    Billing = 1,
    Sms = 2,
    FeatureRequest = 3,
    Training = 4,
    Bug = 5,
    Other = 99,
}

public enum TicketActorSide
{
    Tenant = 0,
    Platform = 1,
}

public enum TicketEventType
{
    Created = 0,
    Message = 1,
    StatusChanged = 2,
    PriorityChanged = 3,
    CategoryChanged = 4,
    Assigned = 5,
    Resolved = 6,
    Closed = 7,
    Reopened = 8,
    Rated = 9,
    AttachmentAdded = 10,
}
