using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Platform;
using SmartWash.Domain.Billing;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Platform;

[ApiController]
[Authorize]
[Route("api/platform/plans")]
public sealed class PlansController : ControllerBase
{
    private readonly ISender _sender;
    public PlansController(ISender sender) => _sender = sender;

    public sealed record CreatePlanBody(string Code, string DisplayName, string? Description, PlanBillingModel BillingModel,
        long SetupFeeRials, long MonthlyPriceRials, long YearlyPriceRials, long PerCarPriceRials,
        int SortOrder, bool IsPublic, IReadOnlyList<PlanFeatureDto>? Features);
    public sealed record UpdatePlanBody(string DisplayName, string? Description, long SetupFeeRials, long MonthlyPriceRials,
        long YearlyPriceRials, long PerCarPriceRials, int SortOrder, bool IsPublic, IReadOnlyList<PlanFeatureDto>? Features);
    public sealed record ActiveBody(bool IsActive);

    [HttpGet]
    [HasPermission(Permissions.PlansRead)]
    public async Task<IActionResult> List([FromQuery] bool? onlyActive, [FromQuery] bool? onlyPublic, CancellationToken ct)
        => (await _sender.Send(new ListPlansQuery(onlyActive, onlyPublic), ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.PlansRead)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => (await _sender.Send(new GetPlanQuery(id), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.PlansWrite)]
    public async Task<IActionResult> Create([FromBody] CreatePlanBody b, CancellationToken ct)
        => (await _sender.Send(new CreatePlanCommand(b.Code, b.DisplayName, b.Description, b.BillingModel, b.SetupFeeRials,
            b.MonthlyPriceRials, b.YearlyPriceRials, b.PerCarPriceRials, b.SortOrder, b.IsPublic, b.Features), ct)).ToCreatedResult();

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.PlansWrite)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePlanBody b, CancellationToken ct)
        => (await _sender.Send(new UpdatePlanCommand(id, b.DisplayName, b.Description, b.SetupFeeRials, b.MonthlyPriceRials,
            b.YearlyPriceRials, b.PerCarPriceRials, b.SortOrder, b.IsPublic, b.Features), ct)).ToActionResult();

    [HttpPost("{id:guid}/active")]
    [HasPermission(Permissions.PlansWrite)]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] ActiveBody b, CancellationToken ct)
        => (await _sender.Send(new SetPlanActiveCommand(id, b.IsActive), ct)).ToActionResult();
}
