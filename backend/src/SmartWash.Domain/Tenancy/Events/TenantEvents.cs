using SmartWash.Domain.Common;

namespace SmartWash.Domain.Tenancy.Events;

public sealed record TenantCreatedEvent(Guid TenantId, string Slug, string OwnerEmail) : DomainEvent;
public sealed record TenantActivatedEvent(Guid TenantId) : DomainEvent;
public sealed record TenantSuspendedEvent(Guid TenantId, string Reason) : DomainEvent;
public sealed record TenantCancelledEvent(Guid TenantId) : DomainEvent;
public sealed record TenantEnteredGraceEvent(Guid TenantId) : DomainEvent;
// resync-marker
