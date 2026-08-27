using SmartWash.Domain.Common;

namespace SmartWash.Domain.Operations;

public sealed class UsageEvent : Entity<Guid>, ITenantScoped
{
    private UsageEvent() { }

    public UsageEvent(Guid tenantId, Guid orderId, DateOnly periodDate, long revenueRials)
    {
        Id = Guid.NewGuid();
        TenantId = tenantId;
        OrderId = orderId;
        PeriodDate = periodDate;
        RevenueRials = revenueRials;
        OccurredAtUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public Guid OrderId { get; private set; }
    public DateOnly PeriodDate { get; private set; }
    public long RevenueRials { get; private set; }
    public bool Invoiced { get; private set; }
    public Guid? InvoiceId { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }

    public void MarkInvoiced(Guid invoiceId)
    {
        Invoiced = true;
        InvoiceId = invoiceId;
    }
}
// resync-marker
