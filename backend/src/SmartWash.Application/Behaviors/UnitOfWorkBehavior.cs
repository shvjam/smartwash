using System.Text;
using SmartWash.Application.Abstractions.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace SmartWash.Application.Behaviors;

public interface ITransactionalRequest { }

public sealed class UnitOfWorkBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IAppDbContext _db;
    private readonly ILogger<UnitOfWorkBehavior<TRequest, TResponse>> _logger;

    public UnitOfWorkBehavior(IAppDbContext db, ILogger<UnitOfWorkBehavior<TRequest, TResponse>> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        if (request is not ITransactionalRequest) return await next();

        // ExecutionStrategy is required when SQL Server has EnableRetryOnFailure configured.
        // Without this wrapper, calling BeginTransaction directly throws:
        // "SqlServerRetryingExecutionStrategy does not support user-initiated transactions."
        var strategy = _db.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            // Optimistic-concurrency conflicts (e.g. two services added to the same order
            // in quick succession, each racing on the aggregate RowVersion) are NOT transient
            // SQL faults, so the ExecutionStrategy above never retries them. We retry here
            // ourselves: clear the tracker, re-run the handler against fresh data, save again.
            const int maxAttempts = 5;
            for (var attempt = 1; ; attempt++)
            {
                // On every attempt the scoped DbContext may still track entities from the
                // previous try (with now-stale RowVersion values). Re-read everything fresh.
                _db.ClearChangeTracker();

                await using var tx = await _db.BeginTransactionAsync(ct);
                try
                {
                    var response = await next();
                    await tx.CommitAsync(ct);
                    return response;
                }
                catch (DbUpdateConcurrencyException ex) when (attempt < maxAttempts)
                {
                    await tx.RollbackAsync(ct);
                    _logger.LogWarning("Concurrency conflict on {Request} (attempt {Attempt}/{Max}). {Details}",
                        typeof(TRequest).Name, attempt, maxAttempts, DescribeConflict(ex));
                    await Task.Delay(25 * attempt, ct);
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    await tx.RollbackAsync(ct);
                    // پنج تلاش پشت‌سرهم شکست خورده؛ این دیگر رقابتِ گذرا نیست.
                    // معمولاً یعنی توکنِ همزمانی هیچ‌وقت با دیتابیس تطبیق نمی‌کند
                    // (مثلاً ستون RowVersion در دیتابیس از نوع rowversion نیست و NULL می‌ماند).
                    _logger.LogError(ex, "Persistent concurrency failure on {Request} after {Max} attempts. {Details}",
                        typeof(TRequest).Name, maxAttempts, DescribeConflict(ex));
                    throw;
                }
                catch
                {
                    await tx.RollbackAsync(ct);
                    throw;
                }
            }
        });
    }

    /// <summary>
    /// می‌گوید دقیقاً کدام موجودیت، با کدام کلید و چه وضعیتی باعث تعارض شده و
    /// مقدار توکنِ همزمانی در حافظه چه بوده. بدون این، پیام استاندارد EF
    /// («expected 1 row, affected 0») هیچ سرنخی نمی‌دهد.
    /// </summary>
    private static string DescribeConflict(DbUpdateConcurrencyException ex)
    {
        if (ex.Entries.Count == 0) return "No entries reported by EF.";

        var sb = new StringBuilder();
        foreach (var entry in ex.Entries)
        {
            var key = string.Join(",", entry.Metadata.FindPrimaryKey()?.Properties
                .Select(p => $"{p.Name}={entry.Property(p.Name).CurrentValue}") ?? Array.Empty<string>());

            sb.Append($"[{entry.Metadata.ClrType.Name} {key} state={entry.State}");

            foreach (var token in entry.Properties.Where(p => p.Metadata.IsConcurrencyToken))
            {
                sb.Append($" {token.Metadata.Name}: original={Describe(token.OriginalValue)}");
                sb.Append($" current={Describe(token.CurrentValue)}");
            }

            sb.Append("] ");
        }

        return sb.ToString().TrimEnd();

        static string Describe(object? value) => value switch
        {
            null => "NULL",
            byte[] bytes when bytes.Length == 0 => "EMPTY",
            byte[] bytes => Convert.ToHexString(bytes),
            _ => value.ToString() ?? "NULL"
        };
    }
}
// resync-marker
