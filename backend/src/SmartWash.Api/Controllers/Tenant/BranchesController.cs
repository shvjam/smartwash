using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Branches;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/branches")]
public sealed class BranchesController : ControllerBase
{
    private readonly ISender _sender;
    public BranchesController(ISender sender) => _sender = sender;

    public sealed record CreateBranchRequest(string Name, string? Address, string? Phone, bool IsDefault);
    public sealed record UpdateBranchRequest(string Name, string? Address, string? Phone, string? Latitude, string? Longitude);
    public sealed record SetActiveRequest(bool IsActive);

    [HttpGet]
    [HasPermission(Permissions.BranchesManage)]
    public async Task<IActionResult> List([FromQuery] bool onlyActive = false, CancellationToken ct = default)
        => (await _sender.Send(new ListBranchesQuery(onlyActive), ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.BranchesManage)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => (await _sender.Send(new GetBranchQuery(id), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.BranchesManage)]
    public async Task<IActionResult> Create([FromBody] CreateBranchRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateBranchCommand(req.Name, req.Address, req.Phone, req.IsDefault), ct)).ToCreatedResult();

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.BranchesManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBranchRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateBranchCommand(id, req.Name, req.Address, req.Phone, req.Latitude, req.Longitude), ct)).ToActionResult();

    [HttpPost("{id:guid}/active")]
    [HasPermission(Permissions.BranchesManage)]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] SetActiveRequest req, CancellationToken ct)
        => (await _sender.Send(new SetBranchActiveCommand(id, req.IsActive), ct)).ToActionResult();

    [HttpPost("{id:guid}/default")]
    [HasPermission(Permissions.BranchesManage)]
    public async Task<IActionResult> SetDefault(Guid id, CancellationToken ct)
        => (await _sender.Send(new SetDefaultBranchCommand(id), ct)).ToActionResult();
}
