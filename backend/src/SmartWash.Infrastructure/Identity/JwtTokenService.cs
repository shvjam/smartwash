using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Shared.Constants;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace SmartWash.Infrastructure.Identity;

public sealed class JwtTokenService : IJwtTokenService
{
    private readonly JwtOptions _options;
    private readonly SigningCredentials _credentials;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        _credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    }

    public AccessToken IssueAccessToken(JwtIssueRequest request)
    {
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(_options.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, request.UserId.ToString()),
            new(JwtRegisteredClaimNames.Email, request.Email),
            new(JwtRegisteredClaimNames.Name, request.DisplayName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };

        if (request.TenantId.HasValue)
        {
            claims.Add(new Claim(AppConstants.TenantClaimType, request.TenantId.Value.ToString()));
            if (!string.IsNullOrEmpty(request.TenantSlug))
                claims.Add(new Claim(AppConstants.TenantSlugClaimType, request.TenantSlug));
        }

        foreach (var role in request.Roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        foreach (var perm in request.Permissions)
            claims.Add(new Claim(AppConstants.PermissionClaimType, perm));

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: _credentials);

        var encoded = new JwtSecurityTokenHandler().WriteToken(token);
        return new AccessToken(encoded, expires);
    }

    public string IssueRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
// resync-marker
