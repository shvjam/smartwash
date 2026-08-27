using SmartWash.Domain.Common;

namespace SmartWash.Domain.Operations;

public sealed class Worker : TenantAggregateRoot<Guid>
{
    private Worker() { }

    public Guid BranchId { get; private set; }
    public Guid? UserId { get; private set; }
    public string FullName { get; private set; } = null!;
    public string Role { get; private set; } = null!;
    public string? Phone { get; private set; }
    public string? NationalId { get; private set; }
    public string? AvatarUrl { get; private set; }
    public decimal CommissionRate { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTime? HiredAtUtc { get; private set; }
    public DateTime? TerminatedAtUtc { get; private set; }

    public static Worker Create(Guid tenantId, Guid branchId, string fullName, string role, string? phone, decimal commissionRate)
    {
        return new Worker
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BranchId = branchId,
            FullName = fullName.Trim(),
            Role = role.Trim(),
            Phone = phone?.Trim(),
            CommissionRate = commissionRate,
            HiredAtUtc = DateTime.UtcNow,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void Update(string fullName, string role, string? phone, string? nationalId, decimal commissionRate, string? avatarUrl)
    {
        FullName = fullName.Trim();
        Role = role.Trim();
        Phone = phone?.Trim();
        NationalId = nationalId?.Trim();
        CommissionRate = commissionRate;
        AvatarUrl = avatarUrl;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void LinkUser(Guid userId) { UserId = userId; UpdatedAtUtc = DateTime.UtcNow; }
    public void Activate() { IsActive = true; TerminatedAtUtc = null; UpdatedAtUtc = DateTime.UtcNow; }
    public void Terminate() { IsActive = false; TerminatedAtUtc = DateTime.UtcNow; UpdatedAtUtc = DateTime.UtcNow; }
}
// resync-marker
