using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Abstractions.Billing;

/// <summary>
/// Which plan governs a tenant at this moment.
///
/// Three places needed this and each worked it out for itself, reading the plan off an active
/// subscription. They were all wrong in the same way and for the same reason: a carwash on
/// its free trial has no subscription, so each of them resolved to nothing. The consequences
/// read differently on the screen — no features, no SMS allowance, no templates — but they
/// were one bug, and fixing it in one of the three would have left the other two.
///
/// So the question is answered once, here: the plan behind a live subscription if there is
/// one, otherwise the trial plan for as long as the trial is actually running, and otherwise
/// nothing at all.
/// </summary>
public static class GoverningPlan
{
    public static async Task<Guid?> ResolveIdAsync(IAppDbContext db, Guid tenantId, CancellationToken ct)
    {
        var subscribed = await db.Subscriptions.AsNoTracking().IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId &&
                (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.PastDue))
            .OrderByDescending(s => s.CurrentPeriodEndUtc)
            .Select(s => (Guid?)s.PlanId)
            .FirstOrDefaultAsync(ct);
        if (subscribed is not null) return subscribed;

        var now = DateTime.UtcNow;
        var onTrial = await db.Tenants.AsNoTracking().IgnoreQueryFilters()
            .AnyAsync(t => t.Id == tenantId
                           && t.Status == TenantStatus.Trial
                           && t.TrialEndsAtUtc != null && t.TrialEndsAtUtc > now, ct);
        if (!onTrial) return null;

        return await db.Plans.AsNoTracking().IgnoreQueryFilters()
            .Where(p => p.Code == AppConstants.TrialPlanCode && p.IsActive)
            .Select(p => (Guid?)p.Id)
            .FirstOrDefaultAsync(ct);
    }
}
