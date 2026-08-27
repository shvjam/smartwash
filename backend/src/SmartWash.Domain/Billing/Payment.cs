using SmartWash.Domain.Common;

namespace SmartWash.Domain.Billing;

public sealed class Payment : AggregateRoot<Guid>
{
    private Payment() { }

    public Guid TenantId { get; private set; }
    public Guid InvoiceId { get; private set; }
    public PaymentGateway Gateway { get; private set; }
    public PaymentStatus Status { get; private set; }
    public long AmountRials { get; private set; }
    public string? Authority { get; private set; }
    public string? ReferenceId { get; private set; }
    public string? RawResponse { get; private set; }
    public DateTime? PaidAtUtc { get; private set; }
    public string CallbackUrl { get; private set; } = null!;

    public static Payment Create(Guid tenantId, Guid invoiceId, long amount, PaymentGateway gateway, string callbackUrl)
    {
        return new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            InvoiceId = invoiceId,
            AmountRials = amount,
            Gateway = gateway,
            Status = PaymentStatus.Pending,
            CallbackUrl = callbackUrl,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void AttachAuthority(string authority) { Authority = authority; UpdatedAtUtc = DateTime.UtcNow; }

    public void MarkSucceeded(string referenceId, string? raw)
    {
        Status = PaymentStatus.Succeeded;
        ReferenceId = referenceId;
        RawResponse = raw;
        PaidAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkFailed(string? raw)
    {
        Status = PaymentStatus.Failed;
        RawResponse = raw;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public enum PaymentGateway
{
    Zarinpal = 0,
    IDPay = 1,
    NextPay = 2,
    Manual = 99
}

public enum PaymentStatus
{
    Pending = 0,
    Succeeded = 1,
    Failed = 2,
    Refunded = 3
}
// resync-marker
