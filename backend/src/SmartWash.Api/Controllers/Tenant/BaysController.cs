using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Bays;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/bays")]
public sealed class BaysController : ControllerBase
{
    private readonly ISender _sender;
    public BaysController(ISender sender) => _sender = sender;

    public sealed record CreateBayRequest(Guid BranchId, string Name, int Number);
    public sealed record UpdateBayRequest(string Name, int Number, string? Notes);
    public sealed record MaintenanceRequest(string? Notes);

    [HttpGet]
    [HasPermission(Permissions.BaysManage)]
    public async Task<IActionResult> List([FromQuery] Guid? branchId = null, [FromQuery] bool onlyActive = false, CancellationToken ct = default)
        => (await _sender.Send(new ListBaysQuery(branchId, onlyActive), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.BaysManage)]
    public async Task<IActionResult> Create([FromBody] CreateBayRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateBayCommand(req.BranchId, req.Name, req.Number), ct)).ToCreatedResult();

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.BaysManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBayRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateBayCommand(id, req.Name, req.Number, req.Notes), ct)).ToActionResult();

    [HttpPost("{id:guid}/maintenance")]
    [HasPermission(Permissions.BaysManage)]
    public async Task<IActionResult> Maintenance(Guid id, [FromBody] MaintenanceRequest req, CancellationToken ct)
        => (await _sender.Send(new SetBayMaintenanceCommand(id, req.Notes), ct)).ToActionResult();

    [HttpPost("{id:guid}/free")]
    [HasPermission(Permissions.BaysManage)]
    public async Task<IActionResult> Free(Guid id, CancellationToken ct)
        => (await _sender.Send(new FreeBayCommand(id), ct)).ToActionResult();
}
