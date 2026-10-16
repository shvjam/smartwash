using SmartWash.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations.Operations;

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("Orders");
        b.HasKey(x => x.Id);
        b.Property(x => x.Number).IsRequired().HasMaxLength(40);
        b.Property(x => x.CustomerName).IsRequired().HasMaxLength(150);
        b.Property(x => x.CustomerPhone).HasMaxLength(20);
        b.Property(x => x.VehiclePlate).IsRequired().HasMaxLength(20);
        b.Property(x => x.VehicleBrand).HasMaxLength(60);
        b.Property(x => x.VehicleModel).HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Stage).HasConversion<int>();
        b.Property(x => x.Source).HasConversion<int>();
        b.Property(x => x.FinalPaymentMethod).HasConversion<int?>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.Status });
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        b.HasIndex(x => new { x.TenantId, x.StartedAtUtc });
        // hot-path: paginated list sorted by creation date
        b.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
        // hot-path: dashboard totals by status + date
        b.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAtUtc });
        // hot-path: the board of cars currently in the wash, grouped by where each one is
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.Stage });

        b.HasMany(x => x.Lines)
            .WithOne()
            .HasForeignKey(l => l.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Payments)
            .WithOne()
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.StageEvents)
            .WithOne()
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.BayVisits)
            .WithOne()
            .HasForeignKey(v => v.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Metadata.FindNavigation(nameof(Order.Lines))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        b.Metadata.FindNavigation(nameof(Order.Payments))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        b.Metadata.FindNavigation(nameof(Order.StageEvents))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        b.Metadata.FindNavigation(nameof(Order.BayVisits))!.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    public void Configure(EntityTypeBuilder<OrderLine> b)
    {
        b.ToTable("OrderLines");
        b.HasKey(x => x.Id);
        b.Property(x => x.ServiceName).IsRequired().HasMaxLength(120);
        b.Property(x => x.WorkerName).HasMaxLength(150);
        b.Property(x => x.WorkerCommissionRate).HasPrecision(5, 2);
        b.HasIndex(x => new { x.TenantId, x.OrderId });
        b.HasIndex(x => new { x.TenantId, x.WorkerId });
    }
}

public sealed class OrderPaymentConfiguration : IEntityTypeConfiguration<OrderPayment>
{
    public void Configure(EntityTypeBuilder<OrderPayment> b)
    {
        b.ToTable("OrderPayments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Method).HasConversion<int>();
        b.Property(x => x.Reference).HasMaxLength(200);
        b.HasIndex(x => new { x.TenantId, x.OrderId });
    }
}
// resync-marker

public sealed class OrderStageEventConfiguration : IEntityTypeConfiguration<OrderStageEvent>
{
    public void Configure(EntityTypeBuilder<OrderStageEvent> b)
    {
        b.ToTable("OrderStageEvents");
        b.HasKey(x => x.Id);
        b.Property(x => x.Stage).HasConversion<int>();
        b.Property(x => x.Note).HasMaxLength(400);
        // The journey of one car, read in order.
        b.HasIndex(x => new { x.OrderId, x.AtUtc });
        // Every stage change in a period, for the archive report.
        b.HasIndex(x => new { x.TenantId, x.AtUtc });
    }
}
