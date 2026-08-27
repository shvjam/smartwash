using SmartWash.Domain.Common;

namespace SmartWash.Domain.Operations;

public sealed class Expense : TenantAggregateRoot<Guid>
{
    private Expense() { }

    public Guid BranchId { get; private set; }
    public ExpenseCategory Category { get; private set; }
    public string Title { get; private set; } = null!;
    public long AmountRials { get; private set; }
    public PaymentMethod PaymentMethod { get; private set; }
    public DateOnly Date { get; private set; }
    public string? Description { get; private set; }
    public string? ReceiptUrl { get; private set; }
    public Guid? RelatedWorkerId { get; private set; }

    public static Expense Create(Guid tenantId, Guid branchId, ExpenseCategory category, string title,
        long amount, PaymentMethod method, DateOnly date, string? description, Guid? workerId)
    {
        return new Expense
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            Category = category,
            Title = title.Trim(),
            AmountRials = amount,
            PaymentMethod = method,
            Date = date,
            Description = description?.Trim(),
            RelatedWorkerId = workerId,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void Update(ExpenseCategory category, string title, long amount, PaymentMethod method, DateOnly date, string? description)
    {
        Category = category;
        Title = title.Trim();
        AmountRials = amount;
        PaymentMethod = method;
        Date = date;
        Description = description?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AttachReceipt(string url) { ReceiptUrl = url; UpdatedAtUtc = DateTime.UtcNow; }
}

public enum ExpenseCategory
{
    Salary = 0,
    Commission = 1,
    Supplies = 2,
    Utilities = 3,
    Rent = 4,
    Maintenance = 5,
    Marketing = 6,
    Tax = 7,
    Other = 99
}
// resync-marker
