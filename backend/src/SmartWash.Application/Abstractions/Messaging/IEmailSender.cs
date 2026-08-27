namespace SmartWash.Application.Abstractions.Messaging;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default);
}

/// <summary>
/// Logical sms.ir template keys. Map to concrete TemplateIds via configuration (Sms:Templates).
/// </summary>
public static class SmsPurpose
{
    public const string OtpLogin = "OtpLogin";
    public const string PasswordReset = "PasswordReset";
    public const string OrderReady = "OrderReady";
    public const string ReservationConfirmed = "ReservationConfirmed";
    public const string ReservationReminder = "ReservationReminder";
    public const string Campaign = "Campaign";
    public const string BillingReminder = "BillingReminder";
    public const string BillingPastDue = "BillingPastDue";
    public const string BillingSuspended = "BillingSuspended";
}

/// <summary>
/// اعتبارنامه‌ی اتصال که در زمان اجرا از تنظیمات پلتفرم (دیتابیس) خوانده و به فرستنده تزریق می‌شود؛
/// اگر null باشد، مقادیر appsettings استفاده می‌شوند.
/// </summary>
public sealed record SmsCredentials(string ApiKey, string? LineNumber, string? BaseUrl);

/// <summary>نتیجه‌ی قطعی یک تلاش ارسال — برخلاف متدهای void، خطا را پنهان نمی‌کند.</summary>
public sealed record SmsDeliveryResult(bool Succeeded, string? ProviderMessageId, string? Error)
{
    public static SmsDeliveryResult Ok(string? id) => new(true, id, null);
    public static SmsDeliveryResult Fail(string error) => new(false, null, error);
}

public interface ISmsSender
{
    /// <summary>ارسال قالبی با نتیجه‌ی قطعی و امکانِ override اعتبارنامه — مسیرِ مورد استفاده‌ی دروازه‌ی متمرکز.</summary>
    Task<SmsDeliveryResult> TrySendVerifyAsync(string phone, int templateId,
        IReadOnlyDictionary<string, string> parameters, SmsCredentials? credentials, CancellationToken ct = default);

    /// <summary>ارسال متنِ آزاد با نتیجه‌ی قطعی و امکانِ override اعتبارنامه.</summary>
    Task<SmsDeliveryResult> TrySendTextAsync(string phone, string body,
        SmsCredentials? credentials, CancellationToken ct = default);

    /// <summary>Free-form SMS via the configured bulk line.</summary>
    Task SendAsync(string phone, string body, CancellationToken ct = default);

    /// <summary>Send by raw sms.ir TemplateId with named parameters.</summary>
    Task SendVerifyAsync(string phone, int templateId, IReadOnlyDictionary<string, string> parameters, CancellationToken ct = default);

    /// <summary>
    /// Send by logical purpose (see <see cref="SmsPurpose"/>). The infrastructure looks up the TemplateId
    /// from Sms:Templates configuration. Falls back to free-form <see cref="SendAsync"/> with <paramref name="fallbackBody"/>
    /// when no template is configured for the given purpose.
    /// </summary>
    Task SendByPurposeAsync(string phone, string purpose, IReadOnlyDictionary<string, string> parameters, string fallbackBody, CancellationToken ct = default);
}
// resync-marker
