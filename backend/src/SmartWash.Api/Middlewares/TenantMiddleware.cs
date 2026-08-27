using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Shared.Constants;

namespace SmartWash.Api.Middlewares;

public sealed class TenantMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TenantMiddleware> _logger;

    public TenantMiddleware(RequestDelegate next, ILogger<TenantMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task Invoke(HttpContext context, ITenantContext tenantContext, ITenantResolver resolver)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        if (!path.StartsWith(AppConstants.TenantRoutePrefix, StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var segments = path[AppConstants.TenantRoutePrefix.Length..].Split('/', 2);
        var slug = segments.Length > 0 ? segments[0] : null;

        if (string.IsNullOrWhiteSpace(slug))
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Tenant.SlugMissing", "نامک مستاجر در آدرس مشخص نشده است.");
            return;
        }

        var resolved = await resolver.ResolveAsync(slug, context.RequestAborted);
        if (resolved is null)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Tenant.NotFound", "مستاجر یافت نشد.");
            return;
        }

        if (resolved.Status is "Suspended" or "Cancelled" or "Expired" or "Archived")
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Tenant.Inactive",
                $"وضعیت مستاجر {resolved.Status} است و دسترسی امکان‌پذیر نیست.");
            return;
        }

        tenantContext.SetTenant(resolved.Id, resolved.Slug, resolved.IsReadOnly);
        var rewritten = "/" + string.Join('/', segments.Skip(1));
        context.Items["TenantRoutePrefix"] = AppConstants.TenantRoutePrefix + slug;

        // Rewrite path so controllers can route on /api/...
        context.Request.Path = $"/api{rewritten}";
        await _next(context);
    }

    private static Task WriteProblem(HttpContext ctx, int status, string code, string message)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/problem+json";
        return ctx.Response.WriteAsJsonAsync(new { code, message });
    }
}
