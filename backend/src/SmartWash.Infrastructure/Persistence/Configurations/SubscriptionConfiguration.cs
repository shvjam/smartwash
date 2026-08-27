using SmartWash.Domain.Billing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations;

public sealed class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> b)
    {
        b.ToTable("Subscriptions");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.TenantId);
        b.HasIndex(x => new { x.TenantId, x.Status });
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Cycle).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
    }
}

public sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> b)
    {
        b.ToTable("Invoices");
        b.HasKey(x => x.Id);
        b.Property(x => x.Number).IsRequired().HasMaxLength(40);
        b.HasIndex(x => x.Number).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Status });
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasMany(x => x.Lines).WithOne().HasForeignKey(l => l.InvoiceId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class InvoiceLineConfiguration : IEntityTypeConfiguration<InvoiceLine>
{
    public void Configure(EntityTypeBuilder<InvoiceLine> b)
    {
        b.ToTable("InvoiceLines");
        b.HasKey(x => x.Id);
        b.Property(x => x.Description).IsRequired().HasMaxLength(300);
    }
}

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.ToTable("Payments");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.InvoiceId);
        b.HasIndex(x => x.Authority);
        b.Property(x => x.Authority).HasMaxLength(100);
        b.Property(x => x.ReferenceId).HasMaxLength(100);
        b.Property(x => x.CallbackUrl).IsRequired().HasMaxLength(500);
        b.Property(x => x.RawResponse).HasMaxLength(4000);
        b.Property(x => x.Gateway).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
    }
}
// resync-marker
