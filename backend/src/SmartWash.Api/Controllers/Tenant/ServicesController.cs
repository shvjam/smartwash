using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Services;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/services")]
public sealed class ServicesController : ControllerBase
{
    private readonly ISender _sender;
    public ServicesController(ISender sender) => _sender = sender;

    public sealed record CreateServiceRequest(string Name, string? Description, ServiceCategory Category, long PriceRials, int DurationMinutes, decimal WorkerCommissionRate, BayType? RequiredBayType = null, bool IsOptional = false);
    public sealed record UpdateServiceRequest(string Name, string? Description, ServiceCategory Category, long PriceRials, int DurationMinutes, decimal WorkerCommissionRate, int SortOrder, string? IconKey, BayType? RequiredBayType = null, bool? IsOptional = null);
    public sealed record SetActiveRequest(bool IsActive);

    [HttpGet]
    [HasPermission(Permissions.ServicesManage)]
    public async Task<IActionResult> List([FromQuery] bool onlyActive = false, [FromQuery] ServiceCategory? category = null, CancellationToken ct = default)
        => (await _sender.Send(new ListServicesQuery(onlyActive, category), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.ServicesManage)]
    public async Task<IActionResult> Create([FromBody] CreateServiceRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateServiceCommand(req.Name, req.Description, req.Category, req.PriceRials, req.DurationMinutes, req.WorkerCommissionRate, req.RequiredBayType, req.IsOptional), ct)).ToCreatedResult();

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.ServicesManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateServiceRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateServiceCommand(id, req.Name, req.Description, req.Category, req.PriceRials, req.DurationMinutes, req.WorkerCommissionRate, req.SortOrder, req.IconKey, req.RequiredBayType, req.IsOptional), ct)).ToActionResult();

    [HttpPost("{id:guid}/active")]
    [HasPermission(Permissions.ServicesManage)]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] SetActiveRequest req, CancellationToken ct)
        => (await _sender.Send(new SetServiceActiveCommand(id, req.IsActive), ct)).ToActionResult();
}
