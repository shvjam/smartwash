using SmartWash.Api.Authorization;
using SmartWash.Api.Common;
using SmartWash.Application.Modules.Users;
using SmartWash.Shared.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartWash.Api.Controllers.Tenant;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController : ControllerBase
{
    private readonly ISender _sender;
    public UsersController(ISender sender) => _sender = sender;

    public sealed record InviteBody(string Email, string DisplayName, string? Phone, string Password, string Role);
    public sealed record AssignRoleBody(string Role);
    public sealed record SetActiveBody(bool IsActive);
    public sealed record ResetPasswordBody(string NewPassword);
    public sealed record ChangeMyPasswordBody(string CurrentPassword, string NewPassword);

    [HttpGet]
    [HasPermission(Permissions.UsersManage)]
    public async Task<IActionResult> List(CancellationToken ct)
        => (await _sender.Send(new ListTenantUsersQuery(), ct)).ToActionResult();

    [HttpPost]
    [HasPermission(Permissions.UsersManage)]
    public async Task<IActionResult> Invite([FromBody] InviteBody b, CancellationToken ct)
        => (await _sender.Send(new InviteUserCommand(b.Email, b.DisplayName, b.Phone, b.Password, b.Role), ct)).ToCreatedResult();

    [HttpPost("{id:guid}/roles")]
    [HasPermission(Permissions.UsersManage)]
    public async Task<IActionResult> AssignRole(Guid id, [FromBody] AssignRoleBody b, CancellationToken ct)
        => (await _sender.Send(new AssignRoleCommand(id, b.Role), ct)).ToActionResult();

    [HttpDelete("{id:guid}/roles/{role}")]
    [HasPermission(Permissions.UsersManage)]
    public async Task<IActionResult> RemoveRole(Guid id, string role, CancellationToken ct)
        => (await _sender.Send(new RemoveRoleCommand(id, role), ct)).ToActionResult();

    [HttpPost("{id:guid}/active")]
    [HasPermission(Permissions.UsersManage)]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] SetActiveBody b, CancellationToken ct)
        => (await _sender.Send(new SetUserActiveCommand(id, b.IsActive), ct)).ToActionResult();

    [HttpPost("{id:guid}/reset-password")]
    [HasPermission(Permissions.UsersManage)]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordBody b, CancellationToken ct)
        => (await _sender.Send(new AdminResetPasswordCommand(id, b.NewPassword), ct)).ToActionResult();

    [HttpPost("me/change-password")]
    public async Task<IActionResult> ChangeMyPassword([FromBody] ChangeMyPasswordBody b, CancellationToken ct)
        => (await _sender.Send(new ChangeMyPasswordCommand(b.CurrentPassword, b.NewPassword), ct)).ToActionResult();
}
