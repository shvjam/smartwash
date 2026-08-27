using SmartWash.Application.Abstractions.Caching;
using Microsoft.Extensions.Caching.Memory;

namespace SmartWash.Infrastructure.Caching;

public sealed class MemoryAppCache : IAppCache
{
    private readonly IMemoryCache _cache;

    public MemoryAppCache(IMemoryCache cache) => _cache = cache;

    public Task<T?> GetAsync<T>(string key, CancellationToken ct = default) where T : class
    {
        _cache.TryGetValue(key, out T? value);
        return Task.FromResult(value);
    }

    public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default) where T : class
    {
        _cache.Set(key, value, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl });
        return Task.CompletedTask;
    }

    public Task RemoveAsync(string key, CancellationToken ct = default)
    {
        _cache.Remove(key);
        return Task.CompletedTask;
    }

    public async Task<T> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl, CancellationToken ct = default) where T : class
    {
        if (_cache.TryGetValue(key, out T? cached) && cached is not null) return cached;
        var value = await factory(ct);
        _cache.Set(key, value, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl });
        return value;
    }
}
// resync-marker
