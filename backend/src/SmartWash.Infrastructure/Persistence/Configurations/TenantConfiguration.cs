using SmartWash.Domain.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations;

public sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> b)
    {
        b.ToTable("Tenants");
        b.HasKey(x => x.Id);
        b.Property(x => x.Slug).IsRequired().HasMaxLength(60);
        b.HasIndex(x => x.Slug).IsUnique();
        b.Property(x => x.DisplayName).IsRequired().HasMaxLength(150);
        b.Property(x => x.OwnerEmail).IsRequired().HasMaxLength(256);
        b.Property(x => x.OwnerPhone).HasMaxLength(20);
        b.Property(x => x.LogoUrl).HasMaxLength(500);
        b.Property(x => x.PrimaryColor).HasMaxLength(20);
        b.Property(x => x.TimeZone).IsRequired().HasMaxLength(60);
        b.Property(x => x.Locale).IsRequired().HasMaxLength(10);
        b.Property(x => x.Currency).IsRequired().HasMaxLength(10);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.Property(x => x.SuspendReason).HasMaxLength(500);
    }
}
// resync-marker
