using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Platform;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Platform;

[ApiController]
[Authorize]
[Route("api/platform/cron-health")]
public sealed class CronHealthController : ControllerBase
{
    private readonly ISender _sender;
    public CronHealthController(ISender sender) => _sender = sender;

    /// <summary>
    /// Reports when each scheduled job last ran and whether it succeeded. Read-only, and
    /// deliberately behind the platform audit permission rather than the cron secret: this
    /// is for the operator watching the system, not for the scheduler calling into it.
    /// </summary>
    [HttpGet]
    [HasPermission(Permissions.AuditRead)]
    public async Task<IActionResult> Get(CancellationToken ct)
        => (await _sender.Send(new GetCronHealthQuery(), ct)).ToActionResult();
}
