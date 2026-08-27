using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Billing;

/// <summary>Provider template managed only by the SmartWash platform.</summary>
public sealed class PlatformSmsTemplate : AggregateRoot<Guid>
{
    private PlatformSmsTemplate() { }

    public string Code { get; private set; } = null!;
    public string DisplayName { get; private set; } = null!;
    public int ProviderTemplateId { get; private set; }
    public SmsTemplateCategory Category { get; private set; }
    public string ParametersJson { get; private set; } = "[]";
    public bool IsTenantAvailable { get; private set; }
    public bool IsActive { get; private set; }

    public static PlatformSmsTemplate Create(string code, string displayName, int providerTemplateId,
        SmsTemplateCategory category, string? parametersJson, bool isTenantAvailable)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new DomainException("SmsTemplate.CodeRequired", "کد قالب پیامک الزامی است.");
        if (providerTemplateId <= 0) throw new DomainException("SmsTemplate.ProviderIdInvalid", "شناسه قالب تامین‌کننده معتبر نیست.");
        return new PlatformSmsTemplate
        {
            Id = Guid.NewGuid(), Code = code.Trim(), DisplayName = displayName.Trim(),
            ProviderTemplateId = providerTemplateId, Category = category,
            ParametersJson = string.IsNullOrWhiteSpace(parametersJson) ? "[]" : parametersJson,
            IsTenantAvailable = isTenantAvailable, IsActive = true, CreatedAtUtc = DateTime.UtcNow,
        };
    }

    public void Update(string displayName, int providerTemplateId, SmsTemplateCategory category, string? parametersJson, bool isTenantAvailable)
    {
        if (providerTemplateId <= 0) throw new DomainException("SmsTemplate.ProviderIdInvalid", "شناسه قالب تامین‌کننده معتبر نیست.");
        DisplayName = displayName.Trim(); ProviderTemplateId = providerTemplateId; Category = category;
        ParametersJson = string.IsNullOrWhiteSpace(parametersJson) ? "[]" : parametersJson;
        IsTenantAvailable = isTenantAvailable; UpdatedAtUtc = DateTime.UtcNow;
    }
    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTime.UtcNow; }
}

public sealed class TenantSmsTemplate : Entity<Guid>, ITenantScoped
{
    private TenantSmsTemplate() { }
    public Guid TenantId { get; private set; }
    public Guid TemplateId { get; private set; }
    public DateTime EnabledAtUtc { get; private set; }
    public static TenantSmsTemplate Enable(Guid tenantId, Guid templateId) => new()
    { Id = Guid.NewGuid(), TenantId = tenantId, TemplateId = templateId, EnabledAtUtc = DateTime.UtcNow };
}

/// <summary>Immutable, billable unit ledger. Only Sent rows are invoiced.</summary>
public sealed class SmsUsageRecord : Entity<Guid>, ITenantScoped
{
    private SmsUsageRecord() { }
    public Guid TenantId { get; private set; }
    public Guid? SubscriptionId { get; private set; }
    public Guid? TemplateId { get; private set; }
    public string Purpose { get; private set; } = null!;
    public string Recipient { get; private set; } = null!;
    public int Units { get; private set; }
    public long OverageUnitPriceRials { get; private set; }
    public SmsUsageStatus Status { get; private set; }
    public string? ProviderMessageId { get; private set; }
    public string? Error { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }

    public static SmsUsageRecord Queue(Guid tenantId, Guid? subscriptionId, Guid? templateId, string purpose, string recipient, int units, long overageUnitPriceRials) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenantId, SubscriptionId = subscriptionId, TemplateId = templateId,
        Purpose = purpose, Recipient = recipient, Units = Math.Max(1, units),
        OverageUnitPriceRials = Math.Max(0, overageUnitPriceRials), Status = SmsUsageStatus.Queued, OccurredAtUtc = DateTime.UtcNow,
    };
    public void MarkSent(string? providerMessageId) { Status = SmsUsageStatus.Sent; ProviderMessageId = providerMessageId; }
    public void MarkFailed(string error) { Status = SmsUsageStatus.Failed; Error = error?[..Math.Min(error.Length, 1000)]; }

    /// <summary>
    /// فقط ارسال‌های موفق قابل صورتحساب‌اند؛ پس از درج در فاکتورِ دوره، ردیف قفل می‌شود
    /// تا در دوره‌های بعدی دوباره محاسبه نشود.
    /// </summary>
    public void MarkInvoiced()
    {
        if (Status != SmsUsageStatus.Sent)
            throw new DomainException("SmsUsage.NotBillable", "تنها ارسال‌های موفق قابل صورتحساب هستند.");
        Status = SmsUsageStatus.Invoiced;
    }

    /// <summary>مبلغ قابل مطالبه این ردیف (ریال)؛ برای مصرفِ داخل سهمیه صفر است.</summary>
    public long BillableAmountRials => Status is SmsUsageStatus.Sent or SmsUsageStatus.Invoiced
        ? Units * OverageUnitPriceRials
        : 0;
}

public enum SmsTemplateCategory { Transactional = 0, Reminder = 1, Campaign = 2, Billing = 3 }
public enum SmsUsageStatus { Queued = 0, Sent = 1, Failed = 2, Invoiced = 3 }
