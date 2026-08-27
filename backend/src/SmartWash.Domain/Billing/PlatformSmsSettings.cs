using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Billing;

/// <summary>
/// اتصال سرویس پیامک؛ تک‌ردیفی و صرفاً در اختیار مدیر ارشد پلتفرم.
/// کلید API و خط ارسال هرگز به مستاجر برگردانده نمی‌شود.
/// </summary>
public sealed class PlatformSmsSettings : AggregateRoot<Guid>
{
    private PlatformSmsSettings() { }

    public string Provider { get; private set; } = "sms.ir";
    public string BaseUrl { get; private set; } = "https://api.sms.ir/v1/";
    public string? ApiKey { get; private set; }
    public string? LineNumber { get; private set; }
    public bool IsEnabled { get; private set; }
    public DateTime? LastTestedAtUtc { get; private set; }
    public bool? LastTestSucceeded { get; private set; }
    public string? LastTestMessage { get; private set; }

    /// <summary>ردیف پیش‌فرض؛ تا زمانی که مدیر پلتفرم اتصال را تنظیم نکند غیرفعال است.</summary>
    public static PlatformSmsSettings CreateDefault() => new()
    {
        Id = Guid.NewGuid(), Provider = "sms.ir", BaseUrl = "https://api.sms.ir/v1/",
        IsEnabled = false, CreatedAtUtc = DateTime.UtcNow,
    };

    public void UpdateConnection(string provider, string baseUrl, string? apiKey, string? lineNumber, bool isEnabled, Guid? actorUserId)
    {
        if (string.IsNullOrWhiteSpace(provider))
            throw new DomainException("SmsSettings.ProviderRequired", "نام تامین‌کننده پیامک الزامی است.");
        if (string.IsNullOrWhiteSpace(baseUrl) || !Uri.TryCreate(baseUrl, UriKind.Absolute, out _))
            throw new DomainException("SmsSettings.BaseUrlInvalid", "آدرس سرویس پیامک معتبر نیست.");

        Provider = provider.Trim();
        BaseUrl = baseUrl.Trim().EndsWith('/') ? baseUrl.Trim() : baseUrl.Trim() + "/";
        // ارسال کلید خالی یعنی «تغییرش نده»؛ پاک‌کردن کلید مسیر جداگانه دارد.
        if (!string.IsNullOrWhiteSpace(apiKey)) ApiKey = apiKey.Trim();
        LineNumber = string.IsNullOrWhiteSpace(lineNumber) ? null : lineNumber.Trim();

        if (isEnabled && string.IsNullOrWhiteSpace(ApiKey))
            throw new DomainException("SmsSettings.ApiKeyRequired", "برای فعال‌سازی سرویس، کلید API الزامی است.");

        IsEnabled = isEnabled;
        UpdatedByUserId = actorUserId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void ClearApiKey(Guid? actorUserId)
    {
        ApiKey = null;
        IsEnabled = false;
        UpdatedByUserId = actorUserId;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RecordTest(bool succeeded, string? message)
    {
        LastTestedAtUtc = DateTime.UtcNow;
        LastTestSucceeded = succeeded;
        LastTestMessage = message is null ? null : message[..Math.Min(message.Length, 500)];
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public bool IsUsable => IsEnabled && !string.IsNullOrWhiteSpace(ApiKey);
}
