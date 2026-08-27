using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Modules.Tenants.GetCurrent;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/me")]
public sealed class MeController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ICurrentUser _currentUser;

    public MeController(ISender sender, ICurrentUser currentUser)
    {
        _sender = sender;
        _currentUser = currentUser;
    }

    [HttpGet]
    public IActionResult Me() => Ok(new
    {
        userId = _currentUser.UserId,
        email = _currentUser.Email,
        tenantId = _currentUser.TenantId,
        roles = _currentUser.Roles,
        permissions = _currentUser.Permissions,
        isPlatformAdmin = _currentUser.IsPlatformAdmin
    });

    [HttpGet("tenant")]
    public async Task<IActionResult> CurrentTenant(CancellationToken ct)
    {
        var result = await _sender.Send(new GetCurrentTenantQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { result.Error.Code, result.Error.Message });
    }

    [HttpGet("features")]
    public async Task<IActionResult> Features([FromServices] ITenantFeatureService features, CancellationToken ct)
    {
        var map = await features.GetFeaturesAsync(ct);
        return Ok(map);
    }
}
