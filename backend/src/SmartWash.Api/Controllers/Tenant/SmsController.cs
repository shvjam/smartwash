using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Sms;
using SmartWash.Domain.Billing;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

/// <summary>
/// پنل پیامک کارواش: سهمیه‌ی دوره، قالب‌های مجاز و دفترِ ارسال.
/// تنظیمات اتصال، کلید API و خط ارسال در این کنترلر وجود ندارد و تنها در اختیار پلتفرم است.
/// </summary>
[ApiController]
[Authorize]
[Route("api/sms")]
public sealed class SmsController : ControllerBase
{
    private readonly ISender _sender;
    public SmsController(ISender sender) => _sender = sender;

    public sealed record ToggleTemplateRequest(bool Enabled);

    [HttpGet("summary")]
    [HasPermission(Permissions.SmsManage)]
    public async Task<IActionResult> Summary(CancellationToken ct)
        => (await _sender.Send(new GetMySmsSummaryQuery(), ct)).ToActionResult();

    [HttpGet("templates")]
    [HasPermission(Permissions.SmsManage)]
    public async Task<IActionResult> Templates(CancellationToken ct)
        => (await _sender.Send(new ListMySmsTemplatesQuery(), ct)).ToActionResult();

    [HttpPut("templates/{id:guid}")]
    [HasPermission(Permissions.SmsManage)]
    public async Task<IActionResult> SetTemplate(Guid id, [FromBody] ToggleTemplateRequest req, CancellationToken ct)
        => (await _sender.Send(new SetMySmsTemplateCommand(id, req.Enabled), ct)).ToActionResult();

    [HttpGet("usage")]
    [HasPermission(Permissions.SmsManage)]
    public async Task<IActionResult> Usage([FromQuery] SmsUsageStatus? status, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25, CancellationToken ct = default)
        => (await _sender.Send(new ListMySmsUsageQuery(status, page, pageSize), ct)).ToActionResult();
}
