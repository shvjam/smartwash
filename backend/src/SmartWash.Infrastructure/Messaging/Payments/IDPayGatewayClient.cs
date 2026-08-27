using System.Net.Http.Json;
using System.Text.Json.Serialization;
using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Domain.Billing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SmartWash.Infrastructure.Messaging.Payments;

public sealed class IDPayGatewayClient : IPaymentGatewayClient
{
    private readonly HttpClient _http;
    private readonly IDPayOptions _opt;
    private readonly ILogger<IDPayGatewayClient> _log;

    public IDPayGatewayClient(HttpClient http, IOptions<PaymentGatewayOptions> opt, ILogger<IDPayGatewayClient> log)
    {
        _http = http;
        _opt = opt.Value.IDPay;
        _log = log;
    }

    public PaymentGateway Gateway => PaymentGateway.IDPay;

    public async Task<PaymentRequestResult> RequestAsync(long amountRials, string callbackUrl, string description, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, _opt.BaseUrl)
            {
                Content = JsonContent.Create(new
                {
                    order_id = Guid.NewGuid().ToString("N"),
                    amount = amountRials,
                    callback = callbackUrl,
                    desc = description
                })
            };
            req.Headers.Add("X-API-KEY", _opt.ApiKey);
            req.Headers.Add("X-SANDBOX", _opt.Sandbox ? "1" : "0");
            using var resp = await _http.SendAsync(req, ct);
            var payload = await resp.Content.ReadFromJsonAsync<IDPayRequestResp>(cancellationToken: ct);
            if (resp.IsSuccessStatusCode && !string.IsNullOrEmpty(payload?.Id) && !string.IsNullOrEmpty(payload.Link))
                return new PaymentRequestResult(true, payload.Id, payload.Link, null, payload.Id);
            return new PaymentRequestResult(false, null, null, payload?.ErrorMessage ?? $"HTTP {(int)resp.StatusCode}", null);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "IDPay request failed");
            return new PaymentRequestResult(false, null, null, ex.Message, null);
        }
    }

    public async Task<PaymentVerifyResult> VerifyAsync(string authority, long amountRials, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, _opt.BaseUrl + "/verify")
            {
                Content = JsonContent.Create(new { id = authority, order_id = authority })
            };
            req.Headers.Add("X-API-KEY", _opt.ApiKey);
            req.Headers.Add("X-SANDBOX", _opt.Sandbox ? "1" : "0");
            using var resp = await _http.SendAsync(req, ct);
            var payload = await resp.Content.ReadFromJsonAsync<IDPayVerifyResp>(cancellationToken: ct);
            if (resp.IsSuccessStatusCode && payload?.Status is 100 or 101)
                return new PaymentVerifyResult(true, payload.TrackId, null, payload.TrackId);
            return new PaymentVerifyResult(false, null, payload?.ErrorMessage ?? $"status={payload?.Status}", null);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "IDPay verify failed");
            return new PaymentVerifyResult(false, null, ex.Message, null);
        }
    }

    private sealed record IDPayRequestResp([property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("link")] string? Link,
        [property: JsonPropertyName("error_message")] string? ErrorMessage);
    private sealed record IDPayVerifyResp([property: JsonPropertyName("status")] int Status,
        [property: JsonPropertyName("track_id")] string? TrackId,
        [property: JsonPropertyName("error_message")] string? ErrorMessage);
}
// resync-marker
