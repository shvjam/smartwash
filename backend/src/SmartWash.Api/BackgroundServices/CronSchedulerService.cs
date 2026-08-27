using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Modules.Billing;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Operations;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Api.BackgroundServices;

/// <summary>
/// سرویس پس‌زمینه که وظایف زمان‌بندی‌شده را اجرا می‌کند.
/// جایگزین Cron Job خارجی در محیط‌هایی که cron در دسترس نیست.
///
/// وظایف:
///   - هر شب ساعت ۲ بامداد: daily-billing (تمدید اشتراک‌ها)
///   - هر شب ساعت ۳ بامداد: expire-overdue (انقضای اشتراک‌های معوق)
///   - هر صبح ساعت ۸: send-reminders (ارسال SMS یادآور)
///   - هر ۱۰ دقیقه: generate-notifications (تولیدِ اعلان‌های درون‌برنامه‌ای)
/// </summary>
public sealed class CronSchedulerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CronSchedulerService> _logger;

    public CronSchedulerService(IServiceScopeFactory scopeFactory, ILogger<CronSchedulerService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("CronSchedulerService started");

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var todayBilling      = new DateTime(now.Year, now.Month, now.Day, 2, 0, 0, DateTimeKind.Utc);
            var todayExpire       = new DateTime(now.Year, now.Month, now.Day, 3, 0, 0, DateTimeKind.Utc);
            var todayReminder     = new DateTime(now.Year, now.Month, now.Day, 5, 0, 0, DateTimeKind.Utc); // 8:30 Iran time

            // محاسبه تأخیر تا اجرای بعدی وظایفِ روزانه (هر کدام که زودتر می‌رسد)
            var nextDaily = new[] { todayBilling, todayExpire, todayReminder }
                .Select(t => t <= now ? t.AddDays(1) : t)
                .Min();

            // اعلان‌ها هر ۱۰ دقیقه تولید می‌شوند؛ پس تأخیر را حداکثر ۱۰ دقیقه نگه می‌داریم
            // تا هم وظایفِ روزانه به‌موقع اجرا شوند و هم اعلان‌ها به‌صورت مرتب.
            var delay = nextDaily - now;
            if (delay > TimeSpan.FromMinutes(10)) delay = TimeSpan.FromMinutes(10);
            if (delay.TotalMilliseconds > 0)
            {
                await Task.Delay(delay, stoppingToken);
            }

            now = DateTime.UtcNow;

            // daily-billing: ساعت ۲ UTC
            if (Math.Abs((now.Hour * 60 + now.Minute) - 120) < 6)
                await RunDailyBillingAsync(stoppingToken);

            // expire-overdue: ساعت ۳ UTC
            if (Math.Abs((now.Hour * 60 + now.Minute) - 180) < 6)
                await ExpireOverdueAsync(stoppingToken);

            // send-reminders: ساعت ۵ UTC (= ۸:۳۰ ایران)
            if (Math.Abs((now.Hour * 60 + now.Minute) - 300) < 6)
                await SendRemindersAsync(stoppingToken);

            // generate-notifications: هر تیکِ حلقه (حداکثر هر ۱۰ دقیقه) — idempotent و ضدِتکرار
            await GenerateNotificationsAsync(stoppingToken);

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task RunDailyBillingAsync(CancellationToken ct)
    {
        _logger.LogInformation("Cron: daily-billing starting at {Now}", DateTime.UtcNow);
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            var now = DateTime.UtcNow;

            var dueSubs = await db.Subscriptions
                .IgnoreQueryFilters()
                .Where(s => s.Status == SubscriptionStatus.Active && s.AutoRenew && s.CurrentPeriodEndUtc <= now)
                .ToListAsync(ct);

            foreach (var sub in dueSubs)
            {
                // مبلغ پایان دوره کاملاً داده‌محور است: اجاره پایه (در صورت وجود)،
                // خودروی مازاد بر سهمیه و پیامکِ موفقِ خارج از سهمیه.
                var built = await SubscriptionInvoiceBuilder.BuildRenewalAsync(
                    db, sub, now, AppConstants.GracePeriodDays, ct);
                if (built.Invoice is null)
                {
                    // فاکتورِ صفر ساخته نمی‌شود؛ دوره بدون بدهی تمدید می‌شود.
                    sub.Renew();
                    continue;
                }
                sub.EnterGrace(AppConstants.GracePeriodDays);
            }
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Cron: daily-billing processed {Count} subscriptions", dueSubs.Count);
        }
        catch (Exception ex) { _logger.LogError(ex, "Cron: daily-billing failed"); }
    }

    private async Task ExpireOverdueAsync(CancellationToken ct)
    {
        _logger.LogInformation("Cron: expire-overdue starting at {Now}", DateTime.UtcNow);
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            var sms = scope.ServiceProvider.GetRequiredService<ISmsDispatcher>();
            var now = DateTime.UtcNow;

            var overdue = await db.Subscriptions
                .IgnoreQueryFilters()
                .Where(s => s.Status == SubscriptionStatus.PastDue && s.GraceEndsAtUtc != null && s.GraceEndsAtUtc < now)
                .ToListAsync(ct);

            foreach (var s in overdue)
            {
                s.Expire();
                var tenant = await db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == s.TenantId, ct);
                if (tenant is null) continue;
                tenant.Suspend("اشتراک منقضی شد و در دوره مهلت پرداخت انجام نشد.");

                if (!string.IsNullOrWhiteSpace(tenant.OwnerPhone))
                {
                    try
                    {
                        await sms.SendAsync(new SmsSendRequest(tenant.Id, SmsPurpose.BillingSuspended,
                            tenant.OwnerPhone,
                            new Dictionary<string, string> { ["Tenant"] = tenant.DisplayName },
                            $"SmartWash: اشتراک «{tenant.DisplayName}» به دلیل عدم پرداخت تعلیق شد. برای فعال‌سازی وارد پنل شوید.",
                            PlatformOriginated: true), ct);
                    }
                    catch (Exception ex) { _logger.LogWarning(ex, "SMS failed for tenant {TenantId}", s.TenantId); }
                }
            }
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Cron: expire-overdue expired {Count} subscriptions", overdue.Count);
        }
        catch (Exception ex) { _logger.LogError(ex, "Cron: expire-overdue failed"); }
    }

    private async Task SendRemindersAsync(CancellationToken ct)
    {
        _logger.LogInformation("Cron: send-reminders starting at {Now}", DateTime.UtcNow);
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            var sms = scope.ServiceProvider.GetRequiredService<ISmsDispatcher>();
            var now = DateTime.UtcNow;
            var tomorrow = now.AddDays(1);

            var due = await db.ServiceReminders
                .Where(r => r.Status == ReminderStatus.Pending && r.DueAtUtc >= now && r.DueAtUtc < tomorrow)
                .ToListAsync(ct);

            var sent = 0;
            foreach (var r in due)
            {
                var cust = await db.Customers.FirstOrDefaultAsync(c => c.Id == r.CustomerId, ct);
                if (cust is null || string.IsNullOrWhiteSpace(cust.Phone)) continue;

                var settings = await db.TenantSettings
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(s => s.TenantId == r.TenantId, ct);
                if (settings is not { SmsEnabled: true }) continue;

                // مسیر واحدِ ارسال: سهمیه‌ی پلن کنترل و هر تلاش به‌عنوان رخدادِ قابل‌ممیزی ثبت می‌شود.
                var outcome = await sms.SendAsync(new SmsSendRequest(r.TenantId, "NextWashReminder", cust.Phone,
                    new Dictionary<string, string> { ["title"] = r.Title },
                    $"SmartWash: {r.Title}"), ct);
                if (outcome.Sent) { r.MarkSent(); sent++; }
                else _logger.LogWarning("Cron: reminder SMS failed for {ReminderId}: {Error}", r.Id, outcome.Error);
            }
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Cron: send-reminders sent {Sent}/{Total}", sent, due.Count);
        }
        catch (Exception ex) { _logger.LogError(ex, "Cron: send-reminders failed"); }
    }

    private async Task GenerateNotificationsAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            var now = DateTime.UtcNow;
            var created = 0;

            // ۱) سفارش‌های معوق
            var inProgress = await db.Orders.IgnoreQueryFilters()
                .Where(o => o.Status == OrderStatus.InProgress)
                .Select(o => new { o.Id, o.TenantId, o.Number, o.StartedAtUtc, o.ExpectedDurationMinutes })
                .ToListAsync(ct);
            var overdue = inProgress.Where(o => o.StartedAtUtc.AddMinutes(o.ExpectedDurationMinutes) < now).ToList();
            if (overdue.Count > 0)
            {
                var ids = overdue.Select(o => o.Id).ToList();
                var existing = (await db.AppNotifications.IgnoreQueryFilters()
                    .Where(n => n.Type == NotificationType.OrderOverdue && n.EntityId != null && ids.Contains(n.EntityId.Value))
                    .Select(n => n.EntityId!.Value).ToListAsync(ct)).ToHashSet();
                foreach (var o in overdue)
                {
                    if (existing.Contains(o.Id)) continue;
                    var mins = (int)Math.Round((now - o.StartedAtUtc.AddMinutes(o.ExpectedDurationMinutes)).TotalMinutes);
                    db.AppNotifications.Add(new AppNotification(o.TenantId, NotificationType.OrderOverdue,
                        $"سفارش #{o.Number} معوق شده است",
                        $"این سفارش {mins} دقیقه از زمانِ برآوردیِ تحویل گذشته و هنوز تکمیل نشده است.",
                        "Order", o.Id));
                    created++;
                }
            }

            // ۲) یادآور رزرو (۲ ساعتِ آینده)
            var soon = now.AddHours(2);
            var upcoming = await db.Reservations.IgnoreQueryFilters()
                .Where(r => (r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed)
                            && r.ScheduledAtUtc > now && r.ScheduledAtUtc <= soon)
                .Select(r => new { r.Id, r.TenantId, r.CustomerName, r.ScheduledAtUtc })
                .ToListAsync(ct);
            if (upcoming.Count > 0)
            {
                var ids = upcoming.Select(r => r.Id).ToList();
                var existing = (await db.AppNotifications.IgnoreQueryFilters()
                    .Where(n => n.Type == NotificationType.ReservationReminder && n.EntityId != null && ids.Contains(n.EntityId.Value))
                    .Select(n => n.EntityId!.Value).ToListAsync(ct)).ToHashSet();
                foreach (var r in upcoming)
                {
                    if (existing.Contains(r.Id)) continue;
                    db.AppNotifications.Add(new AppNotification(r.TenantId, NotificationType.ReservationReminder,
                        $"رزرو نزدیک: {r.CustomerName}",
                        $"رزرو در ساعت {r.ScheduledAtUtc.AddHours(3.5):HH:mm} امروز موعد دارد؛ برای پذیرش آماده شوید.",
                        "Reservation", r.Id));
                    created++;
                }
            }

            // ۳) سررسید اشتراک (۳ روزِ آینده)
            var billingSoon = now.AddDays(3);
            var dueSubs = await db.Subscriptions.IgnoreQueryFilters()
                .Where(s => s.Status == SubscriptionStatus.Active && s.CurrentPeriodEndUtc > now && s.CurrentPeriodEndUtc <= billingSoon)
                .Select(s => new { s.Id, s.TenantId, s.CurrentPeriodEndUtc })
                .ToListAsync(ct);
            if (dueSubs.Count > 0)
            {
                var ids = dueSubs.Select(s => s.Id).ToList();
                var recentCutoff = now.AddDays(-3);
                var existing = (await db.AppNotifications.IgnoreQueryFilters()
                    .Where(n => n.Type == NotificationType.BillingDue && n.EntityId != null
                                && ids.Contains(n.EntityId.Value) && n.CreatedAtUtc >= recentCutoff)
                    .Select(n => n.EntityId!.Value).ToListAsync(ct)).ToHashSet();
                foreach (var s in dueSubs)
                {
                    if (existing.Contains(s.Id)) continue;
                    var days = Math.Max(0, (int)Math.Ceiling((s.CurrentPeriodEndUtc - now).TotalDays));
                    db.AppNotifications.Add(new AppNotification(s.TenantId, NotificationType.BillingDue,
                        "سررسید اشتراک نزدیک است",
                        $"اشتراک شما تا {days} روز دیگر سررسید می‌شود. برای جلوگیری از تعلیق سرویس، پرداخت را انجام دهید.",
                        "Subscription", s.Id));
                    created++;
                }
            }

            // ۴) تولد مشتری (یک‌بار در سال)
            var today = DateOnly.FromDateTime(now);
            var birthdays = await db.Customers.IgnoreQueryFilters()
                .Where(c => c.IsActive && c.BirthDate != null
                            && c.BirthDate.Value.Month == today.Month && c.BirthDate.Value.Day == today.Day)
                .Select(c => new { c.Id, c.TenantId, c.FullName })
                .ToListAsync(ct);
            if (birthdays.Count > 0)
            {
                var ids = birthdays.Select(c => c.Id).ToList();
                var yearStart = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                var existing = (await db.AppNotifications.IgnoreQueryFilters()
                    .Where(n => n.Type == NotificationType.Birthday && n.EntityId != null
                                && ids.Contains(n.EntityId.Value) && n.CreatedAtUtc >= yearStart)
                    .Select(n => n.EntityId!.Value).ToListAsync(ct)).ToHashSet();
                foreach (var c in birthdays)
                {
                    if (existing.Contains(c.Id)) continue;
                    db.AppNotifications.Add(new AppNotification(c.TenantId, NotificationType.Birthday,
                        $"تولد {c.FullName} است 🎉",
                        "امروز تولدِ این مشتری است؛ می‌توانید با یک پیام یا تخفیفِ ویژه، تجربه‌ای به‌یادماندنی بسازید.",
                        "Customer", c.Id));
                    created++;
                }
            }

            if (created > 0) await db.SaveChangesAsync(ct);
        }
        catch (Exception ex) { _logger.LogError(ex, "Cron: generate-notifications failed"); }
    }
}
