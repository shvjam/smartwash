using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Shifts;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/shifts")]
public sealed class ShiftsController : ControllerBase
{
    private readonly ISender _sender;
    public ShiftsController(ISender sender) => _sender = sender;

    public sealed record OpenShiftRequest(Guid BranchId, long OpeningCashRials);
    public sealed record CloseShiftRequest(long ClosingCashRials, string? Notes);

    [HttpGet("open")]
    [HasPermission(Permissions.ShiftsManage)]
    public async Task<IActionResult> GetOpen([FromQuery] Guid branchId, CancellationToken ct)
        => (await _sender.Send(new GetOpenShiftQuery(branchId), ct)).ToActionResult();

    [HttpPost("open")]
    [HasPermission(Permissions.ShiftsManage)]
    public async Task<IActionResult> Open([FromBody] OpenShiftRequest req, CancellationToken ct)
        => (await _sender.Send(new OpenShiftCommand(req.BranchId, req.OpeningCashRials), ct)).ToCreatedResult();

    [HttpPost("{id:guid}/close")]
    [HasPermission(Permissions.ShiftsManage)]
    public async Task<IActionResult> Close(Guid id, [FromBody] CloseShiftRequest req, CancellationToken ct)
        => (await _sender.Send(new CloseShiftCommand(id, req.ClosingCashRials, req.Notes), ct)).ToActionResult();
}
