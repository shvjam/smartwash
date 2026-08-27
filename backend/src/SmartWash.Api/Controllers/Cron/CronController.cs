using SmartWash.Api.Authorization;
using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Modules.Billing;
using SmartWash.Domain.Audit;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Operations;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Api.Controllers.Cron;

[ApiController]
[CronEndpoint]
[Route("api/cron")]
public sealed class CronController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ILogger<CronController> _logger;

    public CronController(IAppDbContext db, ILogger<CronController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet("expire-trials")]
    public async Task<IActionResult> ExpireTrials(CancellationToken ct)
    {
        var run = new CronJobRun("expire-trials", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        try
        {
            var now = DateTime.UtcNow;
            var expired = await _db.Tenants
                .IgnoreQueryFilters()
                .Where(t => t.Status == TenantStatus.Trial && t.TrialEndsAtUtc != null && t.TrialEndsAtUtc < now)
                .ToListAsync(ct);

            foreach (var t in expired) t.EnterGracePeriod();
            run.Complete(expired.Count);
            await _db.SaveChangesAsync(ct);
            return Ok(new { processed = expired.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cron expire-trials failed");
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("expire-grace")]
    public async Task<IActionResult> ExpireGrace(CancellationToken ct)
    {
        var run = new CronJobRun("expire-grace", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        try
        {
            var cutoff = DateTime.UtcNow.AddDays(-AppConstants.GracePeriodDays);
            // تنها مسیرِ ورود مستاجر به وضعیت Grace، اتمام دوره آزمایشی است؛ پس مبنای اتمام مهلت،
            // TrialEndsAtUtc (لنگرِ پایدار و بدونِ ری‌ست) است، نه UpdatedAtUtc که با هر آپدیت تغییر می‌کند.
            var expired = await _db.Tenants
                .IgnoreQueryFilters()
                .Where(t => t.Status == TenantStatus.Grace && t.TrialEndsAtUtc != null && t.TrialEndsAtUtc < cutoff)
                .ToListAsync(ct);

            foreach (var t in expired) t.Suspend("اتمام دوره مهلت پس از پایان اشتراک");
            run.Complete(expired.Count);
            await _db.SaveChangesAsync(ct);
            return Ok(new { processed = expired.Count });
        }
        catch (Exception ex)
        {
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { ok = true, at = DateTime.UtcNow });

    [HttpGet("daily-billing")]
    public async Task<IActionResult> DailyBilling(CancellationToken ct)
    {
        var run = new CronJobRun("daily-billing", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var dueSubs = await _db.Subscriptions
                .IgnoreQueryFilters()
                .Where(s => s.Status == SubscriptionStatus.Active && s.AutoRenew && s.CurrentPeriodEndUtc <= now)
                .ToListAsync(ct);
            var processed = 0;
            foreach (var sub in dueSubs)
            {
                var built = await SubscriptionInvoiceBuilder.BuildRenewalAsync(
                    _db, sub, now, AppConstants.GracePeriodDays, ct);
                if (built.Invoice is null)
                {
                    sub.Renew();
                    continue;
                }
                sub.EnterGrace(AppConstants.GracePeriodDays);
                processed++;
            }
            run.Complete(processed);
            await _db.SaveChangesAsync(ct);
            return Ok(new { processed });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "daily-billing failed");
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("expire-overdue-subscriptions")]
    public async Task<IActionResult> ExpireOverdueSubscriptions(
        [FromServices] ISmsDispatcher sms,
        [FromServices] IEmailSender email,
        CancellationToken ct)
    {
        var run = new CronJobRun("expire-overdue-subscriptions", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var overdue = await _db.Subscriptions
                .IgnoreQueryFilters()
                .Where(s => s.Status == SubscriptionStatus.PastDue && s.GraceEndsAtUtc != null && s.GraceEndsAtUtc < now)
                .ToListAsync(ct);
            var notified = 0;
            foreach (var s in overdue)
            {
                s.Expire();
                var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == s.TenantId, ct);
                if (tenant is null) continue;
                tenant.Suspend("اشتراک منقضی شد و در دوره مهلت پرداخت انجام نشد.");

                if (!string.IsNullOrWhiteSpace(tenant.OwnerPhone))
                {
                    var body = $"SmartWash: اشتراک «{tenant.DisplayName}» به دلیل عدم پرداخت تعلیق شد. برای فعال‌سازی به پنل مراجعه کنید.";
                    try
                    {
                        await sms.SendAsync(new SmsSendRequest(tenant.Id, SmsPurpose.BillingSuspended,
                            tenant.OwnerPhone,
                            new Dictionary<string, string> { ["Tenant"] = tenant.DisplayName },
                            body, PlatformOriginated: true), ct);
                        _db.SmsMessages.Add(new SmsMessage(tenant.Id, tenant.OwnerPhone, body, SmsMessageKind.Transactional, s.Id));
                        notified++;
                    }
                    catch (Exception sx) { _logger.LogWarning(sx, "SMS suspend notice failed for {Tenant}", tenant.Slug); }
                }

                if (!string.IsNullOrWhiteSpace(tenant.OwnerEmail))
                {
                    try
                    {
                        var subject = "تعلیق اشتراک SmartWash";
                        var html = $"<p>مالک گرامی،</p><p>اشتراک کارواش <b>{tenant.DisplayName}</b> به دلیل عدم پرداخت تا پایان دوره مهلت، تعلیق شد.</p><p>برای فعال‌سازی، به بخش «اشتراک و صورتحساب» در پنل مراجعه و فاکتور باز را پرداخت کنید.</p>";
                        await email.SendAsync(tenant.OwnerEmail, subject, html, ct);
                    }
                    catch (Exception ex) { _logger.LogWarning(ex, "Email suspend notice failed for {Tenant}", tenant.Slug); }
                }
            }
            run.Complete(overdue.Count);
            await _db.SaveChangesAsync(ct);
            return Ok(new { processed = overdue.Count, notified });
        }
        catch (Exception ex)
        {
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("billing-reminders")]
    public async Task<IActionResult> BillingReminders(
        [FromServices] ISmsDispatcher sms,
        [FromServices] IEmailSender email,
        CancellationToken ct)
    {
        var run = new CronJobRun("billing-reminders", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var soonCutoff = now.AddDays(3);

            // Pre-due reminders: active subs with period ending within 3 days
            var upcoming = await _db.Subscriptions.IgnoreQueryFilters()
                .Where(s => s.Status == SubscriptionStatus.Active
                            && s.CurrentPeriodEndUtc > now
                            && s.CurrentPeriodEndUtc <= soonCutoff)
                .ToListAsync(ct);

            // Past-due reminders: PastDue subs still within grace window
            var pastDue = await _db.Subscriptions.IgnoreQueryFilters()
                .Where(s => s.Status == SubscriptionStatus.PastDue
                            && s.GraceEndsAtUtc != null
                            && s.GraceEndsAtUtc > now)
                .ToListAsync(ct);

            var sent = 0;
            foreach (var s in upcoming)
            {
                var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == s.TenantId, ct);
                if (tenant is null) continue;
                var days = Math.Max(0, (int)Math.Ceiling((s.CurrentPeriodEndUtc - now).TotalDays));
                var body = $"SmartWash: سررسید اشتراک «{tenant.DisplayName}» تا {days} روز دیگر. برای جلوگیری از تعلیق، پرداخت را انجام دهید.";
                if (await NotifyOwner(tenant, sms, email, SmsPurpose.BillingReminder,
                        new Dictionary<string, string> { ["Tenant"] = tenant.DisplayName, ["Days"] = days.ToString() },
                        body, "یادآور پرداخت اشتراک", $"<p>سررسید اشتراک <b>{tenant.DisplayName}</b> تا {days} روز دیگر است.</p>", s.Id, ct)) sent++;
            }

            foreach (var s in pastDue)
            {
                var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == s.TenantId, ct);
                if (tenant is null) continue;
                var remaining = Math.Max(0, (int)Math.Ceiling((s.GraceEndsAtUtc!.Value - now).TotalDays));
                var body = $"SmartWash: اشتراک «{tenant.DisplayName}» سررسید گذشته است. {remaining} روز تا تعلیق باقی مانده.";
                if (await NotifyOwner(tenant, sms, email, SmsPurpose.BillingPastDue,
                        new Dictionary<string, string> { ["Tenant"] = tenant.DisplayName, ["Days"] = remaining.ToString() },
                        body, "اخطار سررسید گذشته", $"<p>اشتراک <b>{tenant.DisplayName}</b> سررسید گذشته است؛ تنها {remaining} روز تا تعلیق باقی مانده.</p>", s.Id, ct)) sent++;
            }

            run.Complete(sent);
            await _db.SaveChangesAsync(ct);
            return Ok(new { upcoming = upcoming.Count, pastDue = pastDue.Count, sent });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "billing-reminders failed");
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private async Task<bool> NotifyOwner(
        SmartWash.Domain.Tenancy.Tenant tenant, ISmsDispatcher sms, IEmailSender email,
        string smsPurpose, Dictionary<string, string> smsParams, string smsFallback,
        string emailSubject, string emailHtml, Guid relatedId, CancellationToken ct)
    {
        var any = false;
        if (!string.IsNullOrWhiteSpace(tenant.OwnerPhone))
        {
            try
            {
                // اطلاع‌رسانی صورتحساب از سمت پلتفرم است؛ ثبت می‌شود ولی به مستاجر هزینه نمی‌خورد.
                await sms.SendAsync(new SmsSendRequest(tenant.Id, smsPurpose, tenant.OwnerPhone, smsParams,
                    smsFallback, PlatformOriginated: true), ct);
                _db.SmsMessages.Add(new SmsMessage(tenant.Id, tenant.OwnerPhone, smsFallback, SmsMessageKind.Transactional, relatedId));
                any = true;
            }
            catch (Exception sx) { _logger.LogWarning(sx, "SMS billing notice failed for {Tenant}", tenant.Slug); }
        }
        if (!string.IsNullOrWhiteSpace(tenant.OwnerEmail))
        {
            try { await email.SendAsync(tenant.OwnerEmail, emailSubject, emailHtml, ct); any = true; }
            catch (Exception ex) { _logger.LogWarning(ex, "Email billing notice failed for {Tenant}", tenant.Slug); }
        }
        return any;
    }

    [HttpGet("generate-service-reminders")]
    public async Task<IActionResult> GenerateServiceReminders([FromQuery] int sinceDays = 60, CancellationToken ct = default)
    {
        var run = new CronJobRun("generate-service-reminders", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var cutoff = now.AddDays(-Math.Max(1, sinceDays));

            var candidates = await _db.Customers.IgnoreQueryFilters()
                .Where(c => c.IsActive
                    && c.LastVisitAtUtc != null
                    && c.LastVisitAtUtc < cutoff
                    && !_db.ServiceReminders.IgnoreQueryFilters().Any(r =>
                        r.CustomerId == c.Id
                        && r.Status == ReminderStatus.Pending
                        && r.Type == ReminderType.NextWash))
                .Take(1000)
                .Select(c => new { c.Id, c.TenantId, c.FullName, c.LastVisitAtUtc })
                .ToListAsync(ct);

            var created = 0;
            foreach (var c in candidates)
            {
                var title = $"یادآور شستشوی بعدی برای {c.FullName}";
                var dueAt = now.AddDays(1);
                _db.ServiceReminders.Add(new ServiceReminder(c.TenantId, c.Id, null, title, dueAt, ReminderType.NextWash));
                created++;
            }
            run.Complete(created);
            await _db.SaveChangesAsync(ct);
            return Ok(new { created, candidates = candidates.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "generate-service-reminders failed");
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("send-reminders")]
    public async Task<IActionResult> SendReminders([FromServices] ISmsDispatcher sms, CancellationToken ct)
    {
        var run = new CronJobRun("send-reminders", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var due = await _db.ServiceReminders.IgnoreQueryFilters()
                .Where(r => r.Status == ReminderStatus.Pending && r.DueAtUtc <= now)
                .Take(500).ToListAsync(ct);

            var processed = 0;
            foreach (var r in due)
            {
                var customer = await _db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == r.CustomerId, ct);
                if (customer is null) { r.Cancel(); continue; }
                var body = $"یادآوری: {r.Title}";
                var message = new SmsMessage(r.TenantId, customer.Phone, body, SmsMessageKind.Reminder, r.Id);
                _db.SmsMessages.Add(message);

                // ارسال فقط از مسیر دروازه‌ی مرکزی: سهمیه‌ی پلن کنترل و رخداد ثبت می‌شود.
                var outcome = await sms.SendAsync(new SmsSendRequest(r.TenantId, SmsPurpose.ReservationReminder,
                    customer.Phone,
                    new Dictionary<string, string> { ["Name"] = customer.FullName, ["Title"] = r.Title },
                    body), ct);

                if (outcome.Sent) { message.MarkSent(null, 0); r.MarkSent(); }
                else
                {
                    message.MarkFailed(outcome.Error ?? "ارسال ناموفق");
                    _logger.LogWarning("send-reminders SMS failed for {ReminderId}: {Error}", r.Id, outcome.Error);
                }
                processed++;
            }
            run.Complete(processed);
            await _db.SaveChangesAsync(ct);
            return Ok(new { processed });
        }
        catch (Exception ex)
        {
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("campaign-dispatcher")]
    public async Task<IActionResult> CampaignDispatcher([FromServices] ISmsDispatcher sms, CancellationToken ct)
    {
        var run = new CronJobRun("campaign-dispatcher", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var due = await _db.Campaigns.IgnoreQueryFilters()
                .Where(c => c.Status == CampaignStatus.Scheduled && c.ScheduledAtUtc != null && c.ScheduledAtUtc <= now)
                .ToListAsync(ct);

            var totalRecipients = 0;
            foreach (var camp in due)
            {
                camp.Start();
                var customers = _db.Customers.IgnoreQueryFilters().Where(c => c.TenantId == camp.TenantId && c.IsActive);
                if (camp.TargetMinVisits.HasValue) customers = customers.Where(c => c.TotalVisits >= camp.TargetMinVisits.Value);
                if (camp.TargetMinTier.HasValue) customers = customers.Where(c => c.Tier >= camp.TargetMinTier.Value);
                if (camp.TargetDaysSinceLastVisit.HasValue)
                {
                    var cutoff = now.AddDays(-camp.TargetDaysSinceLastVisit.Value);
                    customers = customers.Where(c => c.LastVisitAtUtc == null || c.LastVisitAtUtc < cutoff);
                }

                var recipients = await customers.ToListAsync(ct);
                int success = 0, failed = 0;
                foreach (var cu in recipients)
                {
                    var msg = camp.MessageTemplate.Replace("{name}", cu.FullName);
                    var sm = new SmsMessage(camp.TenantId, cu.Phone, msg, SmsMessageKind.Campaign, camp.Id);
                    _db.SmsMessages.Add(sm);
                    var outcome = await sms.SendAsync(new SmsSendRequest(camp.TenantId, SmsPurpose.Campaign,
                        cu.Phone, new Dictionary<string, string> { ["Name"] = cu.FullName, ["Message"] = msg }, msg), ct);
                    if (outcome.Sent) { sm.MarkSent(null, 0); success++; }
                    else
                    {
                        sm.MarkFailed(outcome.Error ?? "ارسال ناموفق");
                        failed++;
                        // پایانِ سهمیه یعنی ادامه‌ی کمپین بی‌فایده است؛ بقیه‌ی گیرندگان رد می‌شوند.
                        if (outcome.QuotaExceeded) break;
                    }
                }
                camp.SetRecipientCount(recipients.Count, 0);
                camp.Complete(success, failed, 0);
                totalRecipients += recipients.Count;
            }
            run.Complete(totalRecipients);
            await _db.SaveChangesAsync(ct);
            return Ok(new { campaigns = due.Count, recipients = totalRecipients });
        }
        catch (Exception ex)
        {
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("generate-notifications")]
    public async Task<IActionResult> GenerateNotifications(CancellationToken ct)
    {
        var run = new CronJobRun("generate-notifications", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var created = 0;

            // ---- ۱) سفارش‌های معوق: در حال انجام که از زمانِ برآوردیِ اتمام گذشته‌اند ----
            var inProgress = await _db.Orders.IgnoreQueryFilters()
                .Where(o => o.Status == OrderStatus.InProgress)
                .Select(o => new { o.Id, o.TenantId, o.Number, o.StartedAtUtc, o.ExpectedDurationMinutes })
                .ToListAsync(ct);
            var overdue = inProgress
                .Where(o => o.StartedAtUtc.AddMinutes(o.ExpectedDurationMinutes) < now)
                .ToList();
            if (overdue.Count > 0)
            {
                var overdueIds = overdue.Select(o => o.Id).ToList();
                var already = await _db.AppNotifications.IgnoreQueryFilters()
                    .Where(n => n.Type == NotificationType.OrderOverdue && n.EntityId != null && overdueIds.Contains(n.EntityId.Value))
                    .Select(n => n.EntityId!.Value)
                    .ToListAsync(ct);
                var existing = already.ToHashSet();
                foreach (var o in overdue)
                {
                    if (existing.Contains(o.Id)) continue;
                    var mins = (int)Math.Round((now - o.StartedAtUtc.AddMinutes(o.ExpectedDurationMinutes)).TotalMinutes);
                    _db.AppNotifications.Add(new AppNotification(o.TenantId, NotificationType.OrderOverdue,
                        $"سفارش #{o.Number} معوق شده است",
                        $"این سفارش {mins} دقیقه از زمانِ برآوردیِ تحویل گذشته و هنوز تکمیل نشده است.",
                        "Order", o.Id));
                    created++;
                }
            }

            // ---- ۲) یادآور رزرو: رزروهای تأییدشده/در انتظار طیِ ۲ ساعتِ آینده ----
            var soon = now.AddHours(2);
            var upcoming = await _db.Reservations.IgnoreQueryFilters()
                .Where(r => (r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed)
                            && r.ScheduledAtUtc > now && r.ScheduledAtUtc <= soon)
                .Select(r => new { r.Id, r.TenantId, r.CustomerName, r.ScheduledAtUtc })
                .ToListAsync(ct);
            if (upcoming.Count > 0)
            {
                var upIds = upcoming.Select(r => r.Id).ToList();
                var already = await _db.AppNotifications.IgnoreQueryFilters()
                    .Where(n => n.Type == NotificationType.ReservationReminder && n.EntityId != null && upIds.Contains(n.EntityId.Value))
                    .Select(n => n.EntityId!.Value)
                    .ToListAsync(ct);
                var existing = already.ToHashSet();
                foreach (var r in upcoming)
                {
                    if (existing.Contains(r.Id)) continue;
                    _db.AppNotifications.Add(new AppNotification(r.TenantId, NotificationType.ReservationReminder,
                        $"رزرو نزدیک: {r.CustomerName}",
                        $"رزرو در ساعت {r.ScheduledAtUtc.AddHours(3.5):HH:mm} امروز موعد دارد؛ برای پذیرش آماده شوید.",
                        "Reservation", r.Id));
                    created++;
                }
            }

            // ---- ۳) سررسید صورتحساب: اشتراک فعال با پایانِ دوره طیِ ۳ روزِ آینده ----
            var billingSoon = now.AddDays(3);
            var dueSubs = await _db.Subscriptions.IgnoreQueryFilters()
                .Where(s => s.Status == SubscriptionStatus.Active && s.CurrentPeriodEndUtc > now && s.CurrentPeriodEndUtc <= billingSoon)
                .Select(s => new { s.Id, s.TenantId, s.CurrentPeriodEndUtc, s.PriceRials })
                .ToListAsync(ct);
            if (dueSubs.Count > 0)
            {
                var subIds = dueSubs.Select(s => s.Id).ToList();
                var recentCutoff = now.AddDays(-3);
                var already = await _db.AppNotifications.IgnoreQueryFilters()
                    .Where(n => n.Type == NotificationType.BillingDue && n.EntityId != null
                                && subIds.Contains(n.EntityId.Value) && n.CreatedAtUtc >= recentCutoff)
                    .Select(n => n.EntityId!.Value)
                    .ToListAsync(ct);
                var existing = already.ToHashSet();
                foreach (var s in dueSubs)
                {
                    if (existing.Contains(s.Id)) continue;
                    var days = Math.Max(0, (int)Math.Ceiling((s.CurrentPeriodEndUtc - now).TotalDays));
                    _db.AppNotifications.Add(new AppNotification(s.TenantId, NotificationType.BillingDue,
                        "سررسید اشتراک نزدیک است",
                        $"اشتراک شما تا {days} روز دیگر سررسید می‌شود. برای جلوگیری از تعلیق سرویس، پرداخت را انجام دهید.",
                        "Subscription", s.Id));
                    created++;
                }
            }

            // ---- ۴) تولد مشتری: مشتریانِ فعال با تاریخِ تولدِ امروز (یک‌بار در سال) ----
            var today = DateOnly.FromDateTime(now);
            var birthdayCustomers = await _db.Customers.IgnoreQueryFilters()
                .Where(c => c.IsActive && c.BirthDate != null
                            && c.BirthDate.Value.Month == today.Month && c.BirthDate.Value.Day == today.Day)
                .Select(c => new { c.Id, c.TenantId, c.FullName })
                .ToListAsync(ct);
            if (birthdayCustomers.Count > 0)
            {
                var custIds = birthdayCustomers.Select(c => c.Id).ToList();
                var yearStart = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                var already = await _db.AppNotifications.IgnoreQueryFilters()
                    .Where(n => n.Type == NotificationType.Birthday && n.EntityId != null
                                && custIds.Contains(n.EntityId.Value) && n.CreatedAtUtc >= yearStart)
                    .Select(n => n.EntityId!.Value)
                    .ToListAsync(ct);
                var existing = already.ToHashSet();
                foreach (var c in birthdayCustomers)
                {
                    if (existing.Contains(c.Id)) continue;
                    _db.AppNotifications.Add(new AppNotification(c.TenantId, NotificationType.Birthday,
                        $"تولد {c.FullName} است 🎉",
                        "امروز تولدِ این مشتری است؛ می‌توانید با یک پیام یا تخفیفِ ویژه، تجربه‌ای به‌یادماندنی بسازید.",
                        "Customer", c.Id));
                    created++;
                }
            }

            run.Complete(created);
            await _db.SaveChangesAsync(ct);
            return Ok(new { created });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "generate-notifications failed");
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("cleanup-tokens")]
    public async Task<IActionResult> CleanupTokens(CancellationToken ct)
    {
        var run = new CronJobRun("cleanup-tokens", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var cutoff = DateTime.UtcNow.AddDays(-7);
            var stale = await _db.RefreshTokens
                .Where(t => t.RevokedAtUtc != null && t.RevokedAtUtc < cutoff || t.ExpiresAtUtc < cutoff)
                .Take(2000).ToListAsync(ct);
            _db.RefreshTokens.RemoveRange(stale);
            run.Complete(stale.Count);
            await _db.SaveChangesAsync(ct);
            return Ok(new { removed = stale.Count });
        }
        catch (Exception ex)
        {
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("usage-rollup")]
    public async Task<IActionResult> UsageRollup(CancellationToken ct)
    {
        var run = new CronJobRun("usage-rollup", HttpContext.TraceIdentifier);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        try
        {
            var since = DateTime.UtcNow.AddDays(-1);
            var orders = await _db.Orders.IgnoreQueryFilters()
                .Where(o => o.Status == OrderStatus.Completed && o.CompletedAtUtc != null && o.CompletedAtUtc >= since)
                .ToListAsync(ct);

            var added = 0;
            foreach (var o in orders)
            {
                var exists = await _db.UsageEvents.IgnoreQueryFilters().AnyAsync(u => u.OrderId == o.Id, ct);
                if (exists) continue;
                _db.UsageEvents.Add(new UsageEvent(o.TenantId, o.Id, DateOnly.FromDateTime(o.CompletedAtUtc!.Value), o.TotalRials));
                added++;
            }
            run.Complete(added);
            await _db.SaveChangesAsync(ct);
            return Ok(new { added });
        }
        catch (Exception ex)
        {
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(ct);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
