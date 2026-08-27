using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/files")]
public sealed class FilesController : ControllerBase
{
    private static readonly string[] AllowedImageTypes = { "image/jpeg", "image/png", "image/webp", "image/gif" };
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB

    private readonly IFileStorage _storage;
    private readonly ITenantContext _tenant;

    public FilesController(IFileStorage storage, ITenantContext tenant)
    {
        _storage = storage;
        _tenant = tenant;
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    // Do not add [FromForm] directly to IFormFile here: Swashbuckle 6.x rejects
    // that combination while generating OpenAPI. ASP.NET Core infers form binding
    // for IFormFile, so the runtime multipart contract remains unchanged.
    public async Task<IActionResult> Upload(IFormFile file, string? folder, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "File.Empty", message = "فایلی ارسال نشده است." });
        if (file.Length > MaxBytes)
            return BadRequest(new { code = "File.TooLarge", message = "حجم فایل از حد مجاز بیشتر است (حداکثر ۵ مگابایت)." });
        if (!AllowedImageTypes.Contains(file.ContentType))
            return BadRequest(new { code = "File.UnsupportedType", message = "فقط تصاویر JPEG/PNG/WEBP/GIF پذیرفته می‌شود." });

        var tenantId = _tenant.TenantId?.ToString("N") ?? "platform";
        var safeFolder = string.IsNullOrWhiteSpace(folder) ? "general" : System.Text.RegularExpressions.Regex.Replace(folder, "[^a-zA-Z0-9_-]", "");
        var fullFolder = $"tenants/{tenantId}/{safeFolder}";
        var ext = Path.GetExtension(file.FileName);
        var name = $"{Guid.NewGuid():N}{ext}";

        await using var stream = file.OpenReadStream();
        var rel = await _storage.SaveAsync(fullFolder, name, stream, file.ContentType, ct);
        var url = _storage.GetPublicUrl(rel);
        return Ok(new { path = rel, url, size = file.Length, contentType = file.ContentType });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] string path, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(path)) return BadRequest(new { code = "File.PathRequired", message = "مسیر فایل لازم است." });

        var tenantId = _tenant.TenantId?.ToString("N") ?? "platform";
        var normalized = path.Replace('\\', '/').TrimStart('/');

        // بررسی «Contains» کافی نبود: مسیری مثل «tenants/{tenantId}/../../../x»
        // هم آن رشته را در خود دارد و از فیلتر رد می‌شد. مسیر باید دقیقاً با پوشه‌ی
        // همین مستاجر شروع شود و هیچ پرشِ به بالا نداشته باشد.
        if (normalized.Split('/').Contains(".."))
            return Forbid();
        if (!normalized.StartsWith($"tenants/{tenantId}/", StringComparison.Ordinal))
            return Forbid();

        await _storage.DeleteAsync(normalized, ct);
        return Ok(new { ok = true });
    }
}
