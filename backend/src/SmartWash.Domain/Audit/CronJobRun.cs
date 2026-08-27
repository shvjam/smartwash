using SmartWash.Domain.Common;

namespace SmartWash.Domain.Audit;

public sealed class CronJobRun : Entity<Guid>
{
    private CronJobRun() { }

    public CronJobRun(string jobName, string? correlationId)
    {
        Id = Guid.NewGuid();
        JobName = jobName;
        CorrelationId = correlationId;
        StartedAtUtc = DateTime.UtcNow;
        Status = CronJobStatus.Running;
    }

    public string JobName { get; private set; } = null!;
    public string? CorrelationId { get; private set; }
    public DateTime StartedAtUtc { get; private set; }
    public DateTime? FinishedAtUtc { get; private set; }
    public CronJobStatus Status { get; private set; }
    public int ItemsProcessed { get; private set; }
    public string? ErrorMessage { get; private set; }

    public void Complete(int itemsProcessed)
    {
        Status = CronJobStatus.Succeeded;
        ItemsProcessed = itemsProcessed;
        FinishedAtUtc = DateTime.UtcNow;
    }

    public void Fail(string error)
    {
        Status = CronJobStatus.Failed;
        ErrorMessage = error;
        FinishedAtUtc = DateTime.UtcNow;
    }
}

public enum CronJobStatus
{
    Running = 0,
    Succeeded = 1,
    Failed = 2
}
// resync-marker
