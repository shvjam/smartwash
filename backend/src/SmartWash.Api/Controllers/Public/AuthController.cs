using SmartWash.Application.Modules.Auth;
using SmartWash.Application.Modules.Auth.Login;
using SmartWash.Application.Modules.Auth.Logout;
using SmartWash.Application.Modules.Auth.Refresh;
using SmartWash.Application.Modules.Tenants.Register;
using SmartWash.Shared.Results;
using ErrorType = SmartWash.Shared.Results.ErrorType;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Public;

[ApiController]
[Route("api/public/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly ISender _sender;
    public AuthController(ISender sender) => _sender = sender;

    public sealed record LoginRequest(string Email, string Password, string? TenantSlug);
    public sealed record RefreshRequest(string RefreshToken);
    public sealed record LogoutRequest(string RefreshToken);
    public sealed record RegisterTenantRequest(
        string DisplayName, string Slug, string OwnerEmail, string OwnerPhone,
        string OwnerDisplayName, string OwnerPassword);
    public sealed record ForgotPasswordRequest(string EmailOrPhone);
    public sealed record ResetPasswordRequest(string EmailOrPhone, string Code, string NewPassword);

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _sender.Send(new LoginCommand(req.Email, req.Password, req.TenantSlug, ip), ct);
        return ToActionResult(result);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _sender.Send(new RefreshTokenCommand(req.RefreshToken, ip), ct);
        return ToActionResult(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _sender.Send(new LogoutCommand(req.RefreshToken, ip), ct);
        return result.IsSuccess ? NoContent() : Problem(statusCode: 400, title: result.Error.Code, detail: result.Error.Message);
    }

    [HttpPost("register-tenant")]
    public async Task<IActionResult> RegisterTenant([FromBody] RegisterTenantRequest req, CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _sender.Send(new RegisterTenantCommand(
            req.DisplayName, req.Slug, req.OwnerEmail, req.OwnerPhone, req.OwnerDisplayName, req.OwnerPassword, ip), ct);
        return ToActionResult(result);
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req, CancellationToken ct)
    {
        var result = await _sender.Send(new ForgotPasswordCommand(req.EmailOrPhone), ct);
        return result.IsSuccess ? Ok(new { ok = true }) : BadRequest(new { result.Error.Code, result.Error.Message });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        var result = await _sender.Send(new ResetPasswordCommand(req.EmailOrPhone, req.Code, req.NewPassword), ct);
        return result.IsSuccess
            ? Ok(new { ok = true })
            : result.Error.Type switch
            {
                ErrorType.NotFound => NotFound(new { result.Error.Code, result.Error.Message }),
                ErrorType.Validation => UnprocessableEntity(new { result.Error.Code, result.Error.Message }),
                _ => BadRequest(new { result.Error.Code, result.Error.Message })
            };
    }

    private IActionResult ToActionResult(Result<AuthResponse> result) =>
        result.IsSuccess
            ? Ok(result.Value)
            : result.Error.Type switch
            {
                SmartWash.Shared.Results.ErrorType.Unauthorized => Unauthorized(new { result.Error.Code, result.Error.Message }),
                SmartWash.Shared.Results.ErrorType.Forbidden => StatusCode(403, new { result.Error.Code, result.Error.Message }),
                SmartWash.Shared.Results.ErrorType.Conflict => Conflict(new { result.Error.Code, result.Error.Message }),
                SmartWash.Shared.Results.ErrorType.Validation => UnprocessableEntity(new { result.Error.Code, result.Error.Message }),
                _ => BadRequest(new { result.Error.Code, result.Error.Message })
            };
}
