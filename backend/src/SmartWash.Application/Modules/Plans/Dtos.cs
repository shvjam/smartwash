using SmartWash.Domain.Billing;

namespace SmartWash.Application.Modules.Plans;

public sealed record PlanDto(
    Guid Id,
    string Code,
    string DisplayName,
    string? Description,
    PlanBillingModel BillingModel,
    long SetupFeeRials,
    long MonthlyPriceRials,
    long YearlyPriceRials,
    long PerCarPriceRials,
    int? IncludedCarsPerMonth,
    PlanTierBracket[] PerCarBrackets,
    int SortOrder,
    bool IsActive,
    bool IsPublic,
    IReadOnlyCollection<PlanFeatureDto> Features);

public sealed record PlanFeatureDto(string Key, string Value);
// resync-marker
