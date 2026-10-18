using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Modules.Billing;
using SmartWash.Domain.Audit;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Operations;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Api.BackgroundServices;

/// <summary>When a job should run, if nothing outside calls it first.</summary>
/// <param name="EveryMinutes">Run this often. Set for jobs that react to things as they happen.</param>
/// <param name="DailyAtUtc">Run once a day, at or after this time. Set for jobs that settle a day.</param>
public sealed record CronJobDefinition(string Name, int? EveryMinutes = null, TimeOnly? DailyAtUtc = null);

/// <summary>What a run did, for the endpoint to report and the scheduler to log.</summary>
public sealed record CronJobOutcome(bool Succeeded, int Processed, object Details, string? Error);

/// <summary>
/// Every scheduled job, in one place, run the same way whoever triggers it.
///
/// There used to be two copies of this work. The /api/cron endpoints had one, written for an
/// external scheduler on the hosting panel; the in-process scheduler had another, written
/// separately and kept in step by hand. They were not in step. The in-process copy ran four of
/// the eleven jobs — no campaign was ever dispatched, no trial ever expired, no grace period
/// ever ended — and it recorded none of its runs, so the platform's job-health screen showed
/// nothing at all for a host that relied on it. Production relied on it.
///
/// Now both callers come through RunAsync: the endpoint for whatever the hosting panel fires,
/// the background service for whatever is due. Every run is recorded the same way, which is
/// also what lets the two coexist — a job that the panel has just run is not due again, so the
/// background service leaves it alone.
/// </summary>
public sealed class CronJobs
{
    /*
      The schedule, in UTC. Iran is UTC+03:30, so 05:00 here is 08:30 on the floor.

      The order of the daily jobs matters: usage is rolled up before billing reads the day,
      reminders are generated before they are sent, and trials and grace periods are settled
      before the morning's reminders go out about them.
    */
    public static readonly IReadOnlyList<CronJobDefinition> All =
    [
        new("campaign-dispatcher", EveryMinutes: 5),
        new("generate-notifications", EveryMinutes: 10),
        new("cleanup-tokens", DailyAtUtc: new TimeOnly(0, 30)),
        new("usage-rollup", DailyAtUtc: new TimeOnly(1, 30)),
        new("daily-billing", DailyAtUtc: new TimeOnly(2, 0)),
        new("expire-trials", DailyAtUtc: new TimeOnly(3, 0)),
        new("expire-grace", DailyAtUtc: new TimeOnly(3, 0)),
        new("expire-overdue-subscriptions", DailyAtUtc: new TimeOnly(3, 0)),
        new("generate-service-reminders", DailyAtUtc: new TimeOnly(4, 30)),
        new("send-reminders", DailyAtUtc: new TimeOnly(5, 0)),
        new("billing-reminders", DailyAtUtc: new TimeOnly(5, 30)),
    ];

    public static bool IsKnown(string name) => All.Any(j => j.Name == name);

    private readonly IAppDbContext _db;
    private readonly ISmsDispatcher _sms;
    private readonly IEmailSender _email;
    private readonly ILogger<CronJobs> _logger;

    public CronJobs(IAppDbContext db, ISmsDispatcher sms, IEmailSender email, ILogger<CronJobs> logger)
    {
        _db = db; _sms = sms; _email = email; _logger = logger;
    }

