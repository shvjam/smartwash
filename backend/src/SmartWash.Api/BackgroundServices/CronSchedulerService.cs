using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Audit;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Api.BackgroundServices;

/// <summary>
/// Runs the scheduled jobs from inside the app, for hosts with no scheduler of their own.
///
/// It decides what to run by asking what is due, not what time it is. The first version ran a
/// daily job only if the loop happened to wake within six minutes of its hour — so on shared
/// hosting, where the app pool sleeps whenever nobody is using the site, a quiet night at two
/// in the morning meant no billing that day at all, and nothing anywhere said so. Now a daily
/// job is due once its hour has passed and it has not succeeded since; a sleeping app catches
/// up the moment it wakes.
///
/// The same record of past runs is what lets this coexist with an external scheduler calling
/// /api/cron: a job the panel ran a minute ago has a fresh success on record and is not due.
/// </summary>
public sealed class CronSchedulerService : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(1);

    /// <summary>A run that has not finished in this long is assumed dead, not still going.</summary>
    private static readonly TimeSpan StaleRun = TimeSpan.FromMinutes(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CronSchedulerService> _logger;

    public CronSchedulerService(IServiceScopeFactory scopeFactory, ILogger<CronSchedulerService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Cron scheduler started with {Count} jobs", CronJobs.All.Count);

        // Let the app finish starting (migrations, seeding) before the first pass.
        try { await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                foreach (var job in await DueJobsAsync(stoppingToken))
                {
                    if (stoppingToken.IsCancellationRequested) break;
                    await RunAsync(job, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                // One bad pass must not stop the scheduler for the life of the process.
                _logger.LogError(ex, "Cron scheduler pass failed");
            }

            try { await Task.Delay(Tick, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task<IReadOnlyList<CronJobDefinition>> DueJobsAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var now = DateTime.UtcNow;
        var names = CronJobs.All.Select(j => j.Name).ToList();
        var lookback = now.AddDays(-2);

        var recent = await db.CronJobRuns.AsNoTracking()
            .Where(r => names.Contains(r.JobName) && r.StartedAtUtc >= lookback)
            .Select(r => new { r.JobName, r.StartedAtUtc, r.Status })
            .ToListAsync(ct);

        var due = new List<CronJobDefinition>();
        foreach (var job in CronJobs.All)
        {
            var runs = recent.Where(r => r.JobName == job.Name).ToList();

            // Somebody — this loop or the hosting panel — is already running it.
            if (runs.Any(r => r.Status == CronJobStatus.Running && now - r.StartedAtUtc < StaleRun)) continue;

            var lastStart = runs.Count == 0 ? (DateTime?)null : runs.Max(r => r.StartedAtUtc);
            var lastSuccess = runs.Where(r => r.Status == CronJobStatus.Succeeded)
                .Select(r => (DateTime?)r.StartedAtUtc).DefaultIfEmpty(null).Max();

            if (job.EveryMinutes is { } every)
            {
                // Interval jobs retry on their own interval after a failure, not every tick.
                if (lastStart is null || now - lastStart.Value >= TimeSpan.FromMinutes(every)) due.Add(job);
            }
            else if (job.DailyAtUtc is { } at)
            {
                var todaysSlot = now.Date.Add(at.ToTimeSpan());
                var slot = now >= todaysSlot ? todaysSlot : todaysSlot.AddDays(-1);
                var succeededSinceSlot = lastSuccess is not null && lastSuccess.Value >= slot;
                // A failed daily job is tried again, but not more than once every quarter hour.
                var triedRecently = lastStart is not null && now - lastStart.Value < TimeSpan.FromMinutes(15);
                if (!succeededSinceSlot && !triedRecently) due.Add(job);
            }
        }
        return due;
    }

    private async Task RunAsync(CronJobDefinition job, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var jobs = scope.ServiceProvider.GetRequiredService<CronJobs>();
        var outcome = await jobs.RunAsync(job.Name, "scheduler", ct);
        if (outcome.Succeeded)
            _logger.LogInformation("Cron {Job} done: {Processed} item(s)", job.Name, outcome.Processed);
        else
            _logger.LogWarning("Cron {Job} failed: {Error}", job.Name, outcome.Error);
    }
}
