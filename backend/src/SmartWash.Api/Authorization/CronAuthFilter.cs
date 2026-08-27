using SmartWash.Shared.Constants;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace SmartWash.Api.Authorization;

public sealed class CronAuthFilter : IAsyncActionFilter
{
    private readonly IConfiguration _config;
    public CronAuthFilter(IConfiguration config) => _config = config;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var expected = _config["Cron:Secret"];
        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new ObjectResult(new { code = "Cron.NotConfigured", message = "Cron secret is not configured." })
            { StatusCode = StatusCodes.Status503ServiceUnavailable };
            return;
        }

        var provided = context.HttpContext.Request.Headers[AppConstants.CronSecretHeader].ToString();
        if (string.IsNullOrWhiteSpace(provided) || !CryptographicEquals(provided, expected))
        {
            context.Result = new UnauthorizedObjectResult(new { code = "Cron.Unauthorized", message = "نامعتبر." });
            return;
        }

        await next();
    }

    private static bool CryptographicEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class CronEndpointAttribute : ServiceFilterAttribute
{
    public CronEndpointAttribute() : base(typeof(CronAuthFilter)) { }
}
