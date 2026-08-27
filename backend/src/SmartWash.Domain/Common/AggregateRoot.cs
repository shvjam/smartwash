namespace SmartWash.Domain.Common;

/// <summary>
/// نشان‌دهنده‌ی موجودیتی که یک توکنِ همزمانیِ اپلیکیشن‌محور (RowVersion) دارد.
/// این توکن توسط AppDbContext در هر INSERT/UPDATE مقداردهی می‌شود و به نوعِ
/// خاصِ ستونِ دیتابیس (مثل SQL Server rowversion) وابسته نیست؛ بنابراین با هر
/// migration و روی هر provider درست کار می‌کند و به اسکریپتِ جداگانه نیاز ندارد.
/// </summary>
public interface IConcurrencyStamped
{
    byte[] RowVersion { get; }
    void StampConcurrencyToken(byte[] token);
}

public abstract class AggregateRoot<TId> : Entity<TId>, IAuditable, IConcurrencyStamped where TId : notnull
{
    public DateTime CreatedAtUtc { get; protected set; }
    public Guid? CreatedByUserId { get; protected set; }
    public DateTime? UpdatedAtUtc { get; protected set; }
    public Guid? UpdatedByUserId { get; protected set; }

    public byte[] RowVersion { get; protected set; } = Array.Empty<byte>();

    public void StampConcurrencyToken(byte[] token) => RowVersion = token;
}

public abstract class TenantAggregateRoot<TId> : AggregateRoot<TId>, ITenantScoped, ISoftDeletable where TId : notnull
{
    public Guid TenantId { get; protected set; }

    // ISoftDeletable — set by AppDbContext on delete interception
    public bool IsDeleted { get; protected set; }
    public DateTime? DeletedAtUtc { get; protected set; }
    public Guid? DeletedByUserId { get; protected set; }

    public void SoftDelete(Guid? deletedBy)
    {
        IsDeleted = true;
        DeletedAtUtc = DateTime.UtcNow;
        DeletedByUserId = deletedBy;
    }
}
// resync-marker
