using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Audit;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Platform;

/// <summary>One job, with just enough to tell whether it is still doing its work.</summary>
public sealed record CronJobHealthDto(
    string JobName,
    DateTime? LastRunAtUtc,
    DateTime? LastSuccessAtUtc,
    CronJobStatus? LastStatus,
    int? LastItemsProcessed,
    string? LastError,
    int RunsLast24h,
    int FailuresLast24h,
    /// <summary>Hours since the last successful run; null when it has never succeeded.</summary>
    double? HoursSinceLastSuccess);

/// <summary>
/// Every /api/cron/* endpoint records a CronJobRun, but nothing ever read those rows back,
/// so a scheduler that quietly stopped calling them looked exactly like a scheduler that was
/// working: both produce silence. On shared hosting the in-process scheduler is off and the
/// panel is the only thing triggering this work, which makes that blind spot expensive —
/// subscriptions simply stop renewing and no error is raised anywhere.
/// </summary>
public sealed record GetCronHealthQuery : IRequest<Result<IReadOnlyList<CronJobHealthDto>>>;

public sealed class GetCronHealthHandler : IRequestHandler<GetCronHealthQuery, Result<IReadOnlyList<CronJobHealthDto>>>
{
    private readonly IAppDbContext _db;
    public GetCronHealthHandler(IAppDbContext db) => _db = db;

    public async Task<Result<IReadOnlyList<CronJobHealthDto>>> Handle(GetCronHealthQuery q, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var since = now.AddHours(-24);

        // Only the recent window is read: the table grows by one row per job per run and the
        // question here is "is it running now", not "what did it ever do".
        var recent = await _db.CronJobRuns.AsNoTracking()
            .Where(r => r.StartedAtUtc >= since.AddDays(-30))
            .ToListAsync(ct);

        var report = recent
            .GroupBy(r => r.JobName)
            .Select(g =>
            {
                var last = g.OrderByDescending(r => r.StartedAtUtc).First();
                var lastSuccess = g.Where(r => r.Status == CronJobStatus.Succeeded)
                                   .OrderByDescending(r => r.StartedAtUtc)
                                   .FirstOrDefault();
                return new CronJobHealthDto(
                    JobName: g.Key,
                    LastRunAtUtc: last.StartedAtUtc,
                    LastSuccessAtUtc: lastSuccess?.StartedAtUtc,
                    LastStatus: last.Status,
                    LastItemsProcessed: last.ItemsProcessed,
                    LastError: last.ErrorMessage,
                    RunsLast24h: g.Count(r => r.StartedAtUtc >= since),
                    FailuresLast24h: g.Count(r => r.StartedAtUtc >= since && r.Status == CronJobStatus.Failed),
                    HoursSinceLastSuccess: lastSuccess is null
                        ? null
                        : Math.Round((now - lastSuccess.StartedAtUtc).TotalHours, 1));
            })
            .OrderBy(d => d.JobName)
            .ToList();

        return Result.Success<IReadOnlyList<CronJobHealthDto>>(report);
    }
}
