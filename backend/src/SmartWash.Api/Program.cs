using Microsoft.EntityFrameworkCore;
using SmartWash.Api.Authorization;
using SmartWash.Api.Configuration;
using SmartWash.Api.Identity;
using SmartWash.Api.Middlewares;
using SmartWash.Application;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Infrastructure;
using SmartWash.Infrastructure.Persistence.Seed;
using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Deployment secrets live in a file shipped beside the app rather than only in web.config.
// On this host the file manager's Extract has twice left an older web.config in place, which
// silently dropped every environment variable with it; a settings file inside the package
// cannot be lost that way. The .config extension is deliberate: IIS request filtering refuses
// to serve *.config files, so even if the ASP.NET Core handler were ever missing the secrets
// could not be downloaded, which is exactly what happened to appsettings.json on a bad deploy.
// Environment variables are added again afterwards so a value set on the host still wins.
var secretsFile = Path.Combine(builder.Environment.ContentRootPath, "appsettings.secrets.config");
builder.Configuration.AddJsonFile(secretsFile, optional: true, reloadOnChange: false);
builder.Configuration.AddEnvironmentVariables();

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithThreadId()
    .CreateLogger();

builder.Host.UseSerilog();

// مسیر لاگ نسبی است و نسبت به «پوشه‌ی اجرای برنامه» حل می‌شود، نه پوشه‌ی سورس.
// این خط مسیر مطلق را همان ابتدای اجرا اعلام می‌کند تا پیدا کردن لاگ حدسی نباشد.
Log.Information("Serilog file sink directory: {Directory}", Path.GetFullPath("App_Data/logs"));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplication();

builder.Services.AddAppAuthentication(builder.Configuration);
builder.Services.AddAppCors(builder.Configuration);
builder.Services.AddSwagger();

// NOTE: Enums are serialized as NUMBERS (System.Text.Json default). The React
// frontend (src/app/api/types.ts + adapters.ts) maps enum values by numeric
// index, so a JsonStringEnumConverter here would break status/category
// rendering across the whole UI. Do not add a string enum converter.
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddScoped<CronAuthFilter>();

// سرویس پس‌زمینه — اجرای خودکار cron jobs داخلی.
//
// Turn this off (Cron__UseInternalScheduler=false) wherever an external scheduler calls the
// /api/cron/* endpoints instead — shared hosting, where the app pool sleeps and takes the
// background service with it, is the usual reason. The two must not both be live: CronJobRun
// only records that a job ran and enforces nothing, so a concurrent daily-billing on both
// paths would bill the same subscription twice.
if (builder.Configuration.GetValue("Cron:UseInternalScheduler", true))
{
    builder.Services.AddHostedService<SmartWash.Api.BackgroundServices.CronSchedulerService>();
}

var healthChecks = builder.Services.AddHealthChecks();
// Connectivity and schema are separate questions: the database can answer a ping while
// being a version behind the code, which is exactly the state a failed deploy leaves.
healthChecks.AddCheck<SmartWash.Api.Configuration.SchemaHealthCheck>("database-schema", tags: ["ready"]);
// اگر connection string واقعی تنظیم نشده باشد، ثبت health-checkِ SqlServer نباید
// باعث کرشِ استارتاپ شود؛ در آن صورت اپ همچنان بالا می‌آید و /health/live پاسخ می‌دهد
// تا بتوان «بالا بودن اپ» را از «سلامت دیتابیس» تفکیک کرد.
var dbConnection = builder.Configuration.GetConnectionString("Default");
if (!string.IsNullOrWhiteSpace(dbConnection) && !dbConnection.Contains("REPLACE-WITH"))
{
    healthChecks.AddSqlServer(connectionString: dbConnection, name: "sql-server", tags: ["ready"]);
}

builder.Services.AddRouting(o => o.LowercaseUrls = true);

var otlpEndpoint = builder.Configuration["Otlp:Endpoint"];
if (!string.IsNullOrEmpty(otlpEndpoint))
{
    builder.Services.AddOpenTelemetry()
        .ConfigureResource(r => r
            .AddService("smartwash-api", serviceVersion: "0.1.0")
            .AddAttributes([new("deployment.environment", builder.Environment.EnvironmentName)]))
        .WithTracing(t => t
            .AddAspNetCoreInstrumentation(o => o.RecordException = true)
            .AddHttpClientInstrumentation()
            .AddOtlpExporter(o => o.Endpoint = new Uri(otlpEndpoint)));
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(o =>
    {
        o.SwaggerEndpoint("/swagger/v1/swagger.json", "SmartWash API v1");
        o.RoutePrefix = "swagger";
    });
}

