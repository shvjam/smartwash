using System.Net.Http.Json;
using System.Text.Json.Serialization;
using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Domain.Billing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SmartWash.Infrastructure.Messaging.Payments;

public sealed class ZarinpalGatewayClient : IPaymentGatewayClient
{
    private readonly HttpClient _http;
    private readonly ZarinpalOptions _opt;
    private readonly ILogger<ZarinpalGatewayClient> _log;

    public ZarinpalGatewayClient(HttpClient http, IOptions<PaymentGatewayOptions> opt, ILogger<ZarinpalGatewayClient> log)
    {
        _http = http;
        _opt = opt.Value.Zarinpal;
        _log = log;
    }

    public PaymentGateway Gateway => PaymentGateway.Zarinpal;

    public async Task<PaymentRequestResult> RequestAsync(long amountRials, string callbackUrl, string description, CancellationToken ct)
    {
        try
        {
            var body = new
            {
                merchant_id = _opt.MerchantId,
                amount = amountRials,
                callback_url = callbackUrl,
                description
            };
            using var resp = await _http.PostAsJsonAsync(_opt.BaseUrl + "request.json", body, ct);
            var payload = await resp.Content.ReadFromJsonAsync<ZarinpalResponse>(cancellationToken: ct);
            if (payload?.Data?.Code == 100 && !string.IsNullOrEmpty(payload.Data.Authority))
                return new PaymentRequestResult(true, payload.Data.Authority, _opt.StartPayUrl + payload.Data.Authority, null, payload.Data.Authority);
            var err = payload?.Errors?.Message ?? $"Zarinpal code={payload?.Data?.Code}";
            return new PaymentRequestResult(false, null, null, err, null);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Zarinpal request failed");
            return new PaymentRequestResult(false, null, null, ex.Message, null);
        }
    }

    public async Task<PaymentVerifyResult> VerifyAsync(string authority, long amountRials, CancellationToken ct)
    {
        try
        {
            var body = new { merchant_id = _opt.MerchantId, authority, amount = amountRials };
            using var resp = await _http.PostAsJsonAsync(_opt.BaseUrl + "verify.json", body, ct);
            var payload = await resp.Content.ReadFromJsonAsync<ZarinpalResponse>(cancellationToken: ct);
            if (payload?.Data?.Code is 100 or 101)
                return new PaymentVerifyResult(true, payload.Data.RefId?.ToString(), null, payload.Data.RefId?.ToString());
            return new PaymentVerifyResult(false, null, payload?.Errors?.Message ?? $"code={payload?.Data?.Code}", null);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Zarinpal verify failed");
            return new PaymentVerifyResult(false, null, ex.Message, null);
        }
    }

    private sealed record ZarinpalResponse([property: JsonPropertyName("data")] ZarinpalData? Data,
        [property: JsonPropertyName("errors")] ZarinpalErrors? Errors);
    private sealed record ZarinpalData([property: JsonPropertyName("code")] int Code,
        [property: JsonPropertyName("authority")] string? Authority,
        [property: JsonPropertyName("ref_id")] long? RefId);
    private sealed record ZarinpalErrors([property: JsonPropertyName("code")] int Code,
        [property: JsonPropertyName("message")] string? Message);
}
// resync-marker
