using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Billing;

public sealed class Invoice : AggregateRoot<Guid>
{
    private readonly List<InvoiceLine> _lines = new();

    private Invoice() { }

    public Guid TenantId { get; private set; }
    public Guid? SubscriptionId { get; private set; }
    public string Number { get; private set; } = null!;
    public InvoiceKind Kind { get; private set; }
    public InvoiceStatus Status { get; private set; }
    public DateTime IssuedAtUtc { get; private set; }
    public DateTime DueAtUtc { get; private set; }
    public DateTime? PaidAtUtc { get; private set; }
    public long SubtotalRials { get; private set; }
    public long TaxRials { get; private set; }
    public long TotalRials { get; private set; }
    public string? Notes { get; private set; }

    public IReadOnlyCollection<InvoiceLine> Lines => _lines.AsReadOnly();

    public static Invoice Create(Guid tenantId, Guid? subscriptionId, InvoiceKind kind, string number, DateTime dueAtUtc)
    {
        return new Invoice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SubscriptionId = subscriptionId,
            Number = number,
            Kind = kind,
            Status = InvoiceStatus.Open,
            IssuedAtUtc = DateTime.UtcNow,
            DueAtUtc = dueAtUtc,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void AddLine(string description, int quantity, long unitPriceRials)
    {
        _lines.Add(new InvoiceLine(Id, description, quantity, unitPriceRials));
        Recalculate();
    }

    private void Recalculate()
    {
        SubtotalRials = _lines.Sum(l => l.LineTotalRials);
        TaxRials = 0;
        TotalRials = SubtotalRials + TaxRials;
    }

    public void MarkPaid()
    {
        if (Status == InvoiceStatus.Paid) return;
        if (Status == InvoiceStatus.Void) throw new DomainException("Invoice.Void", "فاکتور باطل‌شده قابل پرداخت نیست.");
        Status = InvoiceStatus.Paid;
        PaidAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Void(string reason)
    {
        Status = InvoiceStatus.Void;
        Notes = string.IsNullOrWhiteSpace(Notes) ? reason : $"{Notes}\n{reason}";
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public sealed class InvoiceLine : Entity<Guid>
{
    private InvoiceLine() { }

    internal InvoiceLine(Guid invoiceId, string description, int quantity, long unitPriceRials)
    {
        Id = Guid.NewGuid();
        InvoiceId = invoiceId;
        Description = description;
        Quantity = quantity;
        UnitPriceRials = unitPriceRials;
        LineTotalRials = quantity * unitPriceRials;
    }

    public Guid InvoiceId { get; private set; }
    public string Description { get; private set; } = null!;
    public int Quantity { get; private set; }
    public long UnitPriceRials { get; private set; }
    public long LineTotalRials { get; private set; }
}

public enum InvoiceKind
{
    Subscription = 0,
    Setup = 1,
    UsageBased = 2,
    AddOn = 3,
    Manual = 4
}

public enum InvoiceStatus
{
    Open = 0,
    Paid = 1,
    Overdue = 2,
    Void = 3
}
// resync-marker
