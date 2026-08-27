using SmartWash.Domain.Common;

namespace SmartWash.Domain.Operations;

public sealed class WalletTransaction : Entity<Guid>, ITenantScoped
{
    private WalletTransaction() { }

    public WalletTransaction(Guid tenantId, Guid customerId, WalletTransactionType type, long amount, long balanceAfter, string? description, Guid? relatedOrderId)
    {
        Id = Guid.NewGuid();
        TenantId = tenantId;
        CustomerId = customerId;
        Type = type;
        AmountRials = amount;
        BalanceAfterRials = balanceAfter;
        Description = description;
        RelatedOrderId = relatedOrderId;
        OccurredAtUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public Guid CustomerId { get; private set; }
    public WalletTransactionType Type { get; private set; }
    public long AmountRials { get; private set; }
    public long BalanceAfterRials { get; private set; }
    public string? Description { get; private set; }
    public Guid? RelatedOrderId { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }
}

public enum WalletTransactionType
{
    Charge = 0,
    Spend = 1,
    Refund = 2,
    Adjustment = 3
}

public sealed class LoyaltyTransaction : Entity<Guid>, ITenantScoped
{
    private LoyaltyTransaction() { }

    public LoyaltyTransaction(Guid tenantId, Guid customerId, LoyaltyTransactionType type, int points, int balanceAfter, string? description, Guid? relatedOrderId)
    {
        Id = Guid.NewGuid();
        TenantId = tenantId;
        CustomerId = customerId;
        Type = type;
        Points = points;
        BalanceAfter = balanceAfter;
        Description = description;
        RelatedOrderId = relatedOrderId;
        OccurredAtUtc = DateTime.UtcNow;
    }

    public Guid TenantId { get; private set; }
    public Guid CustomerId { get; private set; }
    public LoyaltyTransactionType Type { get; private set; }
    public int Points { get; private set; }
    public int BalanceAfter { get; private set; }
    public string? Description { get; private set; }
    public Guid? RelatedOrderId { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }
}

public enum LoyaltyTransactionType
{
    Earned = 0,
    Redeemed = 1,
    Expired = 2,
    Adjustment = 3
}
// resync-marker
