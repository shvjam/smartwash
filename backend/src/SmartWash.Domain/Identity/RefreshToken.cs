using SmartWash.Domain.Common;

namespace SmartWash.Domain.Identity;

public sealed class RefreshToken : Entity<Guid>
{
    private RefreshToken() { }

    internal RefreshToken(Guid userId, string token, DateTime expiresAtUtc, string? createdByIp)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        Token = token;
        ExpiresAtUtc = expiresAtUtc;
        CreatedAtUtc = DateTime.UtcNow;
        CreatedByIp = createdByIp;
    }

    public static RefreshToken Create(Guid userId, string token, DateTime expiresAtUtc, string? createdByIp) =>
        new(userId, token, expiresAtUtc, createdByIp);

    public Guid UserId { get; private set; }
    public string Token { get; private set; } = null!;
    public DateTime ExpiresAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public string? CreatedByIp { get; private set; }
    public DateTime? RevokedAtUtc { get; private set; }
    public string? RevokedByIp { get; private set; }
    public string? ReplacedByToken { get; private set; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAtUtc;
    public bool IsRevoked => RevokedAtUtc.HasValue;
    public bool IsActive => !IsRevoked && !IsExpired;

    internal void Revoke(string? revokedByIp, string? replacedBy)
    {
        RevokedAtUtc = DateTime.UtcNow;
        RevokedByIp = revokedByIp;
        ReplacedByToken = replacedBy;
    }
}
// resync-marker
