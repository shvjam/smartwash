using SmartWash.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations.Operations;

public sealed class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> b)
    {
        b.ToTable("Branches");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).IsRequired().HasMaxLength(120);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.Phone).HasMaxLength(20);
        b.Property(x => x.Latitude).HasMaxLength(32);
        b.Property(x => x.Longitude).HasMaxLength(32);
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.IsActive });
        b.HasIndex(x => new { x.TenantId, x.IsDefault });
    }
}

public sealed class BayConfiguration : IEntityTypeConfiguration<Bay>
{
    public void Configure(EntityTypeBuilder<Bay> b)
    {
        b.ToTable("Bays");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).IsRequired().HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(500);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.BranchId });
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.Number }).IsUnique();
    }
}

public sealed class WorkerConfiguration : IEntityTypeConfiguration<Worker>
{
    public void Configure(EntityTypeBuilder<Worker> b)
    {
        b.ToTable("Workers");
        b.HasKey(x => x.Id);
        b.Property(x => x.FullName).IsRequired().HasMaxLength(150);
        b.Property(x => x.Role).IsRequired().HasMaxLength(60);
        b.Property(x => x.Phone).HasMaxLength(20);
        b.Property(x => x.NationalId).HasMaxLength(20);
        b.Property(x => x.AvatarUrl).HasMaxLength(500);
        b.Property(x => x.CommissionRate).HasPrecision(5, 2);
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.IsActive });
        b.HasIndex(x => new { x.TenantId, x.UserId });
    }
}

public sealed class ServiceConfiguration : IEntityTypeConfiguration<Service>
{
    public void Configure(EntityTypeBuilder<Service> b)
    {
        b.ToTable("Services");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).IsRequired().HasMaxLength(120);
        b.Property(x => x.Description).HasMaxLength(500);
        b.Property(x => x.IconKey).HasMaxLength(60);
        b.Property(x => x.Category).HasConversion<int>();
        b.Property(x => x.RequiredBayType).HasConversion<int?>();
        b.Property(x => x.WorkerCommissionRate).HasPrecision(5, 2);
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.IsActive, x.Category });
    }
}
// resync-marker
