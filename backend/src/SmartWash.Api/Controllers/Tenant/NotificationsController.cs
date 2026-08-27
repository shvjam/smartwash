using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Notifications;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/notifications")]
public sealed class NotificationsController : ControllerBase
{
    private readonly ISender _sender;
    public NotificationsController(ISender sender) => _sender = sender;

    [HttpGet]
    [HasPermission(Permissions.NotificationsRead)]
    public async Task<IActionResult> List([FromQuery] bool? unreadOnly = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = AppConstants.DefaultPageSize, CancellationToken ct = default)
        => (await _sender.Send(new ListNotificationsQuery(unreadOnly, page, pageSize), ct)).ToActionResult();

    [HttpPost("{id:guid}/read")]
    [HasPermission(Permissions.NotificationsRead)]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
        => (await _sender.Send(new MarkNotificationReadCommand(id), ct)).ToActionResult();

    [HttpPost("read-all")]
    [HasPermission(Permissions.NotificationsRead)]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
        => (await _sender.Send(new MarkAllReadCommand(), ct)).ToActionResult();
}