    /// <summary>Runs one job and records the run, whatever the outcome.</summary>
    public async Task<CronJobOutcome> RunAsync(string name, string? correlationId, CancellationToken ct,
        int? serviceReminderSinceDays = null)
    {
        // Two copies of daily-billing running at once would each load the same due
        // subscriptions and each raise an invoice. Whoever asks second — the hosting panel or
        // the in-process scheduler — is told the job is already under way and does nothing.
        var busySince = DateTime.UtcNow.AddMinutes(-30);
        if (await _db.CronJobRuns.AnyAsync(r => r.JobName == name && r.Status == CronJobStatus.Running && r.StartedAtUtc >= busySince, ct))
            return new CronJobOutcome(true, 0, new { skipped = true, reason = "already running" }, null);

        var run = new CronJobRun(name, correlationId);
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        try
        {
            var (processed, details) = name switch
            {
                "expire-trials" => await ExpireTrials(ct),
                "expire-grace" => await ExpireGrace(ct),
                "daily-billing" => await DailyBilling(ct),
                "expire-overdue-subscriptions" => await ExpireOverdueSubscriptions(ct),
                "billing-reminders" => await BillingReminders(ct),
                "generate-service-reminders" => await GenerateServiceReminders(serviceReminderSinceDays ?? 60, ct),
                "send-reminders" => await SendReminders(ct),
                "campaign-dispatcher" => await CampaignDispatcher(ct),
                "generate-notifications" => await GenerateNotifications(ct),
                "cleanup-tokens" => await CleanupTokens(ct),
                "usage-rollup" => await UsageRollup(ct),
                _ => throw new InvalidOperationException($"Unknown cron job '{name}'."),
            };
            run.Complete(processed);
            await _db.SaveChangesAsync(ct);
            return new CronJobOutcome(true, processed, details, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cron job {Job} failed", name);
            // The work may have left tracked changes half-made; drop them so the failure itself
            // can still be written down.
            foreach (var entry in ((DbContext)_db).ChangeTracker.Entries().Where(e => e.Entity != run).ToList())
                entry.State = EntityState.Detached;
            run.Fail(ex.Message);
            await _db.SaveChangesAsync(CancellationToken.None);
            return new CronJobOutcome(false, 0, new { error = ex.Message }, ex.Message);
        }
    }

    /* ── subscriptions and tenants ──────────────────────────────────────── */

    private async Task<(int, object)> ExpireTrials(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var expired = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Status == TenantStatus.Trial && t.TrialEndsAtUtc != null && t.TrialEndsAtUtc < now)
            .ToListAsync(ct);
        foreach (var t in expired) t.EnterGracePeriod();
        return (expired.Count, new { processed = expired.Count });
    }

