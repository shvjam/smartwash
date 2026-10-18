using SmartWash.Api.Authorization;
using SmartWash.Api.BackgroundServices;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Cron;

/// <summary>
/// The scheduled jobs, callable from outside.
///
/// For hosts whose scheduler lives in the hosting panel rather than in the app. The work
/// itself lives in <see cref="CronJobs"/>, shared with the in-process scheduler, so a job
/// behaves the same and is recorded the same whichever of the two runs it.
/// </summary>
[ApiController]
[CronEndpoint]
[Route("api/cron")]
public sealed class CronController : ControllerBase
{
    private readonly CronJobs _jobs;
    public CronController(CronJobs jobs) => _jobs = jobs;

    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { ok = true, at = DateTime.UtcNow });

    [HttpGet("expire-trials")]
    public Task<IActionResult> ExpireTrials(CancellationToken ct) => Run("expire-trials", ct);

    [HttpGet("expire-grace")]
    public Task<IActionResult> ExpireGrace(CancellationToken ct) => Run("expire-grace", ct);

    [HttpGet("daily-billing")]
    public Task<IActionResult> DailyBilling(CancellationToken ct) => Run("daily-billing", ct);

    [HttpGet("expire-overdue-subscriptions")]
    public Task<IActionResult> ExpireOverdueSubscriptions(CancellationToken ct) => Run("expire-overdue-subscriptions", ct);

    [HttpGet("billing-reminders")]
    public Task<IActionResult> BillingReminders(CancellationToken ct) => Run("billing-reminders", ct);

    [HttpGet("generate-service-reminders")]
    public Task<IActionResult> GenerateServiceReminders([FromQuery] int sinceDays = 60, CancellationToken ct = default)
        => Run("generate-service-reminders", ct, sinceDays);

    [HttpGet("send-reminders")]
    public Task<IActionResult> SendReminders(CancellationToken ct) => Run("send-reminders", ct);

    [HttpGet("campaign-dispatcher")]
    public Task<IActionResult> CampaignDispatcher(CancellationToken ct) => Run("campaign-dispatcher", ct);

    [HttpGet("generate-notifications")]
    public Task<IActionResult> GenerateNotifications(CancellationToken ct) => Run("generate-notifications", ct);

    [HttpGet("cleanup-tokens")]
    public Task<IActionResult> CleanupTokens(CancellationToken ct) => Run("cleanup-tokens", ct);

    [HttpGet("usage-rollup")]
    public Task<IActionResult> UsageRollup(CancellationToken ct) => Run("usage-rollup", ct);

    private async Task<IActionResult> Run(string job, CancellationToken ct, int? sinceDays = null)
    {
        var outcome = await _jobs.RunAsync(job, HttpContext.TraceIdentifier, ct, sinceDays);
        return outcome.Succeeded ? Ok(outcome.Details) : StatusCode(500, outcome.Details);
    }
}
