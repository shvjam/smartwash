using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Billing;
using SmartWash.Domain.Billing;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/billing")]
public sealed class BillingController : ControllerBase
{
    private readonly ISender _sender;
    public BillingController(ISender sender) => _sender = sender;

    public sealed record SubscribeRequest(Guid PlanId, BillingCycle Cycle);
    public sealed record RequestPaymentBody(Guid InvoiceId, PaymentGateway Gateway, string CallbackUrl);
    public sealed record VerifyPaymentBody(Guid PaymentId, string Authority);

    [HttpGet("subscription")]
    [HasPermission(Permissions.BillingManage)]
    public async Task<IActionResult> Subscription(CancellationToken ct)
        => (await _sender.Send(new GetCurrentSubscriptionQuery(), ct)).ToActionResult();

    [HttpGet("invoices")]
    [HasPermission(Permissions.BillingManage)]
    public async Task<IActionResult> Invoices([FromQuery] InvoiceStatus? status = null, CancellationToken ct = default)
        => (await _sender.Send(new ListInvoicesQuery(status), ct)).ToActionResult();

    [HttpPost("subscribe")]
    [HasPermission(Permissions.BillingManage)]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest req, CancellationToken ct)
        => (await _sender.Send(new SubscribeCommand(req.PlanId, req.Cycle), ct)).ToCreatedResult();

    [HttpPost("payments/request")]
    [HasPermission(Permissions.BillingManage)]
    public async Task<IActionResult> RequestPayment([FromBody] RequestPaymentBody req, CancellationToken ct)
        => (await _sender.Send(new RequestPaymentCommand(req.InvoiceId, req.Gateway, req.CallbackUrl), ct)).ToActionResult();

    [HttpPost("payments/verify")]
    [HasPermission(Permissions.BillingManage)]
    public async Task<IActionResult> VerifyPayment([FromBody] VerifyPaymentBody req, CancellationToken ct)
        => (await _sender.Send(new VerifyPaymentCommand(req.PaymentId, req.Authority), ct)).ToActionResult();

    [HttpPost("subscription/{id:guid}/cancel")]
    [HasPermission(Permissions.BillingManage)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
        => (await _sender.Send(new CancelSubscriptionCommand(id), ct)).ToActionResult();
}
