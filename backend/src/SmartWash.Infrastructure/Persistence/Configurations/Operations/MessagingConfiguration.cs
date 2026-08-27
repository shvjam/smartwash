using SmartWash.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations.Operations;

public sealed class CampaignConfiguration : IEntityTypeConfiguration<Campaign>
{
    public void Configure(EntityTypeBuilder<Campaign> b)
    {
        b.ToTable("Campaigns");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).IsRequired().HasMaxLength(150);
        b.Property(x => x.MessageTemplate).IsRequired().HasMaxLength(2000);
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.Target).HasConversion<int>();
        b.Property(x => x.TargetMinTier).HasConversion<int?>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);
        b.HasIndex(x => new { x.TenantId, x.Status });
        b.HasIndex(x => new { x.TenantId, x.ScheduledAtUtc });
    }
}

public sealed class AppNotificationConfiguration : IEntityTypeConfiguration<AppNotification>
{
    public void Configure(EntityTypeBuilder<AppNotification> b)
    {
        b.ToTable("AppNotifications");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).IsRequired().HasMaxLength(200);
        b.Property(x => x.Body).IsRequired().HasMaxLength(2000);
        b.Property(x => x.EntityType).HasMaxLength(60);
        b.Property(x => x.Type).HasConversion<int>();
        b.HasIndex(x => new { x.TenantId, x.IsRead, x.CreatedAtUtc });
        b.HasIndex(x => new { x.TenantId, x.UserId, x.IsRead });
    }
}

public sealed class SmsMessageConfiguration : IEntityTypeConfiguration<SmsMessage>
{
    public void Configure(EntityTypeBuilder<SmsMessage> b)
    {
        b.ToTable("SmsMessages");
        b.HasKey(x => x.Id);
        b.Property(x => x.Phone).IsRequired().HasMaxLength(20);
        b.Property(x => x.Body).IsRequired().HasMaxLength(2000);
        b.Property(x => x.ProviderMessageId).HasMaxLength(120);
        b.Property(x => x.Error).HasMaxLength(1000);
        b.Property(x => x.Kind).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAtUtc });
    }
}

public sealed class ServiceReminderConfiguration : IEntityTypeConfiguration<ServiceReminder>
{
    public void Configure(EntityTypeBuilder<ServiceReminder> b)
    {
        b.ToTable("ServiceReminders");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).IsRequired().HasMaxLength(200);
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.HasIndex(x => new { x.TenantId, x.Status, x.DueAtUtc });
        b.HasIndex(x => new { x.TenantId, x.CustomerId });
    }
}

public sealed class TenantSettingsConfiguration : IEntityTypeConfiguration<TenantSettings>
{
    public void Configure(EntityTypeBuilder<TenantSettings> b)
    {
        b.ToTable("TenantSettings");
        b.HasKey(x => x.Id);
        b.Property(x => x.SmsSenderNumber).HasMaxLength(20);
        b.Property(x => x.SmsProvider).HasMaxLength(60);
        b.Property(x => x.ReceiptHeader).IsRequired().HasMaxLength(200);
        b.Property(x => x.ReceiptFooter).HasMaxLength(500);
        b.Property(x => x.InvoicePrefix).HasMaxLength(10);
        b.Property(x => x.Tagline).HasMaxLength(200);
        b.Property(x => x.Theme).IsRequired().HasMaxLength(20);
        b.Property(x => x.PrimaryColor).HasMaxLength(20);
        b.Property(x => x.LogoUrl).HasMaxLength(500);
        b.HasIndex(x => x.TenantId).IsUnique();
    }
}
// resync-marker
