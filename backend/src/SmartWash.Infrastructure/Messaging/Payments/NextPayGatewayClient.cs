using System.Net.Http.Json;
using System.Text.Json.Serialization;
using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Domain.Billing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SmartWash.Infrastructure.Messaging.Payments;

public sealed class NextPayGatewayClient : IPaymentGatewayClient
{
    private readonly HttpClient _http;
    private readonly NextPayOptions _opt;
    private readonly ILogger<NextPayGatewayClient> _log;

    public NextPayGatewayClient(HttpClient http, IOptions<PaymentGatewayOptions> opt, ILogger<NextPayGatewayClient> log)
    {
        _http = http;
        _opt = opt.Value.NextPay;
        _log = log;
    }

    public PaymentGateway Gateway => PaymentGateway.NextPay;

    public async Task<PaymentRequestResult> RequestAsync(long amountRials, string callbackUrl, string description, CancellationToken ct)
    {
        try
        {
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["api_key"] = _opt.ApiKey,
                ["order_id"] = Guid.NewGuid().ToString("N"),
                ["amount"] = amountRials.ToString(),
                ["callback_uri"] = callbackUrl,
                ["customer_phone"] = "",
                ["custom_json_fields"] = "{}"
            });
            using var resp = await _http.PostAsync(_opt.BaseUrl, form, ct);
            var payload = await resp.Content.ReadFromJsonAsync<NextPayResp>(cancellationToken: ct);
            if (payload?.Code == -1 && !string.IsNullOrEmpty(payload.TransId))
                return new PaymentRequestResult(true, payload.TransId, _opt.StartPayUrl + payload.TransId, null, payload.TransId);
            return new PaymentRequestResult(false, null, null, payload?.Message ?? $"code={payload?.Code}", null);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "NextPay request failed");
            return new PaymentRequestResult(false, null, null, ex.Message, null);
        }
    }

    public async Task<PaymentVerifyResult> VerifyAsync(string authority, long amountRials, CancellationToken ct)
    {
        try
        {
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["api_key"] = _opt.ApiKey,
                ["trans_id"] = authority,
                ["amount"] = amountRials.ToString()
            });
            using var resp = await _http.PostAsync(_opt.VerifyUrl, form, ct);
            var payload = await resp.Content.ReadFromJsonAsync<NextPayResp>(cancellationToken: ct);
            if (payload?.Code == 0)
                return new PaymentVerifyResult(true, payload.Shaparak_Ref_Id ?? authority, null, authority);
            return new PaymentVerifyResult(false, null, payload?.Message ?? $"code={payload?.Code}", null);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "NextPay verify failed");
            return new PaymentVerifyResult(false, null, ex.Message, null);
        }
    }

    private sealed record NextPayResp([property: JsonPropertyName("code")] int Code,
        [property: JsonPropertyName("trans_id")] string? TransId,
        [property: JsonPropertyName("message")] string? Message,
        [property: JsonPropertyName("Shaparak_Ref_Id")] string? Shaparak_Ref_Id);
}
// resync-marker
