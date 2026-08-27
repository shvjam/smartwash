using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Platform;
using SmartWash.Application.Modules.Support;
using SmartWash.Domain.Support;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Platform;

[ApiController]
[Authorize]
[Route("api/platform/tickets")]
public sealed class TicketsAdminController : ControllerBase
{
    private readonly ISender _sender;
    public TicketsAdminController(ISender sender) => _sender = sender;

    public sealed record AttachmentPayload(string FileName, string Path, string Url, string ContentType, long SizeBytes);
    public sealed record ReplyRequest(string Body, bool IsInternalNote, AttachmentPayload[]? Attachments);
    public sealed record StatusRequest(TicketStatus Status, string? Note);
    public sealed record PriorityRequest(TicketPriority Priority);
    public sealed record CategoryRequest(TicketCategory Category);
    public sealed record AssignRequest(Guid? AssignedToUserId);

    private static IReadOnlyList<TicketAttachmentInput>? Map(AttachmentPayload[]? items) =>
        items?.Select(a => new TicketAttachmentInput(a.FileName, a.Path, a.Url, a.ContentType, a.SizeBytes)).ToArray();

    [HttpGet]
    [HasPermission(Permissions.SupportRead)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? tenantId,
        [FromQuery] TicketStatus? status,
        [FromQuery] TicketCategory? category,
        [FromQuery] TicketPriority? priority,
        [FromQuery] Guid? assignedToUserId,
        [FromQuery] bool unassignedOnly = false,
        [FromQuery] bool openOnly = false,
        [FromQuery] bool slaBreachedOnly = false,
        [FromQuery] bool unansweredOnly = false,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
        => (await _sender.Send(new ListAllTicketsQuery(tenantId, status, category, priority, assignedToUserId,
            unassignedOnly, openOnly, slaBreachedOnly, unansweredOnly, search, page, pageSize), ct)).ToActionResult();

    [HttpGet("stats")]
    [HasPermission(Permissions.SupportRead)]
    public async Task<IActionResult> Stats([FromQuery] Guid? tenantId, [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc, CancellationToken ct = default)
        => (await _sender.Send(new GetTicketDeskStatsQuery(tenantId, fromUtc, toUtc), ct)).ToActionResult();

    [HttpGet("agents")]
    [HasPermission(Permissions.SupportRead)]
    public async Task<IActionResult> Agents(CancellationToken ct)
        => (await _sender.Send(new ListSupportAgentsQuery(), ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.SupportRead)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => (await _sender.Send(new GetTicketAdminQuery(id), ct)).ToActionResult();

    [HttpPost("{id:guid}/reply")]
    [HasPermission(Permissions.SupportWrite)]
    public async Task<IActionResult> Reply(Guid id, [FromBody] ReplyRequest req, CancellationToken ct)
        => (await _sender.Send(new ReplyToTicketCommand(id, req.Body, req.IsInternalNote, Map(req.Attachments)), ct)).ToActionResult();

    [HttpPost("{id:guid}/status")]
    [HasPermission(Permissions.SupportWrite)]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] StatusRequest req, CancellationToken ct)
        => (await _sender.Send(new ChangeTicketStatusCommand(id, req.Status, req.Note), ct)).ToActionResult();

    [HttpPost("{id:guid}/priority")]
    [HasPermission(Permissions.SupportWrite)]
    public async Task<IActionResult> ChangePriority(Guid id, [FromBody] PriorityRequest req, CancellationToken ct)
        => (await _sender.Send(new ChangeTicketPriorityCommand(id, req.Priority), ct)).ToActionResult();

    [HttpPost("{id:guid}/category")]
    [HasPermission(Permissions.SupportWrite)]
    public async Task<IActionResult> ChangeCategory(Guid id, [FromBody] CategoryRequest req, CancellationToken ct)
        => (await _sender.Send(new ChangeTicketCategoryCommand(id, req.Category), ct)).ToActionResult();

    [HttpPost("{id:guid}/assign")]
    [HasPermission(Permissions.SupportWrite)]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRequest req, CancellationToken ct)
        => (await _sender.Send(new AssignTicketCommand(id, req.AssignedToUserId), ct)).ToActionResult();
}
