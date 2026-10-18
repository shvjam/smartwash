using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

public sealed class Campaign : TenantAggregateRoot<Guid>
{
    private Campaign() { }

    public string Name { get; private set; } = null!;
    public CampaignType Type { get; private set; }
    public CampaignStatus Status { get; private set; }
    public CampaignTarget Target { get; private set; }
    public string MessageTemplate { get; private set; } = null!;
    public DateTime? ScheduledAtUtc { get; private set; }
    public DateTime? StartedAtUtc { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }
    public int? TargetMinVisits { get; private set; }
    public int? TargetDaysSinceLastVisit { get; private set; }
    public LoyaltyTier? TargetMinTier { get; private set; }
    public int RecipientCount { get; private set; }
    public int SuccessCount { get; private set; }
    public int FailedCount { get; private set; }
    public long EstimatedCostRials { get; private set; }
    public long ActualCostRials { get; private set; }

    public static Campaign Create(Guid tenantId, string name, CampaignType type, CampaignTarget target,
        string template, DateTime? scheduledAtUtc)
    {
        return new Campaign
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name.Trim(),
            Type = type,
            Target = target,
            MessageTemplate = template,
            ScheduledAtUtc = scheduledAtUtc,
            Status = CampaignStatus.Draft,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void SetSegmentFilters(int? minVisits, int? daysSinceLastVisit, LoyaltyTier? minTier)
    {
        TargetMinVisits = minVisits;
        TargetDaysSinceLastVisit = daysSinceLastVisit;
        TargetMinTier = minTier;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /*
      A campaign is the one thing in this system that reaches every customer at once and bills
      the tenant per message, so its status is not a label — it is the gate the dispatcher
      reads. The dispatcher sends anything that is Scheduled and due, which means a status
      that can be set from anywhere can send the same blast twice. These three transitions
      therefore state where they may be entered from.
    */

    public void Schedule(DateTime scheduledAtUtc)
    {
        if (Status is not (CampaignStatus.Draft or CampaignStatus.Scheduled))
            throw new DomainException("Campaign.NotSchedulable",
                "فقط کمپین پیش‌نویس یا زمان‌بندی‌شده را می‌توان زمان‌بندی کرد.");

        ScheduledAtUtc = scheduledAtUtc;
        Status = CampaignStatus.Scheduled;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Start()
    {
        if (Status != CampaignStatus.Scheduled)
            throw new DomainException("Campaign.NotScheduled", "کمپین زمان‌بندی نشده است.");

        Status = CampaignStatus.Sending;
        StartedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Complete(int success, int failed, long actualCost)
    {
        Status = CampaignStatus.Completed;
        SuccessCount = success;
        FailedCount = failed;
        ActualCostRials = actualCost;
        CompletedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetRecipientCount(int count, long estimatedCost) { RecipientCount = count; EstimatedCostRials = estimatedCost; UpdatedAtUtc = DateTime.UtcNow; }

    public void Cancel()
    {
        // A campaign that has already gone out cannot be recalled, and saying otherwise on a
        // screen is worse than refusing.
        if (Status is CampaignStatus.Completed or CampaignStatus.Sending)
            throw new DomainException("Campaign.AlreadySent", "کمپین ارسال شده است و لغو نمی‌شود.");
        if (Status == CampaignStatus.Cancelled) return;

        Status = CampaignStatus.Cancelled;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public enum CampaignType { Sms = 0, Email = 1, Push = 2 }
public enum CampaignStatus { Draft = 0, Scheduled = 1, Sending = 2, Completed = 3, Cancelled = 4, Failed = 5 }
public enum CampaignTarget { AllCustomers = 0, ActiveCustomers = 1, InactiveCustomers = 2, ByTier = 3, Birthday = 4, Custom = 99 }
// resync-marker
