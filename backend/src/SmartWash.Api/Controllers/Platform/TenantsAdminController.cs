using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Platform;
using SmartWash.Application.Modules.Tenants.List;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Constants;
using SmartWash.Shared.Pagination;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Platform;

[ApiController]
[Authorize]
[Route("api/platform/tenants")]
public sealed class TenantsAdminController : ControllerBase
{
    private readonly ISender _sender;
    public TenantsAdminController(ISender sender) => _sender = sender;

    [HttpGet]
    [HasPermission(Permissions.TenantsRead)]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = AppConstants.DefaultPageSize,
        [FromQuery] string? search = null,
        [FromQuery] TenantStatus? status = null,
        CancellationToken ct = default)
    {
        var result = await _sender.Send(new ListTenantsQuery(
            new PageRequest { Page = page, PageSize = pageSize, Search = search }, status), ct);
        return result.IsSuccess ? Ok(result.Value) : Problem(statusCode: 400, title: result.Error.Code, detail: result.Error.Message);
    }

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.TenantsRead)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => (await _sender.Send(new GetTenantDetailQuery(id), ct)).ToActionResult();

    public sealed record AssignPlanBody(Guid PlanId, BillingCycle Cycle, bool ActivateImmediately);

    [HttpPost("{id:guid}/assign-plan")]
    [HasPermission(Permissions.SubscriptionsWrite)]
    public async Task<IActionResult> AssignPlan(Guid id, [FromBody] AssignPlanBody b, CancellationToken ct)
        => (await _sender.Send(new AssignPlanCommand(id, b.PlanId, b.Cycle, b.ActivateImmediately), ct)).ToActionResult();
}
