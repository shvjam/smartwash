using SmartWash.Domain.Common;
using SmartWash.Shared.Exceptions;

namespace SmartWash.Domain.Identity;

public sealed class User : AggregateRoot<Guid>
{
    private readonly List<UserRole> _roles = new();
    private readonly List<RefreshToken> _refreshTokens = new();

    private User() { }

    public Guid? TenantId { get; private set; }
    public string Email { get; private set; } = null!;
    public string NormalizedEmail { get; private set; } = null!;
    public string? Phone { get; private set; }
    public string DisplayName { get; private set; } = null!;
    public string PasswordHash { get; private set; } = null!;
    public bool EmailConfirmed { get; private set; }
    public bool PhoneConfirmed { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsLockedOut { get; private set; }
    public DateTime? LastLoginAtUtc { get; private set; }
    public int FailedLoginAttempts { get; private set; }
    public DateTime? LockoutEndUtc { get; private set; }
    public string? AvatarUrl { get; private set; }

    public IReadOnlyCollection<UserRole> Roles => _roles.AsReadOnly();
    public IReadOnlyCollection<RefreshToken> RefreshTokens => _refreshTokens.AsReadOnly();

    public static User CreatePlatformUser(string email, string displayName, string passwordHash, string role)
    {
        var user = CreateInternal(null, email, displayName, passwordHash);
        user._roles.Add(new UserRole(user.Id, null, role));
        return user;
    }

    public static User CreateTenantUser(Guid tenantId, string email, string displayName, string passwordHash, string role)
    {
        var user = CreateInternal(tenantId, email, displayName, passwordHash);
        user._roles.Add(new UserRole(user.Id, tenantId, role));
        return user;
    }

    private static User CreateInternal(Guid? tenantId, string email, string displayName, string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(email)) throw new DomainException("User.EmailRequired", "ایمیل الزامی است.");
        if (string.IsNullOrWhiteSpace(passwordHash)) throw new DomainException("User.PasswordRequired", "گذرواژه الزامی است.");

        return new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = email.Trim(),
            NormalizedEmail = email.Trim().ToUpperInvariant(),
            DisplayName = displayName.Trim(),
            PasswordHash = passwordHash,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };
    }

    public void UpdatePassword(string newHash) { PasswordHash = newHash; UpdatedAtUtc = DateTime.UtcNow; }

    public void UpdateEmail(string email)
    {
        Email = email.Trim();
        NormalizedEmail = email.Trim().ToUpperInvariant();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateProfile(string displayName, string? phone, string? avatarUrl)
    {
        DisplayName = displayName.Trim();
        Phone = phone?.Trim();
        AvatarUrl = avatarUrl;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate() { IsActive = false; UpdatedAtUtc = DateTime.UtcNow; }
    public void Activate() { IsActive = true; UpdatedAtUtc = DateTime.UtcNow; }
    public void ConfirmEmail() { EmailConfirmed = true; UpdatedAtUtc = DateTime.UtcNow; }
    public void ConfirmPhone() { PhoneConfirmed = true; UpdatedAtUtc = DateTime.UtcNow; }

    public void RecordSuccessfulLogin()
    {
        LastLoginAtUtc = DateTime.UtcNow;
        FailedLoginAttempts = 0;
        LockoutEndUtc = null;
        IsLockedOut = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RecordFailedLogin(int maxAttempts, TimeSpan lockoutDuration)
    {
        FailedLoginAttempts++;
        if (FailedLoginAttempts >= maxAttempts)
        {
            IsLockedOut = true;
            LockoutEndUtc = DateTime.UtcNow.Add(lockoutDuration);
        }
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public bool IsCurrentlyLocked() =>
        IsLockedOut && LockoutEndUtc.HasValue && LockoutEndUtc.Value > DateTime.UtcNow;

    public void AssignRole(Guid? tenantScope, string role)
    {
        if (_roles.Any(r => r.TenantId == tenantScope && r.Role == role)) return;
        _roles.Add(new UserRole(Id, tenantScope, role));
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RemoveRole(Guid? tenantScope, string role)
    {
        var existing = _roles.FirstOrDefault(r => r.TenantId == tenantScope && r.Role == role);
        if (existing is not null) _roles.Remove(existing);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public RefreshToken IssueRefreshToken(string token, DateTime expiresAtUtc, string? createdByIp)
    {
        var rt = RefreshToken.Create(Id, token, expiresAtUtc, createdByIp);
        _refreshTokens.Add(rt);
        return rt;
    }

    public bool RevokeRefreshToken(string token, string? revokedByIp, string? replacedBy)
    {
        var rt = _refreshTokens.FirstOrDefault(r => r.Token == token && r.RevokedAtUtc == null);
        if (rt is null) return false;
        rt.Revoke(revokedByIp, replacedBy);
        return true;
    }
}

public sealed class UserRole : Entity<Guid>
{
    private UserRole() { }

    internal UserRole(Guid userId, Guid? tenantId, string role)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        TenantId = tenantId;
        Role = role;
        AssignedAtUtc = DateTime.UtcNow;
    }

    public Guid UserId { get; private set; }
    public Guid? TenantId { get; private set; }
    public string Role { get; private set; } = null!;
    public DateTime AssignedAtUtc { get; private set; }
}
// resync-marker
