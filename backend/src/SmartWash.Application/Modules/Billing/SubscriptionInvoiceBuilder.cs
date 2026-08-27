using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Operations;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Billing;

/// <summary>
/// سازنده‌ی واحدِ فاکتورِ پایانِ دوره. هر دو مسیرِ زمان‌بندی (CronController و CronSchedulerService)
/// از همین منطق استفاده می‌کنند تا مبلغ نهایی در همه‌جا یکسان محاسبه شود.
///
/// قواعد — هیچ مبلغی حدس زده نمی‌شود و همه از داده می‌آید:
///   • اجاره‌ی پایه فقط اگر بزرگ‌تر از صفر باشد به فاکتور می‌آید.
///   • در پلن مشارکتی، «خودروهای بیش از سهمیه × نرخ هر خودرو» تنها زمانی اضافه می‌شود
///     که نرخ هر خودرو در پلن تعریف شده باشد.
///   • پیامکِ مازاد فقط از ارسال‌های موفقِ همان دوره محاسبه می‌شود و ردیف‌های محاسبه‌شده
///     به وضعیت Invoiced می‌روند تا در دوره‌های بعد دوباره مطالبه نشوند.
///   • اگر هیچ ردیفی نداشتیم، فاکتوری ساخته نمی‌شود.
/// </summary>
public static class SubscriptionInvoiceBuilder
{
    public sealed record RenewalResult(Invoice? Invoice, int CarCount, int BillableCars, int SmsOverageUnits);

    public static async Task<RenewalResult> BuildRenewalAsync(IAppDbContext db, Subscription sub, DateTime nowUtc,
        int gracePeriodDays, CancellationToken ct)
    {
        var periodStart = sub.CurrentPeriodStartUtc;
        var periodEnd = sub.CurrentPeriodEndUtc;

        var plan = await db.Plans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == sub.PlanId, ct);

        var number = $"INV-{nowUtc:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        var invoice = Invoice.Create(sub.TenantId, sub.Id, InvoiceKind.Subscription, number,
            nowUtc.AddDays(gracePeriodDays));
        var hasLine = false;

        // ۱) اجاره‌ی پایه — تنها در صورت وجود مبلغ.
        if (sub.PriceRials > 0)
        {
            invoice.AddLine($"اشتراک {plan?.DisplayName ?? "پلن"} ({CycleLabel(sub.Cycle)})", 1, sub.PriceRials);
            hasLine = true;
        }

        // ۲) مصرفِ مشارکتی — خودروهای پذیرش‌شده‌ی فراتر از سهمیه.
        var carCount = 0;
        var billableCars = 0;
        if (plan is not null && plan.BillingModel is PlanBillingModel.UsageBased or PlanBillingModel.Hybrid)
        {
            carCount = await db.Orders.IgnoreQueryFilters()
                .CountAsync(o => o.TenantId == sub.TenantId
                                 && o.Status != OrderStatus.Cancelled
                                 && o.CreatedAtUtc >= periodStart && o.CreatedAtUtc < periodEnd, ct);

            var freeQuota = plan.IncludedCarsPerMonth ?? 0;
            var excess = Math.Max(0, carCount - freeQuota);
            if (excess > 0 && plan.PerCarPriceRials > 0)
            {
                billableCars = excess;
                invoice.AddLine($"خودروی مازاد بر سهمیه ({freeQuota} خودروی رایگان)", excess, plan.PerCarPriceRials);
                hasLine = true;
            }
        }

        // ۳) پیامکِ مازاد — تنها ارسال‌های موفقِ قیمت‌خورده.
        var smsRows = await db.SmsUsageRecords.IgnoreQueryFilters()
            .Where(r => r.TenantId == sub.TenantId
                        && r.Status == SmsUsageStatus.Sent
                        && r.OverageUnitPriceRials > 0
                        && r.OccurredAtUtc >= periodStart && r.OccurredAtUtc < periodEnd)
            .ToListAsync(ct);

        var smsUnits = smsRows.Sum(r => r.Units);
        if (smsUnits > 0)
        {
            // نرخ در لحظه‌ی ارسال قطعی شده است؛ برای نمایش، نرخِ غالبِ همان دوره استفاده می‌شود.
            var unitPrice = smsRows.Sum(r => (long)r.Units * r.OverageUnitPriceRials) / smsUnits;
            invoice.AddLine("پیامک مازاد بر سهمیه (ارسال موفق)", smsUnits, unitPrice);
            foreach (var row in smsRows) row.MarkInvoiced();
            hasLine = true;
        }

        if (!hasLine) return new RenewalResult(null, carCount, billableCars, smsUnits);

        db.Invoices.Add(invoice);
        return new RenewalResult(invoice, carCount, billableCars, smsUnits);
    }

    private static string CycleLabel(BillingCycle cycle) => cycle switch
    {
        BillingCycle.Monthly => "ماهانه",
        BillingCycle.Yearly => "سالانه",
        _ => cycle.ToString(),
    };
}
