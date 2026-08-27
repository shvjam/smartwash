namespace SmartWash.Application.Abstractions.CrossCutting;

public interface ICorrelationContext
{
    string CorrelationId { get; }
    void Set(string correlationId);
}

public interface IAuditWriter
{
    Task WriteAsync(string action, string entityName, string entityId, object? oldValues, object? newValues, CancellationToken ct = default);
}
// resync-marker
