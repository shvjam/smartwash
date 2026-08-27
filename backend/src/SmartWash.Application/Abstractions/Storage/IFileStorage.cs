namespace SmartWash.Application.Abstractions.Storage;

public interface IFileStorage
{
    Task<string> SaveAsync(string folder, string fileName, Stream content, string contentType, CancellationToken ct = default);
    Task<Stream?> GetAsync(string relativePath, CancellationToken ct = default);
    Task DeleteAsync(string relativePath, CancellationToken ct = default);
    Task<bool> ExistsAsync(string relativePath, CancellationToken ct = default);
    string GetPublicUrl(string relativePath);
}
// resync-marker
