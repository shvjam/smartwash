using SmartWash.Domain.Common;

namespace SmartWash.Domain.Audit;

public sealed class AuditLog : Entity<Guid>
{
    private AuditLog() { }

    public AuditLog(Guid? tenantId, Guid? userId, string action, string entityName,
        string entityId, string? oldValues, string? newValues, string? ipAddress, string? userAgent, string? correlationId)
    {
        Id = Guid.NewGuid();
        TenantId = tenantId;
        UserId = userId;
        Action = action;
        EntityName = entityName;
        EntityId = entityId;
        OldValues = oldValues;
        NewValues = newValues;
        IpAddress = ipAddress;
        UserAgent = userAgent;
        CorrelationId = correlationId;
        OccurredAtUtc = DateTime.UtcNow;
    }

    public Guid? TenantId { get; private set; }
    public Guid? UserId { get; private set; }
    public string Action { get; private set; } = null!;
    public string EntityName { get; private set; } = null!;
    public string EntityId { get; private set; } = null!;
    public string? OldValues { get; private set; }
    public string? NewValues { get; private set; }
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public string? CorrelationId { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }
}
// resync-marker
