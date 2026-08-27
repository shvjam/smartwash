using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Domain.Billing;
using Microsoft.Extensions.DependencyInjection;

namespace SmartWash.Infrastructure.Messaging.Payments;

public sealed class PaymentGatewayFactory : IPaymentGatewayFactory
{
    private readonly IServiceProvider _sp;
    public PaymentGatewayFactory(IServiceProvider sp) => _sp = sp;

    public IPaymentGatewayClient Create(PaymentGateway gateway) => gateway switch
    {
        PaymentGateway.Zarinpal => _sp.GetRequiredService<ZarinpalGatewayClient>(),
        PaymentGateway.IDPay => _sp.GetRequiredService<IDPayGatewayClient>(),
        PaymentGateway.NextPay => _sp.GetRequiredService<NextPayGatewayClient>(),
        PaymentGateway.Manual => _sp.GetRequiredService<ManualGatewayClient>(),
        _ => throw new NotSupportedException($"Unknown gateway {gateway}")
    };
}

public sealed class ManualGatewayClient : IPaymentGatewayClient
{
    public PaymentGateway Gateway => PaymentGateway.Manual;
    public Task<PaymentRequestResult> RequestAsync(long amountRials, string callbackUrl, string description, CancellationToken ct)
        => Task.FromResult(new PaymentRequestResult(true, Guid.NewGuid().ToString("N"), callbackUrl, null, "manual"));
    public Task<PaymentVerifyResult> VerifyAsync(string authority, long amountRials, CancellationToken ct)
        => Task.FromResult(new PaymentVerifyResult(true, authority, null, "manual"));
}
// resync-marker
