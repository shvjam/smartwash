using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Storage;
using SmartWash.Application.Modules.Support;
using SmartWash.Domain.Support;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/tickets")]
public sealed class TicketsController : ControllerBase
{
    private static readonly string[] AllowedAttachmentTypes =
    [
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "application/pdf", "text/plain",
        "application/zip", "application/x-zip-compressed",
    ];
    private const long MaxAttachmentBytes = 8 * 1024 * 1024; // 8 MB

    private readonly ISender _sender;
    private readonly IFileStorage _storage;
    private readonly ITenantContext _tenant;

    public TicketsController(ISender sender, IFileStorage storage, ITenantContext tenant)
    { _sender = sender; _storage = storage; _tenant = tenant; }

    public sealed record AttachmentPayload(string FileName, string Path, string Url, string ContentType, long SizeBytes);

    public sealed record CreateTicketRequest(string Subject, string Description, TicketCategory Category,
        TicketPriority Priority, Guid? BranchId, string? RelatedEntityType, Guid? RelatedEntityId,
        AttachmentPayload[]? Attachments);

    public sealed record AddMessageRequest(string Body, AttachmentPayload[]? Attachments);
    public sealed record CloseRequest(string? Reason);
    public sealed record ReopenRequest(string? Reason);
    public sealed record RateRequest(int Rating, string? Comment);

    private static IReadOnlyList<TicketAttachmentInput>? Map(AttachmentPayload[]? items) =>
        items?.Select(a => new TicketAttachmentInput(a.FileName, a.Path, a.Url, a.ContentType, a.SizeBytes)).ToArray();

    [HttpGet]
    [HasPermission(Permissions.SupportManage)]
    public async Task<IActionResult> List(
        [FromQuery] TicketStatus? status,
        [FromQuery] TicketCategory? category,
        [FromQuery] TicketPriority? priority,
        [FromQuery] bool openOnly = false,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
        => (await _sender.Send(new ListMyTicketsQuery(status, category, priority, openOnly, search, page, pageSize), ct)).ToActionResult();

    [HttpGet("summary")]
    [HasPermission(Permissions.SupportManage)]
    public async Task<IActionResult> Summary(CancellationToken ct)
        => (await _sender.Send(new MyTicketsSummaryQuery(), ct)).ToActionResult();

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.SupportManage)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => (await _sender.Send(new GetMyTicketQuery(id), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.SupportManage)]
    public async Task<IActionResult> Create([FromBody] CreateTicketRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateTicketCommand(req.Subject, req.Description, req.Category, req.Priority,
            req.BranchId, req.RelatedEntityType, req.RelatedEntityId, Map(req.Attachments)), ct)).ToCreatedResult();

    [HttpPost("{id:guid}/messages")]
    [HasPermission(Permissions.SupportManage)]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] AddMessageRequest req, CancellationToken ct)
        => (await _sender.Send(new AddMyTicketMessageCommand(id, req.Body, Map(req.Attachments)), ct)).ToActionResult();

    [HttpPost("{id:guid}/close")]
    [HasPermission(Permissions.SupportManage)]
    public async Task<IActionResult> Close(Guid id, [FromBody] CloseRequest? req, CancellationToken ct)
        => (await _sender.Send(new CloseMyTicketCommand(id, req?.Reason), ct)).ToActionResult();

    [HttpPost("{id:guid}/reopen")]
    [HasPermission(Permissions.SupportManage)]
    public async Task<IActionResult> Reopen(Guid id, [FromBody] ReopenRequest? req, CancellationToken ct)
        => (await _sender.Send(new ReopenMyTicketCommand(id, req?.Reason), ct)).ToActionResult();

    [HttpPost("{id:guid}/rate")]
    [HasPermission(Permissions.SupportManage)]
    public async Task<IActionResult> Rate(Guid id, [FromBody] RateRequest req, CancellationToken ct)
        => (await _sender.Send(new RateMyTicketCommand(id, req.Rating, req.Comment), ct)).ToActionResult();

    /// <summary>
    /// آپلود پیوست تیکت. برخلاف /api/files که فقط تصویر می‌پذیرد، اینجا PDF و متن هم مجاز است.
    /// خروجی همان شکلی است که در آرایهٔ attachments هنگام ایجاد تیکت یا ارسال پیام فرستاده می‌شود.
    /// </summary>
    [HttpPost("attachments")]
    [HasPermission(Permissions.SupportManage)]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> UploadAttachment([FromForm] IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "File.Empty", message = "فایلی ارسال نشده است." });
        if (file.Length > MaxAttachmentBytes)
            return BadRequest(new { code = "File.TooLarge", message = "حجم فایل از حد مجاز بیشتر است (حداکثر ۸ مگابایت)." });
        if (!AllowedAttachmentTypes.Contains(file.ContentType))
            return BadRequest(new { code = "File.UnsupportedType", message = "فقط تصویر، PDF، متن یا فایل ZIP پذیرفته می‌شود." });

        var tenantId = _tenant.TenantId?.ToString("N") ?? "platform";
        var ext = Path.GetExtension(file.FileName);
        var name = $"{Guid.NewGuid():N}{ext}";

        await using var stream = file.OpenReadStream();
        var rel = await _storage.SaveAsync($"tenants/{tenantId}/tickets", name, stream, file.ContentType, ct);
        return Ok(new
        {
            fileName = file.FileName,
            path = rel,
            url = _storage.GetPublicUrl(rel),
            contentType = file.ContentType,
            sizeBytes = file.Length,
        });
    }
}
