using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Campaigns;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[RequireFeature("campaigns")]
[Route("api/campaigns")]
public sealed class CampaignsController : ControllerBase
{
    private readonly ISender _sender;
    public CampaignsController(ISender sender) => _sender = sender;

    public sealed record CreateCampaignRequest(string Name, CampaignType Type, CampaignTarget Target, string MessageTemplate,
        DateTime? ScheduledAtUtc, int? MinVisits, int? DaysSinceLastVisit, LoyaltyTier? MinTier);
    public sealed record ScheduleRequest(DateTime ScheduledAtUtc);

    [HttpGet]
    [HasPermission(Permissions.CampaignsManage)]
    public async Task<IActionResult> List([FromQuery] CampaignStatus? status = null, CancellationToken ct = default)
        => (await _sender.Send(new ListCampaignsQuery(status), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.CampaignsManage)]
    public async Task<IActionResult> Create([FromBody] CreateCampaignRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateCampaignCommand(req.Name, req.Type, req.Target, req.MessageTemplate,
            req.ScheduledAtUtc, req.MinVisits, req.DaysSinceLastVisit, req.MinTier), ct)).ToCreatedResult();

    [HttpPost("{id:guid}/schedule")]
    [HasPermission(Permissions.CampaignsManage)]
    public async Task<IActionResult> Schedule(Guid id, [FromBody] ScheduleRequest req, CancellationToken ct)
        => (await _sender.Send(new ScheduleCampaignCommand(id, req.ScheduledAtUtc), ct)).ToActionResult();

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.CampaignsManage)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
        => (await _sender.Send(new CancelCampaignCommand(id), ct)).ToActionResult();
}
