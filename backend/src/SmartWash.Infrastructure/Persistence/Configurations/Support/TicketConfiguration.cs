using SmartWash.Domain.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SmartWash.Infrastructure.Persistence.Configurations.Support;

public sealed class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> b)
    {
        b.ToTable("Tickets");
        b.HasKey(x => x.Id);
        b.Property(x => x.Number).IsRequired().HasMaxLength(30);
        b.Property(x => x.Subject).IsRequired().HasMaxLength(200);
        b.Property(x => x.RequesterName).IsRequired().HasMaxLength(150);
        b.Property(x => x.RequesterPhone).HasMaxLength(20);
        b.Property(x => x.RelatedEntityType).HasMaxLength(60);
        b.Property(x => x.SatisfactionComment).HasMaxLength(1000);
        b.Property(x => x.Category).HasConversion<int>();
        b.Property(x => x.Priority).HasConversion<int>();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.LastMessageSide).HasConversion<int>();
        b.Property(x => x.RowVersion).IsConcurrencyToken().IsRequired().HasMaxLength(16);

        b.HasIndex(x => x.Number).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Status, x.LastMessageAtUtc });
        b.HasIndex(x => new { x.TenantId, x.Category });
        // صف پشتیبانی پلتفرم: مرتب‌سازی بر اساس اولویت و مهلت SLA
        b.HasIndex(x => new { x.Status, x.Priority, x.DueAtUtc });
        b.HasIndex(x => x.AssignedToUserId);
    }
}

public sealed class TicketMessageConfiguration : IEntityTypeConfiguration<TicketMessage>
{
    public void Configure(EntityTypeBuilder<TicketMessage> b)
    {
        b.ToTable("TicketMessages");
        b.HasKey(x => x.Id);
        b.Property(x => x.AuthorName).IsRequired().HasMaxLength(150);
        b.Property(x => x.Body).IsRequired().HasMaxLength(4000);
        b.Property(x => x.AuthorSide).HasConversion<int>();
        b.HasIndex(x => new { x.TicketId, x.CreatedAtUtc });
        b.HasIndex(x => new { x.TenantId, x.TicketId });
    }
}

public sealed class TicketAttachmentConfiguration : IEntityTypeConfiguration<TicketAttachment>
{
    public void Configure(EntityTypeBuilder<TicketAttachment> b)
    {
        b.ToTable("TicketAttachments");
        b.HasKey(x => x.Id);
        b.Property(x => x.FileName).IsRequired().HasMaxLength(260);
        b.Property(x => x.Path).IsRequired().HasMaxLength(500);
        b.Property(x => x.Url).IsRequired().HasMaxLength(500);
        b.Property(x => x.ContentType).IsRequired().HasMaxLength(120);
        b.HasIndex(x => new { x.TicketId, x.CreatedAtUtc });
        b.HasIndex(x => x.MessageId);
    }
}

public sealed class TicketEventConfiguration : IEntityTypeConfiguration<TicketEvent>
{
    public void Configure(EntityTypeBuilder<TicketEvent> b)
    {
        b.ToTable("TicketEvents");
        b.HasKey(x => x.Id);
        b.Property(x => x.ActorName).IsRequired().HasMaxLength(150);
        b.Property(x => x.FromValue).HasMaxLength(100);
        b.Property(x => x.ToValue).HasMaxLength(100);
        b.Property(x => x.Note).HasMaxLength(1000);
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.ActorSide).HasConversion<int>();
        b.HasIndex(x => new { x.TicketId, x.OccurredAtUtc });
    }
}
