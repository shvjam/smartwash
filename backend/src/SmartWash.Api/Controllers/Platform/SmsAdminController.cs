using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Platform;
using SmartWash.Domain.Billing;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Platform;

/// <summary>
/// سرویس پیامک پلتفرم. قالب‌ها و مصرف با مجوزِ خواندن/نوشتنِ پیامک در دسترس‌اند،
/// اما اتصال تامین‌کننده (کلید API و خط ارسال) تنها با مجوزِ اختصاصیِ مدیر ارشد.
/// </summary>
[ApiController]
[Authorize]
[Route("api/platform/sms")]
public sealed class SmsAdminController : ControllerBase
{
    private readonly ISender _sender;
    public SmsAdminController(ISender sender) => _sender = sender;

    public sealed record TemplateCreateRequest(string Code, string DisplayName, int ProviderTemplateId,
        SmsTemplateCategory Category, string[]? Parameters, bool IsTenantAvailable);
    public sealed record TemplateUpdateRequest(string DisplayName, int ProviderTemplateId,
        SmsTemplateCategory Category, string[]? Parameters, bool IsTenantAvailable, bool IsActive);
    public sealed record AssignmentRequest(bool Enabled);
    public sealed record ProviderSettingsRequest(string Provider, string BaseUrl, string? ApiKey, string? LineNumber, bool IsEnabled);
    public sealed record TestRequest(string Recipient, string? Body);

    // ---------- Templates ----------

    [HttpGet("templates")]
    [HasPermission(Permissions.SmsRead)]
    public async Task<IActionResult> Templates([FromQuery] bool? onlyActive, [FromQuery] bool? onlyTenantAvailable,
        CancellationToken ct)
        => (await _sender.Send(new ListPlatformSmsTemplatesQuery(onlyActive, onlyTenantAvailable), ct)).ToActionResult();

    [HttpPost("templates")]
    [HasPermission(Permissions.SmsWrite)]
    public async Task<IActionResult> CreateTemplate([FromBody] TemplateCreateRequest req, CancellationToken ct)
        => (await _sender.Send(new CreatePlatformSmsTemplateCommand(req.Code, req.DisplayName, req.ProviderTemplateId,
            req.Category, req.Parameters, req.IsTenantAvailable), ct)).ToActionResult();

    [HttpPut("templates/{id:guid}")]
    [HasPermission(Permissions.SmsWrite)]
    public async Task<IActionResult> UpdateTemplate(Guid id, [FromBody] TemplateUpdateRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdatePlatformSmsTemplateCommand(id, req.DisplayName, req.ProviderTemplateId,
            req.Category, req.Parameters, req.IsTenantAvailable, req.IsActive), ct)).ToActionResult();

    // ---------- Tenant grants ----------

    [HttpGet("tenants/{tenantId:guid}/templates")]
    [HasPermission(Permissions.SmsRead)]
    public async Task<IActionResult> TenantTemplates(Guid tenantId, CancellationToken ct)
        => (await _sender.Send(new ListTenantSmsAssignmentsQuery(tenantId), ct)).ToActionResult();

    [HttpPut("tenants/{tenantId:guid}/templates/{templateId:guid}")]
    [HasPermission(Permissions.SmsWrite)]
    public async Task<IActionResult> SetTenantTemplate(Guid tenantId, Guid templateId,
        [FromBody] AssignmentRequest req, CancellationToken ct)
        => (await _sender.Send(new SetTenantSmsTemplateCommand(tenantId, templateId, req.Enabled), ct)).ToActionResult();

    [HttpGet("quotas")]
    [HasPermission(Permissions.SmsRead)]
    public async Task<IActionResult> Quotas(CancellationToken ct)
        => (await _sender.Send(new ListTenantSmsQuotasQuery(), ct)).ToActionResult();

    // ---------- Usage ledger ----------

    [HttpGet("usage")]
    [HasPermission(Permissions.SmsRead)]
    public async Task<IActionResult> Usage(
        [FromQuery] Guid? tenantId,
        [FromQuery] SmsUsageStatus? status,
        [FromQuery] Guid? templateId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
        => (await _sender.Send(new ListSmsUsageQuery(tenantId, status, templateId, fromUtc, toUtc, search,
            page, pageSize), ct)).ToActionResult();

    [HttpGet("stats")]
    [HasPermission(Permissions.SmsRead)]
    public async Task<IActionResult> Stats([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc,
        CancellationToken ct)
        => (await _sender.Send(new GetSmsDeskStatsQuery(fromUtc, toUtc), ct)).ToActionResult();

    // ---------- Provider connection (super-admin only) ----------

    [HttpGet("settings")]
    [HasPermission(Permissions.SmsProviderManage)]
    public async Task<IActionResult> Settings(CancellationToken ct)
        => (await _sender.Send(new GetSmsProviderSettingsQuery(), ct)).ToActionResult();

    [HttpPut("settings")]
    [HasPermission(Permissions.SmsProviderManage)]
    public async Task<IActionResult> UpdateSettings([FromBody] ProviderSettingsRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateSmsProviderSettingsCommand(req.Provider, req.BaseUrl, req.ApiKey,
            req.LineNumber, req.IsEnabled), ct)).ToActionResult();

    [HttpDelete("settings/api-key")]
    [HasPermission(Permissions.SmsProviderManage)]
    public async Task<IActionResult> ClearApiKey(CancellationToken ct)
        => (await _sender.Send(new ClearSmsApiKeyCommand(), ct)).ToActionResult();

    [HttpPost("settings/test")]
    [HasPermission(Permissions.SmsProviderManage)]
    public async Task<IActionResult> Test([FromBody] TestRequest req, CancellationToken ct)
        => (await _sender.Send(new SendSmsTestCommand(req.Recipient, req.Body), ct)).ToActionResult();
}
