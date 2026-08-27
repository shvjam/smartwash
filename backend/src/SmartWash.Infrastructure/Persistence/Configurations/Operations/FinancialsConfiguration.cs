using SmartWash.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations.Operations;

public sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> b)
    {
        b.ToTable("Expenses");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).IsRequired().HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.ReceiptUrl).HasMaxLength(500);
        b.Property(x => x.Category).HasConversion<int>();
        b.Property(x => x.PaymentMethod).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.Date });
        b.HasIndex(x => new { x.TenantId, x.Category });
    }
}

public sealed class ShiftConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> b)
    {
        b.ToTable("Shifts");
        b.HasKey(x => x.Id);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.Ignore(x => x.Variance);
        b.HasIndex(x => new { x.TenantId, x.BranchId, x.Status });
        b.HasIndex(x => new { x.TenantId, x.OpenedAtUtc });
    }
}

public sealed class WalletTransactionConfiguration : IEntityTypeConfiguration<WalletTransaction>
{
    public void Configure(EntityTypeBuilder<WalletTransaction> b)
    {
        b.ToTable("WalletTransactions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => new { x.TenantId, x.CustomerId, x.OccurredAtUtc });
    }
}

public sealed class LoyaltyTransactionConfiguration : IEntityTypeConfiguration<LoyaltyTransaction>
{
    public void Configure(EntityTypeBuilder<LoyaltyTransaction> b)
    {
        b.ToTable("LoyaltyTransactions");
        b.HasKey(x => x.Id);
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => new { x.TenantId, x.CustomerId, x.OccurredAtUtc });
    }
}

public sealed class UsageEventConfiguration : IEntityTypeConfiguration<UsageEvent>
{
    public void Configure(EntityTypeBuilder<UsageEvent> b)
    {
        b.ToTable("UsageEvents");
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.TenantId, x.PeriodDate });
        b.HasIndex(x => new { x.TenantId, x.Invoiced });
        b.HasIndex(x => new { x.TenantId, x.OrderId }).IsUnique();
    }
}
// resync-marker
