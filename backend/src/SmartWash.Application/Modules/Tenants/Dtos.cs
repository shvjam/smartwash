using SmartWash.Domain.Billing;
using SmartWash.Domain.Tenancy;

namespace SmartWash.Application.Modules.Tenants;

public sealed record TenantDto(
    Guid Id,
    string Slug,
    string DisplayName,
    string OwnerEmail,
    string? OwnerPhone,
    string? LogoUrl,
    string? PrimaryColor,
    TenantStatus Status,
    DateTime? TrialEndsAtUtc,
    Guid? ActiveSubscriptionId,
    DateTime CreatedAtUtc);

public sealed record TenantSummaryDto(
    Guid Id,
    string Slug,
    string DisplayName,
    TenantStatus Status,
    DateTime? TrialEndsAtUtc,
    DateTime CreatedAtUtc,
    string OwnerEmail,
    SubscriptionStatus? SubscriptionStatus,
    string? PlanCode,
    DateTime? ActiveUntilUtc);
// resync-marker
