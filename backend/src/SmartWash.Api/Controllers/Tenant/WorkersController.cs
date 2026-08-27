using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Workers;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/workers")]
public sealed class WorkersController : ControllerBase
{
    private readonly ISender _sender;
    private readonly IWebHostEnvironment _environment;
    public WorkersController(ISender sender, IWebHostEnvironment environment) { _sender = sender; _environment = environment; }

    public sealed record CreateWorkerRequest(Guid BranchId, string FullName, string Role, string? Phone, decimal CommissionRate);
    public sealed record UpdateWorkerRequest(string FullName, string Role, string? Phone, string? NationalId, decimal CommissionRate, string? AvatarUrl);
    public sealed record SetActiveRequest(bool IsActive);

    [HttpGet]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> List([FromQuery] Guid? branchId = null, [FromQuery] bool onlyActive = false, CancellationToken ct = default)
        => (await _sender.Send(new ListWorkersQuery(branchId, onlyActive), ct)).ToActionResult();

    [HttpPost("upload-photo")]
    [HasPermission(Permissions.WorkersManage)]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> UploadPhoto(IFormFile file, CancellationToken ct)
    {
        if (file.Length == 0 || file.Length > 5 * 1024 * 1024) return BadRequest("حجم عکس باید حداکثر ۵ مگابایت باشد.");
        var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
        if (!allowed.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase)) return BadRequest("فقط تصویر JPG، PNG یا WEBP قابل‌قبول است.");
        var folder = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), "uploads", "workers");
        Directory.CreateDirectory(folder);
        var extension = file.ContentType switch { "image/png" => ".png", "image/webp" => ".webp", _ => ".jpg" };
        var name = $"{Guid.NewGuid():N}{extension}";
        await using var stream = System.IO.File.Create(Path.Combine(folder, name));
        await file.CopyToAsync(stream, ct);
        return Ok(new { url = $"/uploads/workers/{name}" });
    }

    [HttpPost]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> Create([FromBody] CreateWorkerRequest req, CancellationToken ct)
        => (await _sender.Send(new CreateWorkerCommand(req.BranchId, req.FullName, req.Role, req.Phone, req.CommissionRate), ct)).ToCreatedResult();

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkerRequest req, CancellationToken ct)
        => (await _sender.Send(new UpdateWorkerCommand(id, req.FullName, req.Role, req.Phone, req.NationalId, req.CommissionRate, req.AvatarUrl), ct)).ToActionResult();

    [HttpPost("{id:guid}/active")]
    [HasPermission(Permissions.WorkersManage)]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] SetActiveRequest req, CancellationToken ct)
        => (await _sender.Send(new SetWorkerActiveCommand(id, req.IsActive), ct)).ToActionResult();
}
