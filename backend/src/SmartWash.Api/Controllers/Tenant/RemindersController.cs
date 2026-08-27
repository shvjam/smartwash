using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Reminders;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/reminders")]
public sealed class RemindersController : ControllerBase
{
    private readonly ISender _sender;
    public RemindersController(ISender sender) => _sender = sender;

    [HttpGet]
    [HasPermission(Permissions.CustomersRead)]
    public async Task<IActionResult> List(
        [FromQuery] ReminderStatus? status = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = AppConstants.DefaultPageSize,
        CancellationToken ct = default)
        => (await _sender.Send(new ListRemindersQuery(status, customerId, page, pageSize), ct)).ToActionResult();

    public sealed record CreateReminderBody(Guid CustomerId, Guid? VehicleId, string Title, DateTime DueAtUtc, ReminderType Type);

    [HttpPost]
    [HasPermission(Permissions.CustomersManage)]
    public async Task<IActionResult> Create([FromBody] CreateReminderBody b, CancellationToken ct)
        => (await _sender.Send(new CreateReminderCommand(b.CustomerId, b.VehicleId, b.Title, b.DueAtUtc, b.Type), ct)).ToActionResult();

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.CustomersManage)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
        => (await _sender.Send(new CancelReminderCommand(id), ct)).ToActionResult();

    /// <summary>ارسال فوری پیامک یادآور به مشتری</summary>
    [HttpPost("{id:guid}/send")]
    [HasPermission(Permissions.CustomersManage)]
    public async Task<IActionResult> SendNow(Guid id, CancellationToken ct)
        => (await _sender.Send(new SendReminderNowCommand(id), ct)).ToActionResult();
}
