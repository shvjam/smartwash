using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Billing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace SmartWash.Infrastructure.Messaging.Sms;

/// <summary>
/// دروازه‌ی متمرکز ارسال پیامک.
///
/// قواعدِ ثابت:
///   ۱. اتصال، کلید API و خط ارسال فقط از تنظیماتِ پلتفرم خوانده می‌شود؛ مستاجر دخالتی ندارد.
///   ۲. مستاجر تنها می‌تواند از قالب‌هایی استفاده کند که پلتفرم در اختیارش گذاشته و خودش فعال کرده است.
///   ۳. هر تلاش ارسال — موفق یا ناموفق — یک ردیفِ قابل‌ممیزی در دفتر مصرف می‌سازد.
///   ۴. فقط ارسال‌های موفقِ خارج از سهمیه قیمت می‌خورند؛ نرخ مازاد از پلن خوانده می‌شود
///      و اگر نرخ تعریف نشده باشد، ارسالِ فراتر از سهمیه انجام نمی‌شود (به مستاجر هزینه‌ی تحمیلی نمی‌خورد).
/// </summary>
public sealed class SmsDispatcher : ISmsDispatcher
{
    private readonly IAppDbContext _db;
    private readonly ISmsSender _sender;
    private readonly ILogger<SmsDispatcher> _log;

    public SmsDispatcher(IAppDbContext db, ISmsSender sender, ILogger<SmsDispatcher> log)
    {
        _db = db;
        _sender = sender;
        _log = log;
    }

