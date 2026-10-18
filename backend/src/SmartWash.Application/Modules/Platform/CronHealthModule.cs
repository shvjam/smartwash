using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Audit;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Platform;

/// <summary>A job the system expects to run, and how often.</summary>
public sealed record CronJobExpectation(string Name, int? EveryMinutes, TimeOnly? DailyAtUtc);

/// <summary>One job, with just enough to tell whether it is still doing its work.</summary>
public sealed record CronJobHealthDto(
    string JobName,
    int? EveryMinutes,
    TimeOnly? DailyAtUtc,
    DateTime? LastRunAtUtc,
    DateTime? LastSuccessAtUtc,
    CronJobStatus? LastStatus,
    int? LastItemsProcessed,
    string? LastError,
    int RunsLast24h,
    int FailuresLast24h,
    /// <summary>Hours since the last successful run; null when it has never succeeded.</summary>
    double? HoursSinceLastSuccess,
    /// <summary>It has not succeeded within the time its schedule promises.</summary>
    bool IsLate);

/// <summary>
/// Every /api/cron/* endpoint records a CronJobRun, but nothing ever read those rows back,
/// so a scheduler that quietly stopped calling them looked exactly like a scheduler that was
/// working: both produce silence.
///
/// The report is built from the jobs the system expects, not from the runs it happens to
/// find. Listing only jobs with runs on record hid the worst case of all — a job that has
/// never run once, because the scheduler was never set up for it — behind a table that
/// simply did not mention it.
/// </summary>
public sealed record GetCronHealthQuery(IReadOnlyList<CronJobExpectation> Expected)
    : IRequest<Result<IReadOnlyList<CronJobHealthDto>>>;

public sealed class GetCronHealthHandler : IRequestHandler<GetCronHealthQuery, Result<IReadOnlyList<CronJobHealthDto>>>
{
    private readonly IAppDbContext _db;
    public GetCronHealthHandler(IAppDbContext db) => _db = db;

    public async Task<Result<IReadOnlyList<CronJobHealthDto>>> Handle(GetCronHealthQuery q, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var since = now.AddHours(-24);

        // Only a recent window is read: the table grows by one row per job per run, and the
        // question here is "is it running now", not "what did it ever do".
        var recent = await _db.CronJobRuns.AsNoTracking()
            .Where(r => r.StartedAtUtc >= now.AddDays(-30))
            .ToListAsync(ct);
        var byJob = recent.GroupBy(r => r.JobName).ToDictionary(g => g.Key, g => g.ToList());

        // Expected jobs first, then anything on record that is no longer expected.
        var names = q.Expected.Select(e => e.Name).Concat(byJob.Keys).Distinct();

        var report = names.Select(name =>
        {
            var expect = q.Expected.FirstOrDefault(e => e.Name == name);
            var runs = byJob.TryGetValue(name, out var list) ? list : [];
            var last = runs.OrderByDescending(r => r.StartedAtUtc).FirstOrDefault();
            var lastSuccess = runs.Where(r => r.Status == CronJobStatus.Succeeded)
                .OrderByDescending(r => r.StartedAtUtc).FirstOrDefault();

            // How long a success may be absent before it counts as late: three intervals for
            // a frequent job, a day and two hours for a daily one.
            TimeSpan? allowance = expect switch
            {
                { EveryMinutes: { } m } => TimeSpan.FromMinutes(m * 3),
                { DailyAtUtc: not null } => TimeSpan.FromHours(26),
                _ => null,
            };
            var isLate = allowance is not null
                && (lastSuccess is null || now - lastSuccess.StartedAtUtc > allowance.Value);

            return new CronJobHealthDto(
                JobName: name,
                EveryMinutes: expect?.EveryMinutes,
                DailyAtUtc: expect?.DailyAtUtc,
                LastRunAtUtc: last?.StartedAtUtc,
                LastSuccessAtUtc: lastSuccess?.StartedAtUtc,
                LastStatus: last?.Status,
                LastItemsProcessed: last?.ItemsProcessed,
                LastError: last?.ErrorMessage,
                RunsLast24h: runs.Count(r => r.StartedAtUtc >= since),
                FailuresLast24h: runs.Count(r => r.StartedAtUtc >= since && r.Status == CronJobStatus.Failed),
                HoursSinceLastSuccess: lastSuccess is null ? null : Math.Round((now - lastSuccess.StartedAtUtc).TotalHours, 1),
                IsLate: isLate);
        })
        .OrderByDescending(d => d.IsLate)
        .ThenBy(d => d.JobName)
        .ToList();

        return Result.Success<IReadOnlyList<CronJobHealthDto>>(report);
    }
}
