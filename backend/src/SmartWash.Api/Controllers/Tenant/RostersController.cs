using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Rosters;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

/// <summary>برنامه‌ی شیفت پرسنل — چه کسی، چه ساعتی، در کدام جایگاه</summary>
[ApiController]
[Route("api/rosters")]
[Authorize]
public sealed class RostersController : ControllerBase
{
    private readonly ISender _sender;
    public RostersController(ISender sender) => _sender = sender;

    public sealed record CreateRosterRequest(Guid BranchId, DateOnly Date, string Name,
        TimeOnly StartsAt, TimeOnly EndsAt, string? Notes);
    public sealed record UpdateRosterRequest(string Name, TimeOnly StartsAt, TimeOnly EndsAt, string? Notes);
    public sealed record AssignRequest(StaffRole Role, Guid? WorkerId, Guid? UserId, Guid? BayId, string? Note);

    [HttpGet]
    [HasPermission(Permissions.ShiftsManage)]
    public async Task<IActionResult> List([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate,
        [FromQuery] Guid? branchId, CancellationToken ct = default)
        => (await _sender.Send(new ListRostersQuery(fromDate, toDate, branchId), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> Create([FromBody] CreateRosterRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateRosterCommand(req.BranchId, req.Date, req.Name,
            req.StartsAt, req.EndsAt, req.Notes), ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRosterRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateRosterCommand(id, req.Name, req.StartsAt, req.EndsAt, req.Notes), ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => (await _sender.Send(new DeleteRosterCommand(id), ct)).ToActionResult();

    [HttpPost("{id:guid}/assignments")]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRequest req, CancellationToken ct)
        => (await _sender.Send(new AssignToRosterCommand(id, req.Role, req.WorkerId, req.UserId, req.BayId, req.Note), ct)).ToActionResult();

    [HttpDelete("{id:guid}/assignments/{assignmentId:guid}")]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> Unassign(Guid id, Guid assignmentId, CancellationToken ct)
        => (await _sender.Send(new UnassignFromRosterCommand(id, assignmentId), ct)).ToActionResult();
}
