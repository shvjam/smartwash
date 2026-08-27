namespace SmartWash.Application.Modules.Auth;

public sealed record AuthResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAtUtc,
    string RefreshToken,
    DateTime RefreshTokenExpiresAtUtc,
    AuthenticatedUserDto User);

public sealed record AuthenticatedUserDto(
    Guid Id,
    string Email,
    string DisplayName,
    Guid? TenantId,
    string? TenantSlug,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> Permissions);
// resync-marker
