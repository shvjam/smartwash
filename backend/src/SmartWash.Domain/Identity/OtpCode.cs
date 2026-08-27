using SmartWash.Domain.Common;

namespace SmartWash.Domain.Identity;

public sealed class OtpCode : Entity<Guid>
{
    private OtpCode() { }

    public OtpCode(string destination, OtpPurpose purpose, string codeHash, DateTime expiresAtUtc, Guid? userId)
    {
        Id = Guid.NewGuid();
        Destination = destination;
        Purpose = purpose;
        CodeHash = codeHash;
        ExpiresAtUtc = expiresAtUtc;
        UserId = userId;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public string Destination { get; private set; } = null!;
    public OtpPurpose Purpose { get; private set; }
    public string CodeHash { get; private set; } = null!;
    public DateTime ExpiresAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ConsumedAtUtc { get; private set; }
    public int AttemptCount { get; private set; }
    public Guid? UserId { get; private set; }

    public bool IsConsumed => ConsumedAtUtc.HasValue;
    public bool IsExpired => DateTime.UtcNow >= ExpiresAtUtc;

    public void RegisterAttempt() => AttemptCount++;
    public void Consume() => ConsumedAtUtc = DateTime.UtcNow;
}

public enum OtpPurpose
{
    PasswordReset = 0,
    PhoneLogin = 1,
    EmailVerification = 2
}
// resync-marker
