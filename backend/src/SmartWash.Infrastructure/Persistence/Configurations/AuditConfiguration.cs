using SmartWash.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations;

public sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.ToTable("AuditLogs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Action).IsRequired().HasMaxLength(60);
        b.Property(x => x.EntityName).IsRequired().HasMaxLength(100);
        b.Property(x => x.EntityId).IsRequired().HasMaxLength(60);
        b.Property(x => x.OldValues).HasColumnType("nvarchar(max)");
        b.Property(x => x.NewValues).HasColumnType("nvarchar(max)");
        b.Property(x => x.IpAddress).HasMaxLength(60);
        b.Property(x => x.UserAgent).HasMaxLength(300);
        b.Property(x => x.CorrelationId).HasMaxLength(60);
        b.HasIndex(x => new { x.TenantId, x.OccurredAtUtc });
        b.HasIndex(x => new { x.EntityName, x.EntityId });
    }
}

public sealed class CronJobRunConfiguration : IEntityTypeConfiguration<CronJobRun>
{
    public void Configure(EntityTypeBuilder<CronJobRun> b)
    {
        b.ToTable("CronJobRuns");
        b.HasKey(x => x.Id);
        b.Property(x => x.JobName).IsRequired().HasMaxLength(80);
        b.HasIndex(x => new { x.JobName, x.StartedAtUtc });
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.CorrelationId).HasMaxLength(60);
        b.Property(x => x.ErrorMessage).HasColumnType("nvarchar(max)");
    }
}
// resync-marker
