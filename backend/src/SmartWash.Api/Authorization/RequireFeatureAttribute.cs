using SmartWash.Application.Abstractions.Multitenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace SmartWash.Api.Authorization;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequireFeatureAttribute : Attribute, IAsyncActionFilter
{
    public string Key { get; }
    public RequireFeatureAttribute(string key) { Key = key; }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var svc = context.HttpContext.RequestServices.GetService(typeof(ITenantFeatureService)) as ITenantFeatureService;
        if (svc is null) { await next(); return; }
        var ok = await svc.HasFeatureAsync(Key, context.HttpContext.RequestAborted);
        if (!ok)
        {
            context.Result = new ObjectResult(new
            {
                code = "Feature.NotAvailable",
                message = $"این قابلیت در پلن فعلی شما در دسترس نیست. ({Key})",
                feature = Key
            })
            { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }
        await next();
    }
}
