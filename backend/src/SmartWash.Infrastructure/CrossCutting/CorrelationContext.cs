using SmartWash.Application.Abstractions.CrossCutting;

namespace SmartWash.Infrastructure.CrossCutting;

public sealed class CorrelationContext : ICorrelationContext
{
    public string CorrelationId { get; private set; } = Guid.NewGuid().ToString("N");
    public void Set(string correlationId) =>
        CorrelationId = string.IsNullOrWhiteSpace(correlationId) ? Guid.NewGuid().ToString("N") : correlationId;
}
// resync-marker
