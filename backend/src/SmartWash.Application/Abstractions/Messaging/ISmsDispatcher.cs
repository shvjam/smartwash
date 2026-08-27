namespace SmartWash.Application.Abstractions.Messaging;

/// <summary>
/// درخواست ارسال از مسیرِ متمرکز پلتفرم. مستاجر هرگز TemplateId تامین‌کننده،
/// کلید API یا خط ارسال را نمی‌بیند؛ فقط کدِ منطقی قالب را می‌دهد.
/// </summary>
public sealed record SmsSendRequest(
    Guid TenantId,
    string TemplateCode,
    string Recipient,
    IReadOnlyDictionary<string, string> Parameters,
    string FallbackBody,
    /// <summary>ارسال‌های خودِ پلتفرم (اطلاع‌رسانی صورتحساب و تعلیق) به مجوز مستاجر نیاز ندارند و رایگان‌اند.</summary>
    bool PlatformOriginated = false);

/// <summary>نتیجه‌ی یک تلاش ارسال؛ همیشه یک ردیفِ قابل‌ممیزی در دفتر مصرف ثبت می‌شود.</summary>
public sealed record SmsSendOutcome(
    bool Sent,
    Guid? UsageRecordId,
    int Units,
    long ChargedAmountRials,
    bool QuotaExceeded,
    string? Error)
{
    public static SmsSendOutcome Failure(Guid? usageRecordId, string error, bool quotaExceeded = false)
        => new(false, usageRecordId, 0, 0, quotaExceeded, error);
}

/// <summary>وضعیت سهمیه پیامک مستاجر در دوره جاری اشتراک.</summary>
public sealed record SmsQuotaSnapshot(
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    int IncludedUnits,
    int UsedUnits,
    int OverageUnits,
    long OverageUnitPriceRials,
    long OverageAmountRials,
    int TemplateLimit,
    int ActiveTemplateCount,
    bool CanSend,
    string? BlockReason);

/// <summary>
/// دروازه‌ی واحدِ ارسال پیامک: کنترل سهمیه پلن، مجوز قالب، ثبت رخداد قابل‌ممیزی
/// و قیمت‌گذاری مازاد. هیچ مسیر دیگری اجازه‌ی ارسالِ مستقیم به تامین‌کننده را ندارد.
/// </summary>
public interface ISmsDispatcher
{
    Task<SmsSendOutcome> SendAsync(SmsSendRequest request, CancellationToken ct = default);

    /// <summary>
    /// ارسالِ خودِ پلتفرم به مخاطبی که مستاجرِ مشخصی ندارد (مثل رمز یک‌بارمصرف بازیابی گذرواژه).
    /// از همان اتصالِ مرکزی استفاده می‌کند ولی در دفتر مصرفِ هیچ مستاجری ثبت و صورتحساب نمی‌شود.
    /// </summary>
    Task<SmsDeliveryResult> SendPlatformAsync(string recipient, string? templateCode,
        IReadOnlyDictionary<string, string> parameters, string fallbackBody, CancellationToken ct = default);

    Task<SmsQuotaSnapshot> GetQuotaAsync(Guid tenantId, CancellationToken ct = default);
}
