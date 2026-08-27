using System.Security.Claims;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Shared.Constants;
using Microsoft.AspNetCore.Http;

namespace SmartWash.Api.Identity;

public sealed class HttpCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public HttpCurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public Guid? UserId => TryParseGuid(Principal?.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)
                                       ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier));
    public string? Email => Principal?.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)
                            ?? Principal?.FindFirstValue(ClaimTypes.Email);
    public Guid? TenantId => TryParseGuid(Principal?.FindFirstValue(AppConstants.TenantClaimType));
    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;
    public bool IsPlatformAdmin => IsInRole(SmartWash.Shared.Constants.Roles.PlatformOwner) || IsInRole(SmartWash.Shared.Constants.Roles.PlatformSupport);

    public IReadOnlyCollection<string> Roles =>
        Principal?.FindAll(ClaimTypes.Role).Select(c => c.Value).ToArray() ?? Array.Empty<string>();

    public IReadOnlyCollection<string> Permissions =>
        Principal?.FindAll(AppConstants.PermissionClaimType).Select(c => c.Value).ToArray() ?? Array.Empty<string>();

    public bool HasPermission(string permission) =>
        Principal?.HasClaim(AppConstants.PermissionClaimType, permission) ?? false;

    public bool IsInRole(string role) => Principal?.IsInRole(role) ?? false;

    private static Guid? TryParseGuid(string? value) =>
        Guid.TryParse(value, out var g) ? g : null;
}
