namespace SmartWash.Application.Abstractions.Identity;

public interface ICurrentUser
{
    Guid? UserId { get; }
    string? Email { get; }
    Guid? TenantId { get; }
    bool IsAuthenticated { get; }
    bool IsPlatformAdmin { get; }
    IReadOnlyCollection<string> Roles { get; }
    IReadOnlyCollection<string> Permissions { get; }
    bool HasPermission(string permission);
    bool IsInRole(string role);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IJwtTokenService
{
    AccessToken IssueAccessToken(JwtIssueRequest request);
    string IssueRefreshToken();
}

public sealed record JwtIssueRequest(
    Guid UserId,
    string Email,
    string DisplayName,
    Guid? TenantId,
    string? TenantSlug,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> Permissions);

public sealed record AccessToken(string Token, DateTime ExpiresAtUtc);
// resync-marker
