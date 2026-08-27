using SmartWash.Application.Abstractions.Storage;
using Microsoft.Extensions.Options;

namespace SmartWash.Infrastructure.Storage;

public sealed class LocalFileStorageOptions
{
    public const string SectionName = "Storage:Local";
    public string RootPath { get; init; } = "App_Data/uploads";
    public string PublicBaseUrl { get; init; } = "/uploads";
}

public sealed class LocalFileStorage : IFileStorage
{
    private readonly LocalFileStorageOptions _options;

    public LocalFileStorage(IOptions<LocalFileStorageOptions> options)
    {
        _options = options.Value;
        Directory.CreateDirectory(_options.RootPath);
    }

    public async Task<string> SaveAsync(string folder, string fileName, Stream content, string contentType, CancellationToken ct = default)
    {
        var safeFolder = Sanitize(folder);
        var safeName = $"{Guid.NewGuid():N}_{Sanitize(fileName)}";
        var dir = Path.Combine(_options.RootPath, safeFolder);
        Directory.CreateDirectory(dir);
        var fullPath = Path.Combine(dir, safeName);
        await using var fs = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(fs, ct);
        return Path.Combine(safeFolder, safeName).Replace("\\", "/");
    }

    public Task<Stream?> GetAsync(string relativePath, CancellationToken ct = default)
    {
        if (!TryResolve(relativePath, out var fullPath) || !File.Exists(fullPath))
            return Task.FromResult<Stream?>(null);
        return Task.FromResult<Stream?>(File.OpenRead(fullPath));
    }

    public Task DeleteAsync(string relativePath, CancellationToken ct = default)
    {
        if (TryResolve(relativePath, out var fullPath) && File.Exists(fullPath))
            File.Delete(fullPath);
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string relativePath, CancellationToken ct = default)
    {
        return Task.FromResult(TryResolve(relativePath, out var fullPath) && File.Exists(fullPath));
    }

    /// <summary>
    /// مسیر نسبی را به مسیر مطلق تبدیل می‌کند و تضمین می‌کند که از پوشه‌ی ریشه بیرون نزند.
    /// بدون این بررسی، مسیری مثل «tenants/x/../../../appsettings.json» پس از
    /// Path.Combine به فایل‌های خودِ برنامه می‌رسید و حذف/خواندنِ آن‌ها ممکن می‌شد.
    /// </summary>
    private bool TryResolve(string relativePath, out string fullPath)
    {
        fullPath = string.Empty;
        if (string.IsNullOrWhiteSpace(relativePath)) return false;
        if (Path.IsPathRooted(relativePath)) return false;

        var root = Path.GetFullPath(_options.RootPath);
        var candidate = Path.GetFullPath(Path.Combine(root, relativePath));

        // مقایسه باید با جداکنندهٔ انتهایی انجام شود تا «…/uploads-evil» به‌اشتباه
        // زیرمجموعه‌ی «…/uploads» شمرده نشود.
        var rootWithSeparator = root.EndsWith(Path.DirectorySeparatorChar)
            ? root
            : root + Path.DirectorySeparatorChar;

        if (!candidate.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase)) return false;

        fullPath = candidate;
        return true;
    }

    public string GetPublicUrl(string relativePath) =>
        $"{_options.PublicBaseUrl.TrimEnd('/')}/{relativePath.TrimStart('/')}";

    private static string Sanitize(string input)
    {
        foreach (var c in Path.GetInvalidFileNameChars().Concat(new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }))
            input = input.Replace(c, '_');
        return input;
    }
}
// resync-marker
