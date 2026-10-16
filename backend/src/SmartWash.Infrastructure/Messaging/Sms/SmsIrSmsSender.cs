using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using SmartWash.Application.Abstractions.Messaging;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SmartWash.Infrastructure.Messaging.Sms;

/// <summary>
/// Configuration for the sms.ir REST API (https://sms.ir/rest-api/).
/// </summary>
public sealed class SmsOptions
{
    public const string SectionName = "Sms";

    /// <summary>API key issued in the sms.ir panel (header X-API-KEY).</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Dedicated line (LineNumber) used for bulk / free-form messages, e.g. 30007732xxxxxx.</summary>
    public string Sender { get; set; } = string.Empty;

    /// <summary>sms.ir REST base URL — always ends with a trailing slash.</summary>
    public string BaseUrl { get; set; } = "https://api.sms.ir/v1/";

    /// <summary>Master switch — when false the sender becomes a no-op (useful in dev / tests).</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>HTTP timeout in seconds.</summary>
    public int TimeoutSeconds { get; set; } = 15;

    /// <summary>Pre-approved sms.ir template IDs keyed by logical purpose ("OtpLogin", "PasswordReset", "OrderReady", …).</summary>
    public Dictionary<string, int> Templates { get; set; } = new();
}

/// <summary>
/// sms.ir REST sender. Two flows are supported:
///   1. Free-form bulk send via /v1/send/bulk (requires a dedicated LineNumber).
///   2. Template-based verify send via /v1/send/verify (TemplateId + named parameters).
/// All requests authenticate with header X-API-KEY.
/// </summary>
public sealed class SmsIrSmsSender : ISmsSender
{
    private readonly HttpClient _http;
    private readonly SmsOptions _opt;
    private readonly ILogger<SmsIrSmsSender> _log;

    public SmsIrSmsSender(HttpClient http, IOptions<SmsOptions> opt, ILogger<SmsIrSmsSender> log)
    {
        _http = http;
        _opt = opt.Value;
        _log = log;

        if (!string.IsNullOrWhiteSpace(_opt.BaseUrl))
            _http.BaseAddress = new Uri(_opt.BaseUrl.EndsWith('/') ? _opt.BaseUrl : _opt.BaseUrl + "/");
        _http.Timeout = TimeSpan.FromSeconds(Math.Clamp(_opt.TimeoutSeconds, 3, 60));
        _http.DefaultRequestHeaders.Accept.Clear();
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (!string.IsNullOrWhiteSpace(_opt.ApiKey))
            _http.DefaultRequestHeaders.TryAddWithoutValidation("X-API-KEY", _opt.ApiKey);
    }

    public async Task SendAsync(string phone, string body, CancellationToken ct = default)
    {
        if (!Guard(phone)) return;
        await TrySendTextAsync(phone, body, null, ct);
    }

    public async Task<SmsDeliveryResult> TrySendTextAsync(string phone, string body, SmsCredentials? credentials, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(phone)) return SmsDeliveryResult.Fail("شماره گیرنده خالی است.");
        var line = credentials?.LineNumber ?? _opt.Sender;
        if (!long.TryParse(line, out var lineNumber))
            return SmsDeliveryResult.Fail("خط ارسال پیامک تنظیم نشده یا عددی نیست.");

