using System.Text.Json;
using SmartWash.Domain.Billing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations;

public sealed class PlanConfiguration : IEntityTypeConfiguration<Plan>
{
    public void Configure(EntityTypeBuilder<Plan> b)
    {
        b.ToTable("Plans");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).IsRequired().HasMaxLength(40);
        b.HasIndex(x => x.Code).IsUnique();
        b.Property(x => x.DisplayName).IsRequired().HasMaxLength(120);
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.BillingModel).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);

        // PlanTierBracket is an immutable record (value equality), so element-wise
        // sequence comparison + a fresh array snapshot let EF correctly detect
        // changes to the JSON-converted collection.
        var bracketsComparer = new ValueComparer<PlanTierBracket[]>(
            (a, c) => (a == null && c == null) || (a != null && c != null && a.SequenceEqual(c)),
            v => v.Aggregate(0, (acc, x) => HashCode.Combine(acc, x.GetHashCode())),
            v => v.ToArray());

        b.Property(x => x.PerCarBrackets)
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<PlanTierBracket[]>(v, (JsonSerializerOptions?)null) ?? Array.Empty<PlanTierBracket>())
            .HasColumnType("nvarchar(max)")
            .Metadata.SetValueComparer(bracketsComparer);

        b.HasMany(x => x.Features)
            .WithOne()
            .HasForeignKey(f => f.PlanId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PlanFeatureConfiguration : IEntityTypeConfiguration<PlanFeature>
{
    public void Configure(EntityTypeBuilder<PlanFeature> b)
    {
        b.ToTable("PlanFeatures");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).IsRequired().HasMaxLength(60);
        b.Property(x => x.Value).IsRequired().HasMaxLength(500);
        b.HasIndex(x => new { x.PlanId, x.Key }).IsUnique();
    }
}
// resync-marker

public sealed class PlatformSmsTemplateConfiguration : IEntityTypeConfiguration<PlatformSmsTemplate>
{
    public void Configure(EntityTypeBuilder<PlatformSmsTemplate> b)
    {
        b.ToTable("PlatformSmsTemplates"); b.HasKey(x => x.Id);
        b.Property(x => x.Code).IsRequired().HasMaxLength(80); b.HasIndex(x => x.Code).IsUnique();
        b.Property(x => x.DisplayName).IsRequired().HasMaxLength(160);
        b.Property(x => x.ParametersJson).IsRequired().HasMaxLength(2000);
        b.Property(x => x.Category).HasConversion<int>();
    }
}
public sealed class TenantSmsTemplateConfiguration : IEntityTypeConfiguration<TenantSmsTemplate>
{
    public void Configure(EntityTypeBuilder<TenantSmsTemplate> b)
    { b.ToTable("TenantSmsTemplates"); b.HasKey(x => x.Id); b.HasIndex(x => new { x.TenantId, x.TemplateId }).IsUnique(); }
}
public sealed class SmsUsageRecordConfiguration : IEntityTypeConfiguration<SmsUsageRecord>
{
    public void Configure(EntityTypeBuilder<SmsUsageRecord> b)
    {
        b.ToTable("SmsUsageRecords"); b.HasKey(x => x.Id); b.Property(x => x.Purpose).IsRequired().HasMaxLength(80);
        b.Property(x => x.Recipient).IsRequired().HasMaxLength(20); b.Property(x => x.Error).HasMaxLength(1000);
        b.Property(x => x.Status).HasConversion<int>(); b.HasIndex(x => new { x.TenantId, x.Status, x.OccurredAtUtc });
        b.Property(x => x.ProviderMessageId).HasMaxLength(80);
        // مسیرِ داغِ صورتحساب: ردیف‌های موفقِ یک دوره اشتراک.
        b.HasIndex(x => new { x.TenantId, x.SubscriptionId, x.Status });
        b.HasIndex(x => new { x.TemplateId, x.OccurredAtUtc });
    }
}
public sealed class PlatformSmsSettingsConfiguration : IEntityTypeConfiguration<PlatformSmsSettings>
{
    public void Configure(EntityTypeBuilder<PlatformSmsSettings> b)
    {
        b.ToTable("PlatformSmsSettings"); b.HasKey(x => x.Id);
        b.Property(x => x.Provider).IsRequired().HasMaxLength(60);
        b.Property(x => x.BaseUrl).IsRequired().HasMaxLength(300);
        b.Property(x => x.ApiKey).HasMaxLength(300);
        b.Property(x => x.LineNumber).HasMaxLength(40);
        b.Property(x => x.LastTestMessage).HasMaxLength(500);
    }
}
