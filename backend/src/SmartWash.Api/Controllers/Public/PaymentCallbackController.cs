using SmartWash.Application.Modules.Billing;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Public;

[ApiController]
[Route("api/public/payments")]
public sealed class PaymentCallbackController : ControllerBase
{
    private readonly ISender _sender;
    private readonly IConfiguration _config;

    public PaymentCallbackController(ISender sender, IConfiguration config)
    {
        _sender = sender;
        _config = config;
    }

    /// <summary>
    /// درگاه پرداخت بعد از تأیید/لغو، کاربر را به این endpoint هدایت می‌کند.
    /// پرداخت verify شده، سپس کاربر به صفحه نتیجه در frontend ریدایرکت می‌شود.
    /// </summary>
    [HttpGet("callback/{paymentId:guid}")]
    public async Task<IActionResult> Callback(
        Guid paymentId,
        [FromQuery] string? Authority, [FromQuery] string? authority,
        [FromQuery] string? trans_id,  [FromQuery] string? id,
        [FromQuery] string? Status,    [FromQuery] string? status,
        CancellationToken ct)
    {
        var frontendBase = _config["Frontend:BaseUrl"]
                           ?? _config.GetSection("Cors:AllowedOrigins")
                               .Get<string[]>()?.FirstOrDefault()
                           ?? "https://smartwash.zishot.com";
        var resultBase = $"{frontendBase}/app/billing/result?paymentId={paymentId}";

        // لغو پرداخت توسط کاربر
        var st = Status ?? status;
        if (!string.IsNullOrEmpty(st)
            && !string.Equals(st, "OK", StringComparison.OrdinalIgnoreCase)
            && st != "1" && st != "100")
        {
            return Redirect($"{resultBase}&status=failed&code=Payment.Cancelled");
        }

        var auth = Authority ?? authority ?? trans_id ?? id;
        if (string.IsNullOrEmpty(auth))
            return Redirect($"{resultBase}&status=failed&code=Payment.MissingAuthority");

        var result = await _sender.Send(new VerifyPaymentCommand(paymentId, auth), ct);

        return result.IsSuccess
            ? Redirect($"{resultBase}&status=success&Authority={Uri.EscapeDataString(auth)}")
            : Redirect($"{resultBase}&status=failed&code={Uri.EscapeDataString(result.Error.Code)}");
    }
}