app.UseSerilogRequestLogging();
app.UseMiddleware<CorrelationMiddleware>();
app.UseMiddleware<ExceptionMiddleware>();
// TenantMiddleware converts /api/t/{tenantSlug}/... into /api/... .
// Endpoint routing must run AFTER this rewrite; otherwise ASP.NET Core selects
// endpoints using the unrevised tenant URL and every tenant endpoint returns 404.
app.UseMiddleware<TenantMiddleware>();
app.UseRouting();

app.UseCors(CorsConfig.PolicyName);
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
// Liveness مستقل از دیتابیس: هیچ health-checkی اجرا نمی‌کند و اگر اپ بالا باشد
// همیشه 200 برمی‌گرداند. برای تشخیص اینکه ماژول IIS اپ را سرو می‌کند یا نه.
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapGet("/", () => Results.Ok(new { name = "SmartWash API", version = "0.1.0", status = "running", utc = DateTime.UtcNow }));

// Must run before SeedAsync: seeding a placeholder password creates the platform owner
// account with a credential that is committed to the repository.
app.ValidateSecrets();

await MigrateAsync(app);
await SeedAsync(app);

try
{
    Log.Information("Starting SmartWash API");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

/// <summary>
/// Applies pending EF migrations, but only when explicitly asked to.
///
/// This deployment applies them on startup, because the host offers no remote SQL access and
/// no web SQL client — there is genuinely no other way to change the schema here. Set
/// Database__MigrateOnStartup to false to turn it off on a host where a script can be run.
///
/// The trade-off is real and worth stating: the schema changes the moment the app pool
/// recycles after a deploy that carries a migration, with no review step and no backup taken
/// automatically. Take a database backup before deploying anything that migrates.
/// </summary>
static async Task MigrateAsync(WebApplication app)
{
    if (!app.Configuration.GetValue("Database:MigrateOnStartup", true))
    {
        SmartWash.Api.Configuration.SchemaState.RecordSkipped();
        return;
    }

    string[] pending = Array.Empty<string>();
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmartWash.Infrastructure.Persistence.AppDbContext>();

        pending = (await db.Database.GetPendingMigrationsAsync()).ToArray();
        if (pending.Length == 0)
        {
            Log.Information("Database schema is already up to date.");
            SmartWash.Api.Configuration.SchemaState.RecordCurrent();
            return;
        }

        Log.Warning("Applying {Count} pending migration(s): {Migrations}", pending.Length, string.Join(", ", pending));
        await db.Database.MigrateAsync();

        Log.Warning("Database schema updated: {Migrations}", string.Join(", ", pending));
        SmartWash.Api.Configuration.SchemaState.RecordApplied(pending);
    }
    catch (Exception ex)
    {
        // Crashing here produces an opaque HTTP 500.30 under IIS and hides the real cause, so
        // the app still comes up — but it comes up *saying* it is broken. /health now reports
        // Unhealthy with this message, which is the only way to find out without a log file
        // when the host offers no remote database access.
        Log.Error(ex, "Applying migrations on startup failed. The schema is unchanged.");
        SmartWash.Api.Configuration.SchemaState.RecordFailed(pending, ex);
    }
}

static async Task SeedAsync(WebApplication app)
{
    try
    {
        using var scope = app.Services.CreateScope();

        if (!app.Configuration.GetValue("Seed:RunOnStartup", false))
        {
            // A database with no plans and no users has never been set up, and an app pointed
            // at one cannot be signed into at all — every login reports a wrong password because
            // there is no account to match. That is exactly what a fresh database looks like
            // after the migrations have built its tables, so it is bootstrapped once here.
            //
            // It stays switched off for any database that already holds data. The seeder
            // reconciles the platform owner's password back to the configured value, so running
            // it on every start would quietly undo a password the owner had changed.
            var db = scope.ServiceProvider.GetRequiredService<SmartWash.Infrastructure.Persistence.AppDbContext>();
            var isEmpty = !await db.Plans.IgnoreQueryFilters().AnyAsync()
                          && !await db.Users.IgnoreQueryFilters().AnyAsync();
            if (!isEmpty) return;
            Log.Warning("Database has no plans and no users; seeding the initial data once.");
        }

        var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
        await seeder.SeedAsync();
    }
    catch (Exception ex)
    {
        // A seed/DB failure must NOT crash host startup (that produces an opaque
        // HTTP 500.30 with no useful diagnostics under IIS). Log it and let the
        // API come up so /health and the logs can report the real cause.
        Log.Error(ex, "Database seeding failed during startup; continuing without seed. " +
                      "Check the connection string and that the DB server allows remote connections.");
    }
}

public partial class Program { }
