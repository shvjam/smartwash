using SmartWash.Domain.Billing;

namespace SmartWash.Application.Abstractions.Messaging;

public interface IPaymentGatewayFactory
{
    IPaymentGatewayClient Create(PaymentGateway gateway);
}

public interface IPaymentGatewayClient
{
    PaymentGateway Gateway { get; }
    Task<PaymentRequestResult> RequestAsync(long amountRials, string callbackUrl, string description, CancellationToken ct);
    Task<PaymentVerifyResult> VerifyAsync(string authority, long amountRials, CancellationToken ct);
}

public sealed record PaymentRequestResult(bool IsSuccess, string? Authority, string? RedirectUrl, string? Error, string? Raw);
public sealed record PaymentVerifyResult(bool IsSuccess, string? ReferenceId, string? Error, string? Raw);
// resync-marker
