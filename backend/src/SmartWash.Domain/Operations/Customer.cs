using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Operations;

public sealed class Customer : TenantAggregateRoot<Guid>
{
    private readonly List<CustomerVehicle> _vehicles = new();

    private Customer() { }

    public string FullName { get; private set; } = null!;
    public string Phone { get; private set; } = null!;
    public string? Email { get; private set; }
    public string? NationalId { get; private set; }
    public DateOnly? BirthDate { get; private set; }
    public Gender Gender { get; private set; }
    public string? Address { get; private set; }
    public string? Notes { get; private set; }
    public long WalletBalanceRials { get; private set; }
    public int LoyaltyPoints { get; private set; }
    public LoyaltyTier Tier { get; private set; }
    public int TotalVisits { get; private set; }
    public long LifetimeSpendRials { get; private set; }
    public DateTime? LastVisitAtUtc { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int FreeServicesUsed { get; private set; }

    public IReadOnlyCollection<CustomerVehicle> Vehicles => _vehicles.AsReadOnly();

    public static Customer Create(Guid tenantId, string fullName, string phone, string? email)
    {
        if (string.IsNullOrWhiteSpace(phone)) throw new DomainException("Customer.PhoneRequired", "شماره موبایل الزامی است.");
        return new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FullName = fullName.Trim(),
            Phone = phone.Trim(),
            Email = email?.Trim(),
            Tier = LoyaltyTier.Bronze,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void Update(string fullName, string phone, string? email, string? nationalId, DateOnly? birthDate, Gender gender, string? address, string? notes)
    {
        FullName = fullName.Trim();
        Phone = phone.Trim();
        Email = email?.Trim();
        NationalId = nationalId?.Trim();
        BirthDate = birthDate;
        Gender = gender;
        Address = address?.Trim();
        Notes = notes?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public CustomerVehicle AddVehicle(string plate, string brand, string model, string? color, int? year)
    {
        var v = new CustomerVehicle(Id, TenantId, plate, brand, model, color, year);
        _vehicles.Add(v);
        UpdatedAtUtc = DateTime.UtcNow;
        return v;
    }

    public void RemoveVehicle(Guid vehicleId)
    {
        var v = _vehicles.FirstOrDefault(x => x.Id == vehicleId);
        if (v is not null) _vehicles.Remove(v);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AdjustWallet(long deltaRials)
    {
        if (WalletBalanceRials + deltaRials < 0)
            throw new DomainException("Customer.InsufficientWallet", "موجودی کیف پول کافی نیست.");
        WalletBalanceRials += deltaRials;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AddLoyaltyPoints(int points)
    {
        LoyaltyPoints += points;
        RecalculateTier();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RedeemLoyaltyPoints(int points)
    {
        if (LoyaltyPoints < points)
            throw new DomainException("Customer.InsufficientPoints", "امتیاز کافی نیست.");
        LoyaltyPoints -= points;
        RecalculateTier();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RecordVisit(long spentRials)
    {
        TotalVisits++;
        LifetimeSpendRials += spentRials;
        LastVisitAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// تعداد خدمات رایگانی که از طریق سیستم وفاداری دریافت کرده (هر ۳ مراجعه = ۱)
    /// </summary>
    public int EarnedFreeServices => TotalVisits / 3;

    /// <summary>
    /// آیا مشتری واجد دریافت خدمت رایگان هست؟
    /// </summary>
    public bool HasFreeServiceAvailable => EarnedFreeServices > FreeServicesUsed;

    public void UseFreeService()
    {
        if (!HasFreeServiceAvailable)
            throw new DomainException("Customer.NoFreeService", "مشتری واجد دریافت خدمت رایگان نیست.");
        FreeServicesUsed++;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// برگرداندن خدمت رایگانِ مصرف‌شده (مثلاً هنگام لغو سفارشی که خدمت رایگان روی آن اعمال شده بود).
    /// </summary>
    public void RestoreFreeService()
    {
        if (FreeServicesUsed > 0) FreeServicesUsed--;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    private void RecalculateTier()
    {
        Tier = LoyaltyPoints switch
        {
            >= 10000 => LoyaltyTier.Diamond,
            >= 5000 => LoyaltyTier.Platinum,
            >= 2000 => LoyaltyTier.Gold,
            >= 500 => LoyaltyTier.Silver,
            _ => LoyaltyTier.Bronze
        };
    }

    public void Activate() { IsActive = true; UpdatedAtUtc = DateTime.UtcNow; }
    public void Deactivate() { IsActive = false; UpdatedAtUtc = DateTime.UtcNow; }
}

public sealed class CustomerVehicle : Entity<Guid>, ITenantScoped
{
    private CustomerVehicle() { }

    internal CustomerVehicle(Guid customerId, Guid tenantId, string plate, string brand, string model, string? color, int? year)
    {
        Id = Guid.NewGuid();
        CustomerId = customerId;
        TenantId = tenantId;
        Plate = plate.Trim();
        Brand = brand.Trim();
        Model = model.Trim();
        Color = color?.Trim();
        Year = year;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid CustomerId { get; private set; }
    public Guid TenantId { get; private set; }
    public string Plate { get; private set; } = null!;
    public string Brand { get; private set; } = null!;
    public string Model { get; private set; } = null!;
    public string? Color { get; private set; }
    public int? Year { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
}

public enum LoyaltyTier
{
    Bronze = 0,
    Silver = 1,
    Gold = 2,
    Platinum = 3,
    Diamond = 4
}

public enum Gender
{
    Unknown = 0,
    Male = 1,
    Female = 2
}
// resync-marker
