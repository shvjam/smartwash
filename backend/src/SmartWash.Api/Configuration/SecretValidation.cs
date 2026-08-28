using Serilog;

namespace SmartWash.Api.Configuration;

/// <summary>
/// Refuses to start outside Development while any secret still holds the repository
/// placeholder.
///
/// The placeholders are committed, so booting with one is not a misconfiguration that
/// degrades a feature — it is a published credential. A placeholder Jwt:SigningKey lets
/// anyone who can read the repository mint a valid token for any user of any tenant,
/// including the platform owner, and a placeholder Cron:Secret opens every cron endpoint.
///
/// Nothing else catches this: the seeder treats the placeholder string as a real password
/// (its `?? "default"` fallbacks only guard null), seeding failures are logged and
/// swallowed so startup continues, and the SQL health check unregisters itself when the
/// connection string is a placeholder — so /health reports Healthy on a wide-open server.
/// </summary>
public static class SecretValidation
{
    private const string Placeholder = "REPLACE-WITH";

    /// <summary>README documents a 64-character minimum; a shorter key weakens HMAC-SHA256.</summary>
    private const int MinimumSigningKeyLength = 64;

    public static void ValidateSecrets(this WebApplication app)
    {
        if (app.Environment.IsDevelopment()) return;

        var config = app.Configuration;
        var errors = new List<string>();
        var warnings = new List<string>();

        void Require(string key, string envVar)
        {
            var value = config[key];
            if (string.IsNullOrWhiteSpace(value))
                errors.Add($"{key} is not set. Set the environment variable {envVar}.");
            else if (value.Contains(Placeholder, StringComparison.OrdinalIgnoreCase))
                errors.Add($"{key} still holds the repository placeholder. Set {envVar} to a real value.");
        }

        void WarnIfPlaceholder(string key, string envVar, string consequence)
        {
            var value = config[key];
            if (!string.IsNullOrWhiteSpace(value) && value.Contains(Placeholder, StringComparison.OrdinalIgnoreCase))
                warnings.Add($"{key} still holds the repository placeholder — {consequence} Set {envVar} before relying on it.");
        }

        // Security-critical: a placeholder here is an published credential, not a missing feature.
        Require("ConnectionStrings:Default", "ConnectionStrings__Default");
        Require("Jwt:SigningKey", "Jwt__SigningKey");
        Require("Cron:Secret", "Cron__Secret");

        var signingKey = config["Jwt:SigningKey"];
        if (!string.IsNullOrWhiteSpace(signingKey)
            && !signingKey.Contains(Placeholder, StringComparison.OrdinalIgnoreCase)
            && signingKey.Length < MinimumSigningKeyLength)
        {
            errors.Add($"Jwt:SigningKey is {signingKey.Length} characters; at least {MinimumSigningKeyLength} are required.");
        }

        // Seed passwords only matter on a run that actually seeds.
        if (config.GetValue("Seed:RunOnStartup", false))
        {
            Require("Seed:PlatformOwner:Password", "Seed__PlatformOwner__Password");

            if (config.GetValue("Seed:DemoTenant:Enabled", true))
                Require("Seed:DemoTenant:Password", "Seed__DemoTenant__Password");
        }

        // A feature switched on must be configured; one left off is not this check's business.
        if (config.GetValue("Sms:Enabled", false))
            Require("Sms:ApiKey", "Sms__ApiKey");

        if (config.GetValue("Smtp:Enabled", false))
            Require("Smtp:Password", "Smtp__Password");

        // Payment credentials are per-tenant runtime concerns: an unconfigured gateway fails
        // that one checkout rather than exposing anything, so it must not block the platform.
        WarnIfPlaceholder("Payments:Zarinpal:MerchantId", "Payments__Zarinpal__MerchantId", "Zarinpal payments will fail.");
        WarnIfPlaceholder("Payments:IDPay:ApiKey", "Payments__IDPay__ApiKey", "IDPay payments will fail.");
        WarnIfPlaceholder("Payments:NextPay:ApiKey", "Payments__NextPay__ApiKey", "NextPay payments will fail.");

        foreach (var warning in warnings) Log.Warning("Configuration warning: {Warning}", warning);

        if (errors.Count == 0) return;

        // Reported through Serilog and flushed by hand: an exception thrown here escapes
        // before the try/finally around app.Run(), and under IIS an unlogged startup failure
        // surfaces only as an opaque HTTP 500.30.
        var message = "Refusing to start with unconfigured secrets:" + Environment.NewLine +
                      string.Join(Environment.NewLine, errors.Select(e => "  - " + e));
        Log.Fatal("{Message}", message);
        Log.CloseAndFlush();
        throw new InvalidOperationException(message);
    }
}
