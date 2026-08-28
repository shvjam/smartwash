using SmartWash.Application.Abstractions.Messaging;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Public;

[ApiController]
[Route("api/public/contact")]
public sealed class ContactController : ControllerBase
{
    private readonly IEmailSender _email;
    private readonly IConfiguration _config;
    private readonly ILogger<ContactController> _logger;

    public ContactController(IEmailSender email, IConfiguration config, ILogger<ContactController> logger)
    {
        _email = email;
        _config = config;
        _logger = logger;
    }

    public sealed record ContactRequest(
        string Name,
        string Email,
        string Subject,
        string Message);

    /// <summary>فرم تماس عمومی — بدون احراز هویت</summary>
    [HttpPost]
    public async Task<IActionResult> Submit([FromBody] ContactRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name) ||
            string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Message))
        {
            return BadRequest(new { code = "Validation.Required", message = "نام، ایمیل و متن پیام الزامی است." });
        }

        var supportEmail = _config["Smtp:From"] ?? "info@appsmartwash.com";

        var html = $"""
            <div dir="rtl" style="font-family: Tahoma, sans-serif; font-size: 14px; color: #333;">
              <h2 style="color:#e8262c;">پیام جدید از فرم تماس</h2>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:6px;font-weight:bold;">نام:</td><td>{System.Net.WebUtility.HtmlEncode(req.Name)}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">ایمیل:</td><td>{System.Net.WebUtility.HtmlEncode(req.Email)}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">موضوع:</td><td>{System.Net.WebUtility.HtmlEncode(req.Subject)}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;vertical-align:top;">پیام:</td><td style="white-space:pre-wrap;">{System.Net.WebUtility.HtmlEncode(req.Message)}</td></tr>
              </table>
            </div>
            """;

        try
        {
            await _email.SendAsync(
                to: supportEmail,
                subject: $"[SmartWash Contact] {req.Subject}",
                htmlBody: html,
                ct: ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Contact email failed for {Email}", req.Email);
            // Still return 200 — user shouldn't see infra errors
        }

        return Ok(new { ok = true, message = "پیام شما دریافت شد. به‌زودی با شما تماس می‌گیریم." });
    }
}
