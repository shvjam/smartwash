using SmartWash.Application.Abstractions.Identity;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Identity;
using SmartWash.Domain.Operations;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace SmartWash.Infrastructure.Persistence.Seed;

public sealed class DatabaseSeeder
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IConfiguration _config;
    private readonly ILogger<DatabaseSeeder> _logger;

    public DatabaseSeeder(AppDbContext db, IPasswordHasher hasher, IConfiguration config, ILogger<DatabaseSeeder> logger)
    {
        _db = db;
        _hasher = hasher;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Seeds reference data only. Schema creation and migration are deliberately excluded:
    /// deploy with <c>dotnet ef database update</c> before enabling this operation.
    /// </summary>
    public async Task SeedAsync(CancellationToken ct = default)
    {
        await SeedPlansAsync(ct);
        await SeedPlatformOwnerAsync(ct);
        await SeedDemoTenantAsync(ct);
    }

    private async Task SeedPlansAsync(CancellationToken ct)
    {
        if (await _db.Plans.AnyAsync(ct)) return;

        _logger.LogInformation("Seeding plans...");

        var starter = Plan.Create("starter", "پلن استارتر", PlanBillingModel.Subscription,
            setupFee: 25_000_000_0, monthly: 8_000_000_0, yearly: 80_000_000_0, perCar: 0, sortOrder: 1);
        starter.SetDescription("مناسب کارواش‌های کوچک تا ۲۰۰ خودرو در ماه");
        starter.AddFeature("max_bays", "3");
        starter.AddFeature("max_users", "5");
        starter.AddFeature("limit.branches", "1");
        starter.AddFeature("limit.vehicles", "3");
        starter.AddFeature("reservations", "true");
        starter.AddFeature("sms", "false");
        starter.AddFeature("loyalty", "false");
        starter.AddFeature("campaigns", "false");
        starter.AddFeature("wallet", "false");
        starter.AddFeature("branding", "false");

        var pro = Plan.Create("pro", "پلن حرفه‌ای", PlanBillingModel.Subscription,
            setupFee: 25_000_000_0, monthly: 15_000_000_0, yearly: 150_000_000_0, perCar: 0, sortOrder: 2);
        pro.SetDescription("مناسب کارواش‌های متوسط تا بزرگ با امکانات کامل");
        pro.AddFeature("max_bays", "10");
        pro.AddFeature("max_users", "25");
        pro.AddFeature("limit.branches", "3");
        pro.AddFeature("limit.vehicles", "10");
        pro.AddFeature("reservations", "true");
        pro.AddFeature("sms", "true");
        pro.AddFeature("loyalty", "true");
        pro.AddFeature("campaigns", "true");
        pro.AddFeature("wallet", "true");
        pro.AddFeature("branding", "true");

        var partnership = Plan.Create("partnership", "پلن مشارکتی", PlanBillingModel.UsageBased,
            setupFee: 0, monthly: 0, yearly: 0, perCar: 15_000_0, sortOrder: 3);
        partnership.SetDescription("بدون هزینه ثابت — پرداخت به ازای هر خودرو سرویس‌شده");
        partnership.SetBrackets(new[]
        {
            new PlanTierBracket(1, 500, 15_000_0),
            new PlanTierBracket(501, 1500, 10_000_0),
            new PlanTierBracket(1501, null, 8_000_0)
        });
        partnership.AddFeature("max_bays", "unlimited");
        partnership.AddFeature("max_users", "unlimited");
        partnership.AddFeature("limit.branches", "unlimited");
        partnership.AddFeature("limit.vehicles", "unlimited");
        partnership.AddFeature("reservations", "true");
        partnership.AddFeature("sms", "true");
        partnership.AddFeature("loyalty", "true");
        partnership.AddFeature("campaigns", "true");
        partnership.AddFeature("wallet", "true");
        partnership.AddFeature("branding", "true");

        _db.Plans.AddRange(starter, pro, partnership);
        await _db.SaveChangesAsync(ct);
    }

    private async Task SeedDemoTenantAsync(CancellationToken ct)
    {
        var section = _config.GetSection("Seed:DemoTenant");
        if (!section.GetValue("Enabled", true)) return;

        var slug = section["Slug"]?.Trim().ToLowerInvariant() ?? "demo-carwash";
        var displayName = section["DisplayName"] ?? "کارواش آزمایشی SmartWash";
        var email = section["Email"] ?? "demo@appsmartwash.com";
        var password = section["Password"] ?? "Demo@1234";
        var ownerName = section["OwnerDisplayName"] ?? "مدیر کارواش آزمایشی";
        var phone = section["Phone"] ?? "09120000000";

        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null)
        {
            tenant = Tenant.Create(slug, displayName, email, phone, AppConstants.TrialDays);
            _db.Tenants.Add(tenant);

            var settings = TenantSettings.CreateDefault(tenant.Id);
            settings.AdvanceOnboarding(3);
            settings.CompleteOnboarding();
            _db.TenantSettings.Add(settings);

            var branch = Branch.Create(tenant.Id, "شعبه نمونه", "تهران", phone, isDefault: true);
            _db.Branches.Add(branch);
            _db.Bays.AddRange(
                Bay.Create(tenant.Id, branch.Id, "جایگاه ۱", 1),
                Bay.Create(tenant.Id, branch.Id, "جایگاه ۲", 2),
                Bay.Create(tenant.Id, branch.Id, "جایگاه ۳", 3));
            _db.Services.AddRange(
                Service.Create(tenant.Id, "شستشوی معمولی", ServiceCategory.Main, 500_000, 30, 0.10m),
                Service.Create(tenant.Id, "شستشوی کامل", ServiceCategory.Main, 900_000, 60, 0.10m),
                Service.Create(tenant.Id, "نظافت داخل خودرو", ServiceCategory.Interior, 700_000, 45, 0.10m));
        }

        var normalizedEmail = email.Trim().ToUpperInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);
        if (user is null)
        {
            user = User.CreateTenantUser(tenant.Id, email, ownerName, _hasher.Hash(password), Roles.TenantOwner);
            user.ConfirmEmail();
            _db.Users.Add(user);
        }
        else if (!_hasher.Verify(password, user.PasswordHash))
        {
            // Keep the documented demo credentials reliable after a database reset
            // or an earlier manual password change.
            user.UpdatePassword(_hasher.Hash(password));
        }

        if (_db.ChangeTracker.HasChanges())
        {
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Demo tenant is ready: {Slug} / {Email}", slug, email);
        }
    }

    private async Task SeedPlatformOwnerAsync(CancellationToken ct)
    {
        var section = _config.GetSection("Seed:PlatformOwner");
        var email = section["Email"];
        var password = section["Password"];
        var displayName = section["DisplayName"] ?? "Platform Owner";

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            _logger.LogWarning("Seed:PlatformOwner not configured. Skipping platform owner seed.");
            return;
        }

        var normalized = email.Trim().ToUpperInvariant();
        // Find existing platform owner (TenantId == null means platform-level user)
        var existing = await _db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.TenantId == null, ct);

        if (existing is not null)
        {
            // Seed must be idempotent. Re-hashing a password on every app start
            // always changes User.RowVersion and can race with an active login.
            var changed = false;
            if (!string.Equals(existing.Email, email.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                existing.UpdateEmail(email.Trim());
                changed = true;
            }
            if (!_hasher.Verify(password, existing.PasswordHash))
            {
                existing.UpdatePassword(_hasher.Hash(password));
                changed = true;
            }
            if (!existing.EmailConfirmed)
            {
                existing.ConfirmEmail();
                changed = true;
            }
            if (!existing.IsActive)
            {
                existing.Activate();
                changed = true;
            }
            if (existing.IsLockedOut || existing.FailedLoginAttempts > 0)
            {
                existing.RecordSuccessfulLogin();
                changed = true;
            }
            if (changed)
            {
                await _db.SaveChangesAsync(ct);
                _logger.LogInformation("Platform owner seed reconciled: {Email}", email);
            }
            return;
        }

        // No existing platform owner — create new
        if (await _db.Users.AnyAsync(u => u.NormalizedEmail == normalized, ct)) return;

        var hash = _hasher.Hash(password);
        var owner = User.CreatePlatformUser(email.Trim(), displayName, hash, Roles.PlatformOwner);
        owner.ConfirmEmail();
        _db.Users.Add(owner);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Platform owner seeded: {Email}", email);
    }
}
// resync-marker