        var req = new BulkSendRequest
        {
            LineNumber = lineNumber,
            MessageText = body,
            Mobiles = new[] { Normalize(phone) },
            SendDateTime = null
        };
        return await PostAsync("send/bulk", req, credentials, "bulk", phone, ct);
    }

    public Task<SmsDeliveryResult> TrySendVerifyAsync(string phone, int templateId,
        IReadOnlyDictionary<string, string> parameters, SmsCredentials? credentials, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(phone)) return Task.FromResult(SmsDeliveryResult.Fail("شماره گیرنده خالی است."));
        if (templateId <= 0) return Task.FromResult(SmsDeliveryResult.Fail("شناسه قالب تامین‌کننده معتبر نیست."));

        var req = new VerifySendRequest
        {
            Mobile = Normalize(phone),
            TemplateId = templateId,
            // Template variables are written #CODE#, #NAME#, #PLATE# in the sms.ir panel, and the
            // provider matches a sent parameter to them by name. Our call sites spell the same
            // names in ordinary case ("Code"), which the provider does not recognise as #CODE#,
            // and the message is rejected. Upper-casing here keeps the call sites readable and
            // still speaks the provider's convention.
            Parameters = parameters
                .Select(kv => new VerifyParameter { Name = kv.Key.ToUpperInvariant(), Value = kv.Value })
                .ToArray()
        };
        return PostAsync("send/verify", req, credentials, "verify", phone, ct);
    }

    /// <summary>
    /// تنها نقطه‌ی تماس با تامین‌کننده. اعتبارنامه در صورت ارسال، جای مقادیرِ appsettings را می‌گیرد
    /// تا تنظیماتِ ذخیره‌شده توسط مدیر پلتفرم بدون ری‌استارت اثر کند.
    /// </summary>
    private async Task<SmsDeliveryResult> PostAsync(string path, object payload, SmsCredentials? credentials,
        string flow, string phone, CancellationToken ct)
    {
        var apiKey = string.IsNullOrWhiteSpace(credentials?.ApiKey) ? _opt.ApiKey : credentials!.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
            return SmsDeliveryResult.Fail("کلید API سرویس پیامک تنظیم نشده است.");
        if (credentials is null && !_opt.Enabled)
            return SmsDeliveryResult.Fail("سرویس پیامک غیرفعال است.");

        var rawBase = string.IsNullOrWhiteSpace(credentials?.BaseUrl) ? _opt.BaseUrl : credentials!.BaseUrl!;
        if (string.IsNullOrWhiteSpace(rawBase)) rawBase = "https://api.sms.ir/v1/";
        if (!rawBase.EndsWith('/')) rawBase += "/";
        if (!Uri.TryCreate(new Uri(rawBase), path, out var uri))
            return SmsDeliveryResult.Fail("آدرس سرویس پیامک معتبر نیست.");

        using var request = new HttpRequestMessage(HttpMethod.Post, uri) { Content = JsonContent.Create(payload) };
        request.Headers.TryAddWithoutValidation("X-API-KEY", apiKey);
        try
        {
            using var resp = await _http.SendAsync(request, ct);
            var envelope = await TryReadAsync(resp, ct);
            LogResult(flow, phone, envelope, resp.StatusCode);
            // قرارداد sms.ir: status=1 موفق است و هر مقدار دیگر خطا با پیام فارسی.
            if (envelope?.Status == 1) return SmsDeliveryResult.Ok(envelope.Data?.MessageId?.ToString());
            return SmsDeliveryResult.Fail(string.IsNullOrWhiteSpace(envelope?.Message)
                ? $"پاسخ ناموفق از تامین‌کننده (HTTP {(int)resp.StatusCode})."
                : envelope!.Message!);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "sms.ir {Flow} send threw to {Phone}", flow, Mask(phone));
            return SmsDeliveryResult.Fail(ex.Message);
        }
    }

    public async Task SendByPurposeAsync(string phone, string purpose, IReadOnlyDictionary<string, string> parameters, string fallbackBody, CancellationToken ct = default)
    {
        if (!Guard(phone)) return;
        if (_opt.Templates.TryGetValue(purpose, out var tpl) && tpl > 0)
            await SendVerifyAsync(phone, tpl, parameters, ct);
        else
        {
            _log.LogInformation("sms.ir: no template mapped for purpose {Purpose} — falling back to bulk text", purpose);
            await SendAsync(phone, fallbackBody, ct);
        }
    }

    public async Task SendVerifyAsync(string phone, int templateId, IReadOnlyDictionary<string, string> parameters, CancellationToken ct = default)
    {
        if (!Guard(phone)) return;
        await TrySendVerifyAsync(phone, templateId, parameters, null, ct);
    }

    private bool Guard(string phone)
    {
        if (!_opt.Enabled || string.IsNullOrWhiteSpace(_opt.ApiKey))
        {
            _log.LogInformation("sms.ir disabled or missing API key — skipping send to {Phone}", Mask(phone));
            return false;
        }
        if (string.IsNullOrWhiteSpace(phone))
        {
            _log.LogWarning("sms.ir: empty phone — skipping");
            return false;
        }
        return true;
    }

    /// <summary>Normalises Iranian mobile numbers to the 09XXXXXXXXX shape expected by sms.ir.</summary>
    private static string Normalize(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("0098")) digits = digits[4..];
        else if (digits.StartsWith("98") && digits.Length == 12) digits = digits[2..];
        if (digits.StartsWith('9') && digits.Length == 10) digits = "0" + digits;
        return digits;
    }

    private static string Mask(string phone)
    {
        if (string.IsNullOrEmpty(phone)) return "***";
        return phone.Length <= 4 ? "***" : string.Concat(phone.AsSpan(0, 3), "***", phone.AsSpan(phone.Length - 2));
    }

    private static async Task<SmsIrEnvelope?> TryReadAsync(HttpResponseMessage resp, CancellationToken ct)
    {
        try { return await resp.Content.ReadFromJsonAsync<SmsIrEnvelope>(cancellationToken: ct); }
        catch { return null; }
    }

    private void LogResult(string flow, string phone, SmsIrEnvelope? payload, System.Net.HttpStatusCode http)
    {
        // sms.ir contract: status=1 is success, anything else is a failure with a Persian message.
        if (payload?.Status == 1)
            _log.LogInformation("sms.ir {Flow} ok → {Phone} (msgId={Id})", flow, Mask(phone), payload?.Data?.MessageId);
        else
            _log.LogWarning("sms.ir {Flow} failed → {Phone} http={Http} status={Status} msg={Msg}",
                flow, Mask(phone), (int)http, payload?.Status, payload?.Message);
    }

    // ---------- DTOs ----------
    private sealed class BulkSendRequest
    {
        [JsonPropertyName("lineNumber")] public long LineNumber { get; set; }
        [JsonPropertyName("messageText")] public string MessageText { get; set; } = string.Empty;
        [JsonPropertyName("mobiles")] public string[] Mobiles { get; set; } = Array.Empty<string>();
        [JsonPropertyName("sendDateTime")] public DateTime? SendDateTime { get; set; }
    }
    private sealed class VerifySendRequest
    {
        [JsonPropertyName("mobile")] public string Mobile { get; set; } = string.Empty;
        [JsonPropertyName("templateId")] public int TemplateId { get; set; }
        [JsonPropertyName("parameters")] public VerifyParameter[] Parameters { get; set; } = Array.Empty<VerifyParameter>();
    }
    private sealed class VerifyParameter
    {
        [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
        [JsonPropertyName("value")] public string Value { get; set; } = string.Empty;
    }
    private sealed class SmsIrEnvelope
    {
        [JsonPropertyName("status")] public int Status { get; set; }
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("data")] public SmsIrData? Data { get; set; }
    }
    private sealed class SmsIrData
    {
        [JsonPropertyName("messageId")] public long? MessageId { get; set; }
        [JsonPropertyName("cost")] public decimal? Cost { get; set; }
        [JsonPropertyName("packId")] public long? PackId { get; set; }
    }
}
// resync-marker
