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
[Route("api/platform/subscriptions")]
public sealed class SubscriptionsController : ControllerBase
{
    private readonly ISender _sender;
    public SubscriptionsController(ISender sender) => _sender = sender;

    public sealed record ExtendBody(int Days);
    public sealed record SuspendBody(Guid TenantId, string Reason);
    public sealed record ReactivateBody(Guid TenantId);

    [HttpGet]
    [HasPermission(Permissions.SubscriptionsRead)]
    public async Task<IActionResult> List([FromQuery] SubscriptionStatus? status, [FromQuery] Guid? tenantId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
        => (await _sender.Send(new ListSubscriptionsQuery(status, tenantId, page, pageSize), ct)).ToActionResult();

    [HttpPost("{id:guid}/extend")]
    [HasPermission(Permissions.SubscriptionsWrite)]
    public async Task<IActionResult> Extend(Guid id, [FromBody] ExtendBody b, CancellationToken ct)
        => (await _sender.Send(new ExtendSubscriptionCommand(id, b.Days), ct)).ToActionResult();

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.SubscriptionsWrite)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
        => (await _sender.Send(new CancelSubscriptionAdminCommand(id), ct)).ToActionResult();

    [HttpPost("suspend-tenant")]
    [HasPermission(Permissions.SubscriptionsWrite)]
    public async Task<IActionResult> SuspendTenant([FromBody] SuspendBody b, CancellationToken ct)
        => (await _sender.Send(new SuspendTenantCommand(b.TenantId, b.Reason), ct)).ToActionResult();

    [HttpPost("reactivate-tenant")]
    [HasPermission(Permissions.SubscriptionsWrite)]
    public async Task<IActionResult> ReactivateTenant([FromBody] ReactivateBody b, CancellationToken ct)
        => (await _sender.Send(new ReactivateTenantCommand(b.TenantId), ct)).ToActionResult();
}
