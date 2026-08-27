using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Billing;

public sealed class Subscription : AggregateRoot<Guid>
{
    private Subscription() { }

    public Guid TenantId { get; private set; }
    public Guid PlanId { get; private set; }
    public BillingCycle Cycle { get; private set; }
    public SubscriptionStatus Status { get; private set; }
    public DateTime StartsAtUtc { get; private set; }
    public DateTime CurrentPeriodStartUtc { get; private set; }
    public DateTime CurrentPeriodEndUtc { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }
    public DateTime? GraceEndsAtUtc { get; private set; }
    public long PriceRials { get; private set; }
    public bool AutoRenew { get; private set; } = true;

    public static Subscription Create(Guid tenantId, Guid planId, BillingCycle cycle, long priceRials)
    {
        var now = DateTime.UtcNow;
        var end = cycle switch
        {
            BillingCycle.Monthly => now.AddMonths(1),
            BillingCycle.Yearly => now.AddYears(1),
            _ => now.AddMonths(1)
        };

        return new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PlanId = planId,
            Cycle = cycle,
            Status = SubscriptionStatus.PendingPayment,
            PriceRials = priceRials,
            StartsAtUtc = now,
            CurrentPeriodStartUtc = now,
            CurrentPeriodEndUtc = end,
            CreatedAtUtc = now
        };
    }

    public void MarkActive()
    {
        if (Status == SubscriptionStatus.Cancelled) throw new DomainException("Subscription.Cancelled", "اشتراک لغو شده قابل فعال‌سازی نیست.");
        Status = SubscriptionStatus.Active;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Renew()
    {
        var newStart = CurrentPeriodEndUtc;
        var newEnd = Cycle == BillingCycle.Yearly ? newStart.AddYears(1) : newStart.AddMonths(1);
        CurrentPeriodStartUtc = newStart;
        CurrentPeriodEndUtc = newEnd;
        Status = SubscriptionStatus.Active;
        GraceEndsAtUtc = null;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// تمدید دستیِ اشتراک به میزانِ N روز (توسط ادمینِ پلتفرم). پایانِ دوره تمدید می‌شود،
    /// اشتراک به وضعیت فعال بازمی‌گردد و مهلتِ سررسیدِ گذشته پاک می‌شود.
    /// </summary>
    public void Extend(int days)
    {
        if (days <= 0) throw new DomainException("Subscription.InvalidDays", "تعداد روز باید مثبت باشد.");
        if (Status == SubscriptionStatus.Cancelled) throw new DomainException("Subscription.Cancelled", "اشتراک لغو شده قابل تمدید نیست.");
        // مبنای تمدید: اگر دوره هنوز به پایان نرسیده از پایانِ فعلی، وگرنه از «اکنون» (تا روزهای گذشته دوباره حساب نشوند).
        var basis = CurrentPeriodEndUtc > DateTime.UtcNow ? CurrentPeriodEndUtc : DateTime.UtcNow;
        CurrentPeriodEndUtc = basis.AddDays(days);
        Status = SubscriptionStatus.Active;
        GraceEndsAtUtc = null;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void EnterGrace(int graceDays)
    {
        Status = SubscriptionStatus.PastDue;
        GraceEndsAtUtc = DateTime.UtcNow.AddDays(graceDays);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Expire()
    {
        Status = SubscriptionStatus.Expired;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status = SubscriptionStatus.Cancelled;
        CancelledAtUtc = DateTime.UtcNow;
        AutoRenew = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void DisableAutoRenew() => AutoRenew = false;
    public void EnableAutoRenew() => AutoRenew = true;
}

public enum BillingCycle
{
    Monthly = 0,
    Yearly = 1
}

public enum SubscriptionStatus
{
    PendingPayment = 0,
    Active = 1,
    PastDue = 2,
    Cancelled = 3,
    Expired = 4
}
// resync-marker
