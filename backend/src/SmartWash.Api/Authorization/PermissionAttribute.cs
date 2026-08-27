using Microsoft.AspNetCore.Authorization;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;

namespace SmartWash.Api.Authorization;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class HasPermissionAttribute : AuthorizeAttribute
{
    public HasPermissionAttribute(string permission) : base(policy: $"perm:{permission}")
    {
        Permission = permission;
    }

    public string Permission { get; }
}

public sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;

public sealed class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly ITenantContext _tenant;
    private readonly ICurrentUser _currentUser;

    public PermissionHandler(ITenantContext tenant, ICurrentUser currentUser)
    {
        _tenant = tenant;
        _currentUser = currentUser;
    }

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (!context.User.HasClaim(SmartWash.Shared.Constants.AppConstants.PermissionClaimType, requirement.Permission))
            return Task.CompletedTask;

        // جلوگیری از IDOR بین مستاجرها: کاربر غیرپلتفرمی فقط به مستاجر خودش دسترسی دارد.
        if (_tenant.TenantId is Guid routeTenantId && !_currentUser.IsPlatformAdmin)
        {
            if (_currentUser.TenantId != routeTenantId)
                return Task.CompletedTask;
        }

        context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

public sealed class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(Microsoft.Extensions.Options.IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith("perm:", StringComparison.OrdinalIgnoreCase))
        {
            var permission = policyName["perm:".Length..];
            var policy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(permission))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }
        return _fallback.GetPolicyAsync(policyName);
    }
}
