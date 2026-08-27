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
[Route("api/platform/audit-logs")]
public sealed class AuditLogsController : ControllerBase
{
    private readonly ISender _sender;
    public AuditLogsController(ISender sender) => _sender = sender;

    [HttpGet]
    [HasPermission(Permissions.AuditRead)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? tenantId,
        [FromQuery] Guid? userId,
        [FromQuery] string? entityName,
        [FromQuery] string? action,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
        => (await _sender.Send(new ListAuditLogsQuery(tenantId, userId, entityName, action, fromUtc, toUtc, page, pageSize), ct)).ToActionResult();
}
