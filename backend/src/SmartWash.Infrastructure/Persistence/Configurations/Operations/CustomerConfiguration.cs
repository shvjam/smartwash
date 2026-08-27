using SmartWash.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations.Operations;

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.ToTable("Customers");
        b.HasKey(x => x.Id);
        b.Property(x => x.FullName).IsRequired().HasMaxLength(150);
        b.Property(x => x.Phone).IsRequired().HasMaxLength(20);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.NationalId).HasMaxLength(20);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.Gender).HasConversion<int>();
        b.Property(x => x.Tier).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.Phone }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.IsActive });
        b.HasIndex(x => new { x.TenantId, x.Tier });
        // hot-path: CRM "inactive" query (last visit + active filter)
        b.HasIndex(x => new { x.TenantId, x.IsActive, x.LastVisitAtUtc });

        b.HasMany(x => x.Vehicles)
            .WithOne()
            .HasForeignKey(v => v.CustomerId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Metadata.FindNavigation(nameof(Customer.Vehicles))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class CustomerVehicleConfiguration : IEntityTypeConfiguration<CustomerVehicle>
{
    public void Configure(EntityTypeBuilder<CustomerVehicle> b)
    {
        b.ToTable("CustomerVehicles");
        b.HasKey(x => x.Id);
        b.Property(x => x.Plate).IsRequired().HasMaxLength(20);
        b.Property(x => x.Brand).IsRequired().HasMaxLength(60);
        b.Property(x => x.Model).IsRequired().HasMaxLength(80);
        b.Property(x => x.Color).HasMaxLength(40);
        b.HasIndex(x => new { x.TenantId, x.Plate });
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
    }
}
// resync-marker
