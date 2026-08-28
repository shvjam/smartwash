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

// سرویس پس‌زمینه — اجرای خودکار cron jobs داخلی
builder.Services.AddHostedService<SmartWash.Api.BackgroundServices.CronSchedulerService>();

var healthChecks = builder.Services.AddHealthChecks();
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

static async Task SeedAsync(WebApplication app)
{
    if (!app.Configuration.GetValue("Seed:RunOnStartup", false)) return;
    try
    {
        using var scope = app.Services.CreateScope();
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
