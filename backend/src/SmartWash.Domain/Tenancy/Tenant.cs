using SmartWash.Domain.Common;
using SmartWash.Domain.Tenancy.Events;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Tenancy;

public sealed class Tenant : AggregateRoot<Guid>
{
    private Tenant() { }

    public string Slug { get; private set; } = null!;
    public string DisplayName { get; private set; } = null!;
    public string OwnerEmail { get; private set; } = null!;
    public string? OwnerPhone { get; private set; }
    public string? LogoUrl { get; private set; }
    public string? PrimaryColor { get; private set; }
    public string TimeZone { get; private set; } = "Asia/Tehran";
    public string Locale { get; private set; } = "fa-IR";
    public string Currency { get; private set; } = "IRT";

    public TenantStatus Status { get; private set; }
    public DateTime? TrialEndsAtUtc { get; private set; }
    public DateTime? SuspendedAtUtc { get; private set; }
    public string? SuspendReason { get; private set; }
    public DateTime? ArchivedAtUtc { get; private set; }

    public Guid? ActiveSubscriptionId { get; private set; }

    public static Tenant Create(string slug, string displayName, string ownerEmail, string? ownerPhone, int trialDays)
    {
        if (string.IsNullOrWhiteSpace(slug)) throw new DomainException("Tenant.SlugRequired", "نامک الزامی است.");
        if (string.IsNullOrWhiteSpace(displayName)) throw new DomainException("Tenant.NameRequired", "نام مستاجر الزامی است.");
        if (string.IsNullOrWhiteSpace(ownerEmail)) throw new DomainException("Tenant.EmailRequired", "ایمیل مالک الزامی است.");

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Slug = slug.Trim().ToLowerInvariant(),
            DisplayName = displayName.Trim(),
            OwnerEmail = ownerEmail.Trim().ToLowerInvariant(),
            OwnerPhone = ownerPhone?.Trim(),
            Status = TenantStatus.Trial,
            TrialEndsAtUtc = DateTime.UtcNow.AddDays(trialDays),
            CreatedAtUtc = DateTime.UtcNow
        };

        tenant.Raise(new TenantCreatedEvent(tenant.Id, tenant.Slug, tenant.OwnerEmail));
        return tenant;
    }

    public void UpdateBranding(string? logoUrl, string? primaryColor, string? displayName)
    {
        if (!string.IsNullOrWhiteSpace(displayName)) DisplayName = displayName.Trim();
        LogoUrl = logoUrl;
        PrimaryColor = primaryColor;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Activate(Guid subscriptionId)
    {
        if (Status == TenantStatus.Archived) throw new DomainException("Tenant.Archived", "مستاجر آرشیو شده قابل فعال‌سازی نیست.");
        Status = TenantStatus.Active;
        ActiveSubscriptionId = subscriptionId;
        SuspendedAtUtc = null;
        SuspendReason = null;
        UpdatedAtUtc = DateTime.UtcNow;
        Raise(new TenantActivatedEvent(Id));
    }

    public void EnterGracePeriod()
    {
        if (Status != TenantStatus.Active && Status != TenantStatus.Trial) return;
        Status = TenantStatus.Grace;
        UpdatedAtUtc = DateTime.UtcNow;
        Raise(new TenantEnteredGraceEvent(Id));
    }

    public void Suspend(string reason)
    {
        Status = TenantStatus.Suspended;
        SuspendedAtUtc = DateTime.UtcNow;
        SuspendReason = reason;
        UpdatedAtUtc = DateTime.UtcNow;
        Raise(new TenantSuspendedEvent(Id, reason));
    }

    public void Cancel()
    {
        Status = TenantStatus.Cancelled;
        UpdatedAtUtc = DateTime.UtcNow;
        Raise(new TenantCancelledEvent(Id));
    }

    public void Archive()
    {
        Status = TenantStatus.Archived;
        ArchivedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public bool CanAccess() => Status is TenantStatus.Trial or TenantStatus.Active or TenantStatus.Grace;
    public bool IsReadOnly() => Status is TenantStatus.Grace;
}

public enum TenantStatus
{
    Trial = 0,
    Active = 1,
    Grace = 2,
    Suspended = 3,
    Cancelled = 4,
    Expired = 5,
    Archived = 6
}
// resync-marker
