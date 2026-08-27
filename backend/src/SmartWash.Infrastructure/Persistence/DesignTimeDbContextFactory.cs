using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SmartWash.Infrastructure.Persistence;

/// <summary>
/// کارخانه‌ی زمانِ طراحی برای ابزار dotnet-ef.
/// با وجود این کلاس، دستورهای migration و script نیازی به بالا آوردن هاست وب،
/// خواندن appsettings یا اتصال واقعی به دیتابیس ندارند؛ رشته‌ی اتصال فقط برای
/// تولید SQL استفاده می‌شود و هیچ اتصالی برقرار نمی‌شود.
///
/// در صورت نیاز می‌توان با متغیر محیطی SMARTWASH_MIGRATIONS_CONNECTION آن را بازنویسی کرد.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("SMARTWASH_MIGRATIONS_CONNECTION")
            ?? "Server=.;Database=SmartWash;Trusted_Connection=True;Encrypt=False;TrustServerCertificate=True";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connection, sql => sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
            .Options;

        return new AppDbContext(options, new DesignTimeTenantContext(), new DesignTimeCurrentUser());
    }

    /// <summary>بدون مستاجر — فیلترهای سراسری روی شکل جداول اثری ندارند.</summary>
    private sealed class DesignTimeTenantContext : ITenantContext
    {
        public Guid? TenantId => null;
        public string? Slug => null;
        public bool HasTenant => false;
        public bool IsReadOnly => false;
        public void SetTenant(Guid tenantId, string slug, bool isReadOnly) { }
    }

    private sealed class DesignTimeCurrentUser : ICurrentUser
    {
        public Guid? UserId => null;
        public string? Email => null;
        public Guid? TenantId => null;
        public bool IsAuthenticated => false;
        public bool IsPlatformAdmin => false;
        public IReadOnlyCollection<string> Roles => Array.Empty<string>();
        public IReadOnlyCollection<string> Permissions => Array.Empty<string>();
        public bool HasPermission(string permission) => false;
        public bool IsInRole(string role) => false;
    }
}
