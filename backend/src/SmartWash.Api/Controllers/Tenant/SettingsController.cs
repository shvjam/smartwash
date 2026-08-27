using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.TenantSettings;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/settings")]
public sealed class SettingsController : ControllerBase
{
    private readonly ISender _sender;
    public SettingsController(ISender sender) => _sender = sender;

    public sealed record BrandingRequest(string? LogoUrl, string? PrimaryColor, string? Tagline, string Theme);
    public sealed record LoyaltyRequest(bool Enabled, int PointsPerRial, long PointValue, int ExpiryDays);
    public sealed record ReceiptRequest(string Header, string? Footer, string? InvoicePrefix);
    // اتصالِ پیامک متمرکز است: مستاجر فقط Enabled را می‌فرستد.
    public sealed record SmsRequest(bool Enabled);
    public sealed record ReservationRequest(bool Enabled, int LeadMinutes, int MaxAdvanceDays);

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Get(CancellationToken ct)
        => (await _sender.Send(new GetTenantSettingsQuery(), ct)).ToActionResult();

    [HttpPut("branding")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<IActionResult> Branding([FromBody] BrandingRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateBrandingCommand(req.LogoUrl, req.PrimaryColor, req.Tagline, req.Theme), ct)).ToActionResult();

    [HttpPut("loyalty")]
    [HasPermission(Permissions.LoyaltyManage)]
    public async Task<IActionResult> Loyalty([FromBody] LoyaltyRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateLoyaltyCommand(req.Enabled, req.PointsPerRial, req.PointValue, req.ExpiryDays), ct)).ToActionResult();

    [HttpPut("receipt")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<IActionResult> Receipt([FromBody] ReceiptRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateReceiptCommand(req.Header, req.Footer, req.InvoicePrefix), ct)).ToActionResult();

    [HttpPut("sms")]
    [HasPermission(Permissions.SmsManage)]
    public async Task<IActionResult> Sms([FromBody] SmsRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateSmsSettingsCommand(req.Enabled), ct)).ToActionResult();

    [HttpPut("reservation")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<IActionResult> Reservation([FromBody] ReservationRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateReservationSettingsCommand(req.Enabled, req.LeadMinutes, req.MaxAdvanceDays), ct)).ToActionResult();
}
