using SmartWash.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations.Operations;

public sealed class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> b)
    {
        b.ToTable("Reservations");
        b.HasKey(x => x.Id);
        b.Property(x => x.CustomerName).IsRequired().HasMaxLength(150);
        b.Property(x => x.CustomerPhone).IsRequired().HasMaxLength(20);
        b.Property(x => x.VehiclePlate).IsRequired().HasMaxLength(20);
        b.Property(x => x.VehicleBrand).HasMaxLength(60);
        b.Property(x => x.VehicleModel).HasMaxLength(80);
        b.Property(x => x.CancelReason).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.ScheduledAtUtc });
        b.HasIndex(x => new { x.TenantId, x.Status });
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
        // hot-path: calendar range queries across all branches
        b.HasIndex(x => new { x.TenantId, x.ScheduledAtUtc });
        // hot-path: upcoming reservations dashboard widget
        b.HasIndex(x => new { x.TenantId, x.Status, x.ScheduledAtUtc });

        b.HasMany(x => x.Services)
            .WithOne()
            .HasForeignKey(s => s.ReservationId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Metadata.FindNavigation(nameof(Reservation.Services))!.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class ReservationServiceConfiguration : IEntityTypeConfiguration<ReservationService>
{
    public void Configure(EntityTypeBuilder<ReservationService> b)
    {
        b.ToTable("ReservationServices");
        b.HasKey(x => x.Id);
        b.Property(x => x.ServiceName).IsRequired().HasMaxLength(120);
        b.HasIndex(x => new { x.TenantId, x.ReservationId });
    }
}
// resync-marker
