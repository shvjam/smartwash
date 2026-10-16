using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace SmartWash.Api.Configuration;

/// <summary>
/// What happened to the database schema when the app started, so it can be asked about later.
///
/// Migrations are applied at startup on this deployment, because the host offers no remote SQL
/// access and no web SQL client — there is no way to run a script by hand. That makes the
/// outcome of the migration the single most important fact about a deploy, and it was only
/// being written to a log file that has to be hunted for through a file manager.
///
/// Recording it here lets /health answer the question instead. The cost of not doing that is
/// specific and bad: a failed migration leaves the app running happily against the old schema,
/// /health reports the database as fine because the connection works, and the first sign of
/// trouble is every order failing with a 500 an hour later.
/// </summary>
public static class SchemaState
{
    public enum Outcome
    {
        /// <summary>Startup migration is switched off; the schema was not inspected.</summary>
        Skipped,
        /// <summary>Nothing to do — the database already matched the code.</summary>
        AlreadyCurrent,
        Applied,
        Failed,
    }

    public static Outcome Result { get; private set; } = Outcome.Skipped;
    public static string[] AppliedMigrations { get; private set; } = Array.Empty<string>();
    public static string[] PendingMigrations { get; private set; } = Array.Empty<string>();
    public static string? Error { get; private set; }
    public static DateTime? CheckedAtUtc { get; private set; }

    public static void RecordSkipped() => Set(Outcome.Skipped, null, null, null);
    public static void RecordCurrent() => Set(Outcome.AlreadyCurrent, null, null, null);
    public static void RecordApplied(string[] applied) => Set(Outcome.Applied, applied, null, null);

    public static void RecordFailed(string[] pending, Exception ex)
        => Set(Outcome.Failed, null, pending, ex.Message);

    private static void Set(Outcome outcome, string[]? applied, string[]? pending, string? error)
    {
        Result = outcome;
        AppliedMigrations = applied ?? Array.Empty<string>();
        PendingMigrations = pending ?? Array.Empty<string>();
        Error = error;
        CheckedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Reports the schema as part of /health.
///
/// Deliberately reports Unhealthy when a migration failed or when migrations are still pending:
/// the API process is fine in both cases, but the thing the caller wants to know — can this
/// system take an order — is no. A health endpoint that says Healthy while the schema is a
/// version behind is worse than no health endpoint, because it is trusted.
/// </summary>
public sealed class SchemaHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        var data = new Dictionary<string, object>
        {
            ["outcome"] = SchemaState.Result.ToString(),
            ["checkedAtUtc"] = SchemaState.CheckedAtUtc?.ToString("O") ?? "never",
        };

        if (SchemaState.AppliedMigrations.Length > 0)
            data["applied"] = string.Join(", ", SchemaState.AppliedMigrations);
        if (SchemaState.PendingMigrations.Length > 0)
            data["pending"] = string.Join(", ", SchemaState.PendingMigrations);
        if (SchemaState.Error is not null)
            data["error"] = SchemaState.Error;

        return Task.FromResult(SchemaState.Result switch
        {
            SchemaState.Outcome.Failed => HealthCheckResult.Unhealthy(
                "به‌روزرسانی ساختار دیتابیس ناموفق بود. برنامه با ساختار قدیمی کار می‌کند.", data: data),

            SchemaState.Outcome.Applied => HealthCheckResult.Healthy(
                $"{SchemaState.AppliedMigrations.Length} مهاجرت اعمال شد.", data),

            SchemaState.Outcome.AlreadyCurrent => HealthCheckResult.Healthy(
                "ساختار دیتابیس به‌روز است.", data),

            _ => HealthCheckResult.Healthy("بررسی ساختار دیتابیس در استارتاپ انجام نشد.", data),
        });
    }
}
