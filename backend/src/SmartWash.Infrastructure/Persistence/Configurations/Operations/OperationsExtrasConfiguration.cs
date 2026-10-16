using SmartWash.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations.Operations;

public sealed class BayDowntimeConfiguration : IEntityTypeConfiguration<BayDowntime>
{
    public void Configure(EntityTypeBuilder<BayDowntime> b)
    {
        b.ToTable("BayDowntimes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Reason).HasConversion<int>();
        b.Property(x => x.Note).HasMaxLength(400);
        b.Ignore(x => x.MinutesLost);
        // The history of one bay, and the open period at the end of it.
        b.HasIndex(x => new { x.BayId, x.FromUtc });
        b.HasIndex(x => new { x.TenantId, x.ToUtc });
    }
}

public sealed class OrderBayVisitConfiguration : IEntityTypeConfiguration<OrderBayVisit>
{
    public void Configure(EntityTypeBuilder<OrderBayVisit> b)
    {
        b.ToTable("OrderBayVisits");
        b.HasKey(x => x.Id);
        b.Property(x => x.Stage).HasConversion<int>();
        b.Ignore(x => x.Minutes);
        b.HasIndex(x => new { x.OrderId, x.EnteredAtUtc });
        // "What did bay 9 handle this week" reads straight off this.
        b.HasIndex(x => new { x.TenantId, x.BayId, x.EnteredAtUtc });
    }
}

public sealed class ShiftRosterConfiguration : IEntityTypeConfiguration<ShiftRoster>
{
    public void Configure(EntityTypeBuilder<ShiftRoster> b)
    {
        b.ToTable("ShiftRosters");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).IsRequired().HasMaxLength(80);
        b.Property(x => x.Notes).HasMaxLength(500);
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.Ignore(x => x.HeadCount);
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.Date });

        b.HasMany(x => x.Assignments)
            .WithOne()
            .HasForeignKey(a => a.ShiftRosterId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Metadata.FindNavigation(nameof(ShiftRoster.Assignments))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class ShiftAssignmentConfiguration : IEntityTypeConfiguration<ShiftAssignment>
{
    public void Configure(EntityTypeBuilder<ShiftAssignment> b)
    {
        b.ToTable("ShiftAssignments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Role).HasConversion<int>();
        b.Property(x => x.Note).HasMaxLength(300);
        b.HasIndex(x => new { x.TenantId, x.WorkerId });
        b.HasIndex(x => new { x.TenantId, x.BayId });
    }
}

public sealed class TipSettlementConfiguration : IEntityTypeConfiguration<TipSettlement>
{
    public void Configure(EntityTypeBuilder<TipSettlement> b)
    {
        b.ToTable("TipSettlements");
        b.HasKey(x => x.Id);
        b.Property(x => x.WorkerName).IsRequired().HasMaxLength(150);
        b.Property(x => x.Note).HasMaxLength(500);
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.Ignore(x => x.DifferenceRials);
        // "What is still owed to this person" walks back from the newest settlement.
        b.HasIndex(x => new { x.TenantId, x.WorkerId, x.PeriodToUtc });
    }
}