    private async Task<(int, object)> ExpireGrace(CancellationToken ct)
    {
        // The only way into Grace is a trial running out, so the trial's end is the anchor —
        // not UpdatedAtUtc, which moves every time anything about the tenant changes.
        var cutoff = DateTime.UtcNow.AddDays(-AppConstants.GracePeriodDays);
        var expired = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Status == TenantStatus.Grace && t.TrialEndsAtUtc != null && t.TrialEndsAtUtc < cutoff)
            .ToListAsync(ct);
        foreach (var t in expired) t.Suspend("اتمام دوره مهلت پس از پایان اشتراک");
        return (expired.Count, new { processed = expired.Count });
    }

    private async Task<(int, object)> DailyBilling(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var dueSubs = await _db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.Status == SubscriptionStatus.Active && s.AutoRenew && s.CurrentPeriodEndUtc <= now)
            .ToListAsync(ct);
        var invoiced = 0;
        foreach (var sub in dueSubs)
        {
            // The invoice is built entirely from data: base rent if any, cars over the
            // allowance, and successful SMS beyond it. A zero invoice is not issued — the
            // period simply rolls on.
            var built = await SubscriptionInvoiceBuilder.BuildRenewalAsync(_db, sub, now, AppConstants.GracePeriodDays, ct);
            if (built.Invoice is null) { sub.Renew(); continue; }
            sub.EnterGrace(AppConstants.GracePeriodDays);
            invoiced++;
        }
        return (invoiced, new { processed = invoiced, renewedWithoutCharge = dueSubs.Count - invoiced });
    }

    private async Task<(int, object)> ExpireOverdueSubscriptions(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var overdue = await _db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.Status == SubscriptionStatus.PastDue && s.GraceEndsAtUtc != null && s.GraceEndsAtUtc < now)
            .ToListAsync(ct);
        var notified = 0;
        foreach (var s in overdue)
        {
            s.Expire();
            var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == s.TenantId, ct);
            if (tenant is null) continue;
            tenant.Suspend("اشتراک منقضی شد و در دوره مهلت پرداخت انجام نشد.");

            var smsBody = $"SmartWash: اشتراک «{tenant.DisplayName}» به دلیل عدم پرداخت تعلیق شد. برای فعال‌سازی به پنل مراجعه کنید.";
            var html = $"<p>مالک گرامی،</p><p>اشتراک کارواش <b>{tenant.DisplayName}</b> به دلیل عدم پرداخت تا پایان دوره مهلت، تعلیق شد.</p><p>برای فعال‌سازی، به بخش «اشتراک و صورتحساب» در پنل مراجعه و فاکتور باز را پرداخت کنید.</p>";
            if (await NotifyOwner(tenant, SmsPurpose.BillingSuspended,
                    new Dictionary<string, string> { ["Tenant"] = tenant.DisplayName },
                    smsBody, "تعلیق اشتراک SmartWash", html, s.Id, ct)) notified++;
        }
        return (overdue.Count, new { processed = overdue.Count, notified });
    }

    private async Task<(int, object)> BillingReminders(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var soonCutoff = now.AddDays(3);

        var upcoming = await _db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.Status == SubscriptionStatus.Active && s.CurrentPeriodEndUtc > now && s.CurrentPeriodEndUtc <= soonCutoff)
            .ToListAsync(ct);
        var pastDue = await _db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.Status == SubscriptionStatus.PastDue && s.GraceEndsAtUtc != null && s.GraceEndsAtUtc > now)
            .ToListAsync(ct);

        var sent = 0;
        foreach (var s in upcoming)
        {
            var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == s.TenantId, ct);
            if (tenant is null) continue;
            var days = Math.Max(0, (int)Math.Ceiling((s.CurrentPeriodEndUtc - now).TotalDays));
            var body = $"SmartWash: سررسید اشتراک «{tenant.DisplayName}» تا {days} روز دیگر. برای جلوگیری از تعلیق، پرداخت را انجام دهید.";
            if (await NotifyOwner(tenant, SmsPurpose.BillingReminder,
                    new Dictionary<string, string> { ["Tenant"] = tenant.DisplayName, ["Days"] = days.ToString() },
                    body, "یادآور پرداخت اشتراک", $"<p>سررسید اشتراک <b>{tenant.DisplayName}</b> تا {days} روز دیگر است.</p>", s.Id, ct)) sent++;
        }
        foreach (var s in pastDue)
        {
            var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == s.TenantId, ct);
            if (tenant is null) continue;
            var remaining = Math.Max(0, (int)Math.Ceiling((s.GraceEndsAtUtc!.Value - now).TotalDays));
            var body = $"SmartWash: اشتراک «{tenant.DisplayName}» سررسید گذشته است. {remaining} روز تا تعلیق باقی مانده.";
            if (await NotifyOwner(tenant, SmsPurpose.BillingPastDue,
                    new Dictionary<string, string> { ["Tenant"] = tenant.DisplayName, ["Days"] = remaining.ToString() },
                    body, "اخطار سررسید گذشته", $"<p>اشتراک <b>{tenant.DisplayName}</b> سررسید گذشته است؛ تنها {remaining} روز تا تعلیق باقی مانده.</p>", s.Id, ct)) sent++;
        }
        return (sent, new { upcoming = upcoming.Count, pastDue = pastDue.Count, sent });
    }

    private async Task<bool> NotifyOwner(Tenant tenant, string smsPurpose, Dictionary<string, string> smsParams,
        string smsFallback, string emailSubject, string emailHtml, Guid relatedId, CancellationToken ct)
    {
        var any = false;
        if (!string.IsNullOrWhiteSpace(tenant.OwnerPhone))
        {
            try
            {
                // A billing notice comes from the platform: it is logged against the tenant but
                // not charged to them.
                await _sms.SendAsync(new SmsSendRequest(tenant.Id, smsPurpose, tenant.OwnerPhone, smsParams,
                    smsFallback, PlatformOriginated: true), ct);
                _db.SmsMessages.Add(new SmsMessage(tenant.Id, tenant.OwnerPhone, smsFallback, SmsMessageKind.Transactional, relatedId));
                any = true;
            }
            catch (Exception ex) { _logger.LogWarning(ex, "SMS billing notice failed for {Tenant}", tenant.Slug); }
        }
        if (!string.IsNullOrWhiteSpace(tenant.OwnerEmail))
        {
            try { await _email.SendAsync(tenant.OwnerEmail, emailSubject, emailHtml, ct); any = true; }
            catch (Exception ex) { _logger.LogWarning(ex, "Email billing notice failed for {Tenant}", tenant.Slug); }
        }
        return any;
    }

    /* ── customers ──────────────────────────────────────────────────────── */

    private async Task<(int, object)> GenerateServiceReminders(int sinceDays, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var cutoff = now.AddDays(-Math.Max(1, sinceDays));

        var candidates = await _db.Customers.IgnoreQueryFilters()
            .Where(c => c.IsActive
                && c.LastVisitAtUtc != null
                && c.LastVisitAtUtc < cutoff
                && !_db.ServiceReminders.IgnoreQueryFilters().Any(r =>
                    r.CustomerId == c.Id && r.Status == ReminderStatus.Pending && r.Type == ReminderType.NextWash))
            .Take(1000)
            .Select(c => new { c.Id, c.TenantId, c.FullName })
            .ToListAsync(ct);

        foreach (var c in candidates)
            _db.ServiceReminders.Add(new ServiceReminder(c.TenantId, c.Id, null,
                $"یادآور شستشوی بعدی برای {c.FullName}", now.AddDays(1), ReminderType.NextWash));

        return (candidates.Count, new { created = candidates.Count });
    }

    private async Task<(int, object)> SendReminders(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var due = await _db.ServiceReminders.IgnoreQueryFilters()
            .Where(r => r.Status == ReminderStatus.Pending && r.DueAtUtc <= now)
            .Take(500).ToListAsync(ct);

        var sent = 0;
        foreach (var r in due)
        {
            var customer = await _db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == r.CustomerId, ct);
            if (customer is null) { r.Cancel(); continue; }
            var body = $"یادآوری: {r.Title}";
            var message = new SmsMessage(r.TenantId, customer.Phone, body, SmsMessageKind.Reminder, r.Id);
            _db.SmsMessages.Add(message);

            // Through the central dispatcher only: that is where the plan's allowance is
            // checked and the send is recorded.
            var outcome = await _sms.SendAsync(new SmsSendRequest(r.TenantId, SmsPurpose.ReservationReminder,
                customer.Phone, new Dictionary<string, string> { ["Name"] = customer.FullName, ["Title"] = r.Title }, body), ct);

            if (outcome.Sent) { message.MarkSent(null, 0); r.MarkSent(); sent++; }
            else
            {
                message.MarkFailed(outcome.Error ?? "ارسال ناموفق");
                // A send that failed because the plan does not carry SMS will fail the same way
                // every morning; retrying it forever only fills the message log. Close it.
                if (outcome.QuotaExceeded) r.Cancel();
                _logger.LogWarning("send-reminders SMS failed for {ReminderId}: {Error}", r.Id, outcome.Error);
            }
        }
        return (sent, new { processed = due.Count, sent });
    }

    private async Task<(int, object)> CampaignDispatcher(CancellationToken ct)
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
                var outcome = await _sms.SendAsync(new SmsSendRequest(camp.TenantId, SmsPurpose.Campaign,
                    cu.Phone, new Dictionary<string, string> { ["Name"] = cu.FullName, ["Message"] = msg }, msg), ct);
                if (outcome.Sent) { sm.MarkSent(null, 0); success++; }
                else
                {
                    sm.MarkFailed(outcome.Error ?? "ارسال ناموفق");
                    failed++;
                    // Out of allowance means the rest would fail the same way; stop here.
                    if (outcome.QuotaExceeded) break;
                }
            }
            camp.SetRecipientCount(recipients.Count, 0);
            camp.Complete(success, failed, 0);
            totalRecipients += recipients.Count;
        }
        return (totalRecipients, new { campaigns = due.Count, recipients = totalRecipients });
    }

    /* ── the panel's own notices ────────────────────────────────────────── */

    private async Task<(int, object)> GenerateNotifications(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var created = 0;

        // 1) Orders running past their expected finish.
        var inProgress = await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Status == OrderStatus.InProgress)
            .Select(o => new { o.Id, o.TenantId, o.Number, o.StartedAtUtc, o.ExpectedDurationMinutes })
            .ToListAsync(ct);
        var overdue = inProgress.Where(o => o.StartedAtUtc.AddMinutes(o.ExpectedDurationMinutes) < now).ToList();
        if (overdue.Count > 0)
        {
            var ids = overdue.Select(o => o.Id).ToList();
            var existing = (await _db.AppNotifications.IgnoreQueryFilters()
                .Where(n => n.Type == NotificationType.OrderOverdue && n.EntityId != null && ids.Contains(n.EntityId.Value))
                .Select(n => n.EntityId!.Value).ToListAsync(ct)).ToHashSet();
            foreach (var o in overdue.Where(o => !existing.Contains(o.Id)))
            {
                var mins = (int)Math.Round((now - o.StartedAtUtc.AddMinutes(o.ExpectedDurationMinutes)).TotalMinutes);
                _db.AppNotifications.Add(new AppNotification(o.TenantId, NotificationType.OrderOverdue,
                    $"سفارش #{o.Number} معوق شده است",
                    $"این سفارش {mins} دقیقه از زمانِ برآوردیِ تحویل گذشته و هنوز تکمیل نشده است.",
                    "Order", o.Id));
                created++;
            }
        }

        // 2) Reservations due within two hours.
        var soon = now.AddHours(2);
        var upcoming = await _db.Reservations.IgnoreQueryFilters()
            .Where(r => (r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed)
                        && r.ScheduledAtUtc > now && r.ScheduledAtUtc <= soon)
            .Select(r => new { r.Id, r.TenantId, r.CustomerName, r.ScheduledAtUtc })
            .ToListAsync(ct);
        if (upcoming.Count > 0)
        {
            var ids = upcoming.Select(r => r.Id).ToList();
            var existing = (await _db.AppNotifications.IgnoreQueryFilters()
                .Where(n => n.Type == NotificationType.ReservationReminder && n.EntityId != null && ids.Contains(n.EntityId.Value))
                .Select(n => n.EntityId!.Value).ToListAsync(ct)).ToHashSet();
            foreach (var r in upcoming.Where(r => !existing.Contains(r.Id)))
            {
                // Iran has kept UTC+03:30 all year since 2022.
                _db.AppNotifications.Add(new AppNotification(r.TenantId, NotificationType.ReservationReminder,
                    $"رزرو نزدیک: {r.CustomerName}",
                    $"رزرو در ساعت {r.ScheduledAtUtc.AddHours(3.5):HH:mm} امروز موعد دارد؛ برای پذیرش آماده شوید.",
                    "Reservation", r.Id));
                created++;
            }
        }

        // 3) Subscriptions coming due within three days, at most once every three days.
        var billingSoon = now.AddDays(3);
        var dueSubs = await _db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.Status == SubscriptionStatus.Active && s.CurrentPeriodEndUtc > now && s.CurrentPeriodEndUtc <= billingSoon)
            .Select(s => new { s.Id, s.TenantId, s.CurrentPeriodEndUtc })
            .ToListAsync(ct);
        if (dueSubs.Count > 0)
        {
            var ids = dueSubs.Select(s => s.Id).ToList();
            var recentCutoff = now.AddDays(-3);
            var existing = (await _db.AppNotifications.IgnoreQueryFilters()
                .Where(n => n.Type == NotificationType.BillingDue && n.EntityId != null
                            && ids.Contains(n.EntityId.Value) && n.CreatedAtUtc >= recentCutoff)
                .Select(n => n.EntityId!.Value).ToListAsync(ct)).ToHashSet();
            foreach (var s in dueSubs.Where(s => !existing.Contains(s.Id)))
            {
                var days = Math.Max(0, (int)Math.Ceiling((s.CurrentPeriodEndUtc - now).TotalDays));
                _db.AppNotifications.Add(new AppNotification(s.TenantId, NotificationType.BillingDue,
                    "سررسید اشتراک نزدیک است",
                    $"اشتراک شما تا {days} روز دیگر سررسید می‌شود. برای جلوگیری از تعلیق سرویس، پرداخت را انجام دهید.",
                    "Subscription", s.Id));
                created++;
            }
        }

        // 4) Customers' birthdays, once a year each.
        var today = DateOnly.FromDateTime(now);
        var birthdays = await _db.Customers.IgnoreQueryFilters()
            .Where(c => c.IsActive && c.BirthDate != null && c.BirthDate.Value.Month == today.Month && c.BirthDate.Value.Day == today.Day)
            .Select(c => new { c.Id, c.TenantId, c.FullName })
            .ToListAsync(ct);
        if (birthdays.Count > 0)
        {
            var ids = birthdays.Select(c => c.Id).ToList();
            var yearStart = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var existing = (await _db.AppNotifications.IgnoreQueryFilters()
                .Where(n => n.Type == NotificationType.Birthday && n.EntityId != null
                            && ids.Contains(n.EntityId.Value) && n.CreatedAtUtc >= yearStart)
                .Select(n => n.EntityId!.Value).ToListAsync(ct)).ToHashSet();
            foreach (var c in birthdays.Where(c => !existing.Contains(c.Id)))
            {
                _db.AppNotifications.Add(new AppNotification(c.TenantId, NotificationType.Birthday,
                    $"تولد {c.FullName} است 🎉",
                    "امروز تولدِ این مشتری است؛ می‌توانید با یک پیام یا تخفیفِ ویژه، تجربه‌ای به‌یادماندنی بسازید.",
                    "Customer", c.Id));
                created++;
            }
        }

        return (created, new { created });
    }

    /* ── housekeeping ───────────────────────────────────────────────────── */

    private async Task<(int, object)> CleanupTokens(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddDays(-7);
        var stale = await _db.RefreshTokens
            .Where(t => (t.RevokedAtUtc != null && t.RevokedAtUtc < cutoff) || t.ExpiresAtUtc < cutoff)
            .Take(2000).ToListAsync(ct);
        _db.RefreshTokens.RemoveRange(stale);
        return (stale.Count, new { removed = stale.Count });
    }

    private async Task<(int, object)> UsageRollup(CancellationToken ct)
    {
        // The window is a billing period and then some, not a day. The job is idempotent per
        // order, so looking back further costs little — and a one-day window meant any day the
        // job did not run (a sleeping app pool, a missed external call) was never counted.
        var since = DateTime.UtcNow.AddDays(-35);
        var orders = await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Status == OrderStatus.Completed && o.CompletedAtUtc != null && o.CompletedAtUtc >= since)
            .Select(o => new { o.Id, o.TenantId, o.CompletedAtUtc, o.TotalRials })
            .ToListAsync(ct);
        if (orders.Count == 0) return (0, new { added = 0 });

        var ids = orders.Select(o => o.Id).ToList();
        var counted = (await _db.UsageEvents.IgnoreQueryFilters()
            .Where(u => ids.Contains(u.OrderId))
            .Select(u => u.OrderId)
            .ToListAsync(ct)).ToHashSet();

        var added = 0;
        foreach (var o in orders.Where(o => !counted.Contains(o.Id)))
        {
            _db.UsageEvents.Add(new UsageEvent(o.TenantId, o.Id, DateOnly.FromDateTime(o.CompletedAtUtc!.Value), o.TotalRials));
            added++;
        }
        return (added, new { added });
    }
}