    public async Task<SmsSendOutcome> SendAsync(SmsSendRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Recipient))
            return SmsSendOutcome.Failure(null, "شماره گیرنده خالی است.");

        var settings = await _db.PlatformSmsSettings.FirstOrDefaultAsync(ct);
        var template = await _db.PlatformSmsTemplates
            .FirstOrDefaultAsync(t => t.Code == request.TemplateCode && t.IsActive, ct);

        var context = await LoadBillingContextAsync(request.TenantId, ct);

        // قیمتِ واحد پیش از ارسال قطعی می‌شود تا تغییرِ بعدیِ پلن، سابقه‌ی مالی را جابه‌جا نکند.
        var isOverage = !request.PlatformOriginated && context.UsedUnits >= context.IncludedUnits;
        var unitPrice = isOverage ? context.OverageUnitPriceRials : 0;

        var record = SmsUsageRecord.Queue(request.TenantId, context.SubscriptionId, template?.Id,
            request.PlatformOriginated ? $"platform:{request.TemplateCode}" : request.TemplateCode,
            request.Recipient, 1, unitPrice);
        _db.SmsUsageRecords.Add(record);

        var blocker = await ValidateAsync(request, settings, template, context, isOverage, ct);
        if (blocker is not null)
        {
            record.MarkFailed(blocker);
            await _db.SaveChangesAsync(ct);
            return SmsSendOutcome.Failure(record.Id, blocker,
                quotaExceeded: isOverage && context.OverageUnitPriceRials <= 0);
        }

        var credentials = new SmsCredentials(settings!.ApiKey!, settings.LineNumber, settings.BaseUrl);
        var result = template is not null && template.ProviderTemplateId > 0
            ? await _sender.TrySendVerifyAsync(request.Recipient, template.ProviderTemplateId, request.Parameters, credentials, ct)
            : await _sender.TrySendTextAsync(request.Recipient, request.FallbackBody, credentials, ct);

        if (result.Succeeded) record.MarkSent(result.ProviderMessageId);
        else record.MarkFailed(result.Error ?? "ارسال پیامک ناموفق بود.");

        await _db.SaveChangesAsync(ct);

        if (!result.Succeeded)
        {
            _log.LogWarning("SMS dispatch failed for tenant {TenantId} template {Code}: {Error}",
                request.TenantId, request.TemplateCode, result.Error);
            return SmsSendOutcome.Failure(record.Id, result.Error ?? "ارسال پیامک ناموفق بود.");
        }

        return new SmsSendOutcome(true, record.Id, record.Units, record.BillableAmountRials, false, null);
    }

    public async Task<SmsDeliveryResult> SendPlatformAsync(string recipient, string? templateCode,
        IReadOnlyDictionary<string, string> parameters, string fallbackBody, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(recipient)) return SmsDeliveryResult.Fail("شماره گیرنده خالی است.");

        var settings = await _db.PlatformSmsSettings.FirstOrDefaultAsync(ct);
        if (settings is null || !settings.IsUsable)
            return SmsDeliveryResult.Fail("سرویس پیامک پلتفرم فعال نیست یا کلید API تنظیم نشده است.");

        var credentials = new SmsCredentials(settings.ApiKey!, settings.LineNumber, settings.BaseUrl);
        var template = string.IsNullOrWhiteSpace(templateCode)
            ? null
            : await _db.PlatformSmsTemplates.FirstOrDefaultAsync(t => t.Code == templateCode && t.IsActive, ct);

        return template is not null && template.ProviderTemplateId > 0
            ? await _sender.TrySendVerifyAsync(recipient, template.ProviderTemplateId, parameters, credentials, ct)
            : await _sender.TrySendTextAsync(recipient, fallbackBody, credentials, ct);
    }

    /// <summary>دلیلِ ردِ ارسال، یا null اگر همه‌ی شرط‌ها برقرار باشد.</summary>
    private async Task<string?> ValidateAsync(SmsSendRequest request, PlatformSmsSettings? settings,
        PlatformSmsTemplate? template, BillingContext context, bool isOverage, CancellationToken ct)
    {
        if (settings is null || !settings.IsUsable)
            return "سرویس پیامک پلتفرم فعال نیست یا کلید API تنظیم نشده است.";

        if (!request.PlatformOriginated)
        {
            if (template is null)
                return $"قالب پیامک «{request.TemplateCode}» یافت نشد یا غیرفعال است.";
            if (!template.IsTenantAvailable)
                return "این قالب در اختیار مستاجران قرار نگرفته است.";

            var enabled = await _db.TenantSmsTemplates
                .IgnoreQueryFilters()
                .AnyAsync(x => x.TenantId == request.TenantId && x.TemplateId == template.Id, ct);
            if (!enabled)
                return "این قالب برای کارواش شما فعال نشده است.";

            if (context.SubscriptionId is null)
                return "اشتراک فعالی برای ارسال پیامک یافت نشد.";

            // فراتر از سهمیه تنها زمانی مجاز است که پلن نرخ مازاد داشته باشد.
            if (isOverage && context.OverageUnitPriceRials <= 0)
                return $"سهمیه پیامک این دوره ({context.IncludedUnits}) به پایان رسیده و پلن شما نرخ مازاد ندارد.";
        }

        return null;
    }

    public async Task<SmsQuotaSnapshot> GetQuotaAsync(Guid tenantId, CancellationToken ct = default)
    {
        var context = await LoadBillingContextAsync(tenantId, ct);
        var activeTemplates = await _db.TenantSmsTemplates
            .IgnoreQueryFilters()
            .CountAsync(x => x.TenantId == tenantId, ct);

        var overageUnits = Math.Max(0, context.UsedUnits - context.IncludedUnits);
        var settings = await _db.PlatformSmsSettings.FirstOrDefaultAsync(ct);

        var blockReason = settings is null || !settings.IsUsable
            ? "سرویس پیامک پلتفرم فعال نیست."
            : context.SubscriptionId is null
                ? "اشتراک فعالی یافت نشد."
                : overageUnits > 0 && context.OverageUnitPriceRials <= 0
                    ? "سهمیه پیامک این دوره به پایان رسیده است."
                    : null;

        return new SmsQuotaSnapshot(
            context.PeriodStartUtc, context.PeriodEndUtc,
            context.IncludedUnits, context.UsedUnits, overageUnits,
            context.OverageUnitPriceRials, overageUnits * context.OverageUnitPriceRials,
            context.TemplateLimit, activeTemplates,
            blockReason is null, blockReason);
    }

    private sealed record BillingContext(
        Guid? SubscriptionId, DateTime PeriodStartUtc, DateTime PeriodEndUtc,
        int IncludedUnits, int TemplateLimit, long OverageUnitPriceRials, int UsedUnits);

    /// <summary>
    /// سهمیه و نرخِ مازاد از پلنِ اشتراکِ جاری خوانده می‌شود و مصرف، تنها ارسال‌های
    /// موفقِ همان دوره (Sent یا Invoiced) است.
    /// </summary>
    private async Task<BillingContext> LoadBillingContextAsync(Guid tenantId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var sub = await _db.Subscriptions
            .IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId
                        && (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.PastDue))
            .OrderByDescending(s => s.CurrentPeriodEndUtc)
            .FirstOrDefaultAsync(ct);

        var periodStart = sub?.CurrentPeriodStartUtc ?? new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var periodEnd = sub?.CurrentPeriodEndUtc ?? periodStart.AddMonths(1);

        var plan = sub is null
            ? null
            : await _db.Plans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == sub.PlanId, ct);

        var used = await _db.SmsUsageRecords
            .IgnoreQueryFilters()
            .CountAsync(r => r.TenantId == tenantId
                             && r.OccurredAtUtc >= periodStart && r.OccurredAtUtc < periodEnd
                             && (r.Status == SmsUsageStatus.Sent || r.Status == SmsUsageStatus.Invoiced), ct);

        return new BillingContext(sub?.Id, periodStart, periodEnd,
            plan?.IncludedSmsPerMonth ?? 0,
            plan?.IncludedSmsTemplateCount ?? 0,
            plan?.SmsOverageUnitPriceRials ?? 0,
            used);
    }
}
