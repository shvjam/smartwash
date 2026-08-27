using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Billing;

public sealed class Plan : AggregateRoot<Guid>
{
    private readonly List<PlanFeature> _features = new();

    private Plan() { }

    public string Code { get; private set; } = null!;
    public string DisplayName { get; private set; } = null!;
    public string? Description { get; private set; }
    public PlanBillingModel BillingModel { get; private set; }
    public long SetupFeeRials { get; private set; }
    public long MonthlyPriceRials { get; private set; }
    public long YearlyPriceRials { get; private set; }
    public long PerCarPriceRials { get; private set; }
    public int? IncludedCarsPerMonth { get; private set; }
    /// <summary>Monthly included platform SMS units. Null means no included quota.</summary>
    public int IncludedSmsPerMonth { get; private set; }
    /// <summary>Maximum centrally managed templates a tenant can activate.</summary>
    public int IncludedSmsTemplateCount { get; private set; }
    public long SmsOverageUnitPriceRials { get; private set; }
    public PlanTierBracket[] PerCarBrackets { get; private set; } = Array.Empty<PlanTierBracket>();
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsPublic { get; private set; }

    public IReadOnlyCollection<PlanFeature> Features => _features.AsReadOnly();

    public static Plan Create(string code, string displayName, PlanBillingModel model,
        long setupFee, long monthly, long yearly, long perCar, int sortOrder, bool isPublic = true)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new DomainException("Plan.CodeRequired", "کد پلن الزامی است.");
        return new Plan
        {
            Id = Guid.NewGuid(),
            Code = code.Trim().ToLowerInvariant(),
            DisplayName = displayName.Trim(),
            BillingModel = model,
            SetupFeeRials = setupFee,
            MonthlyPriceRials = monthly,
            YearlyPriceRials = yearly,
            PerCarPriceRials = perCar,
            SortOrder = sortOrder,
            IsActive = true,
            IsPublic = isPublic,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void UpdateSmsPolicy(int includedSmsPerMonth, int includedSmsTemplateCount, long smsOverageUnitPriceRials)
    {
        IncludedSmsPerMonth = Math.Max(0, includedSmsPerMonth);
        IncludedSmsTemplateCount = Math.Max(0, includedSmsTemplateCount);
        SmsOverageUnitPriceRials = Math.Max(0, smsOverageUnitPriceRials);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetBrackets(IEnumerable<PlanTierBracket> brackets) =>
        PerCarBrackets = brackets.OrderBy(b => b.FromCar).ToArray();

    public void AddFeature(string key, string value)
    {
        var existing = _features.FirstOrDefault(f => f.Key == key);
        if (existing is not null) { existing.Update(value); return; }
        _features.Add(new PlanFeature(Id, key, value));
    }

    public void RemoveFeature(string key)
    {
        var existing = _features.FirstOrDefault(f => f.Key == key);
        if (existing is not null) _features.Remove(existing);
    }

    public void ReplaceFeatures(IEnumerable<(string Key, string Value)> features)
    {
        _features.Clear();
        foreach (var f in features) _features.Add(new PlanFeature(Id, f.Key, f.Value));
    }

    public void UpdateDetails(string displayName, long setupFee, long monthly, long yearly, long perCar, int sortOrder, bool isPublic)
    {
        if (string.IsNullOrWhiteSpace(displayName)) throw new DomainException("Plan.NameRequired", "نام پلن الزامی است.");
        DisplayName = displayName.Trim();
        SetupFeeRials = setupFee;
        MonthlyPriceRials = monthly;
        YearlyPriceRials = yearly;
        PerCarPriceRials = perCar;
        SortOrder = sortOrder;
        IsPublic = isPublic;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetDescription(string? description) => Description = description;
    public void Deactivate() { IsActive = false; UpdatedAtUtc = DateTime.UtcNow; }
    public void Activate() { IsActive = true; UpdatedAtUtc = DateTime.UtcNow; }
}

public sealed record PlanTierBracket(int FromCar, int? ToCar, long PricePerCarRials);

public enum PlanBillingModel
{
    Subscription = 0,
    UsageBased = 1,
    Hybrid = 2
}

public sealed class PlanFeature : Entity<Guid>
{
    private PlanFeature() { }

    internal PlanFeature(Guid planId, string key, string value)
    {
        Id = Guid.NewGuid();
        PlanId = planId;
        Key = key;
        Value = value;
    }

    public static PlanFeature Create(Guid planId, string key, string value) =>
        new(planId, key.Trim(), value.Trim());

    public Guid PlanId { get; private set; }
    public string Key { get; private set; } = null!;
    public string Value { get; private set; } = null!;

    internal void Update(string value) => Value = value;
}
// resync-marker
