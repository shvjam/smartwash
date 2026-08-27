using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

public sealed class Shift : TenantAggregateRoot<Guid>
{
    private Shift() { }

    public Guid BranchId { get; private set; }
    public Guid OpenedByUserId { get; private set; }
    public Guid? ClosedByUserId { get; private set; }
    public DateTime OpenedAtUtc { get; private set; }
    public DateTime? ClosedAtUtc { get; private set; }
    public long OpeningCashRials { get; private set; }
    public long ClosingCashRials { get; private set; }
    public long ExpectedCashRials { get; private set; }
    public long CashSalesRials { get; private set; }
    public long CardSalesRials { get; private set; }
    public long OnlineSalesRials { get; private set; }
    public long TipsRials { get; private set; }       // جمع انعام پرسنل در این شیفت
    public long WalletSalesRials { get; private set; } // جمع پرداخت با کیف پول
    public long ExpensesRials { get; private set; }
    public int OrderCount { get; private set; }
    public ShiftStatus Status { get; private set; }
    public string? Notes { get; private set; }

    public static Shift Open(Guid tenantId, Guid branchId, Guid openedByUserId, long openingCash)
    {
        return new Shift
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            OpenedByUserId = openedByUserId,
            OpenedAtUtc = DateTime.UtcNow,
            OpeningCashRials = openingCash,
            Status = ShiftStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void RegisterOrder(long cashAmount, long cardAmount, long onlineAmount, long tipsAmount = 0, long walletAmount = 0)
    {
        if (Status != ShiftStatus.Open) throw new DomainException("Shift.Closed", "شیفت بسته است.");
        CashSalesRials += cashAmount;
        CardSalesRials += cardAmount;
        OnlineSalesRials += onlineAmount;
        TipsRials += tipsAmount;
        WalletSalesRials += walletAmount;
        OrderCount++;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RegisterExpense(long amount)
    {
        if (Status != ShiftStatus.Open) throw new DomainException("Shift.Closed", "شیفت بسته است.");
        ExpensesRials += amount;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// اصلاحِ مبلغِ هزینه‌ی نقدیِ ثبت‌شده در شیفت (هنگام ویرایشِ یک هزینه). delta می‌تواند منفی باشد
    /// (کاهش مبلغ یا تبدیل روش پرداخت از نقدی به غیرنقدی). مجموع هرگز زیر صفر نمی‌رود.
    /// </summary>
    public void AdjustExpense(long delta)
    {
        if (Status != ShiftStatus.Open) throw new DomainException("Shift.Closed", "شیفت بسته است.");
        ExpensesRials = Math.Max(0, ExpensesRials + delta);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Close(Guid closedByUserId, long closingCash, string? notes)
    {
        if (Status != ShiftStatus.Open) throw new DomainException("Shift.AlreadyClosed", "شیفت قبلاً بسته شده.");
        Status = ShiftStatus.Closed;
        ClosedByUserId = closedByUserId;
        ClosedAtUtc = DateTime.UtcNow;
        ClosingCashRials = closingCash;
        ExpectedCashRials = OpeningCashRials + CashSalesRials - ExpensesRials;
        Notes = notes;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public long Variance => ClosingCashRials - ExpectedCashRials;
}

public enum ShiftStatus
{
    Open = 0,
    Closed = 1
}
// resync-marker
