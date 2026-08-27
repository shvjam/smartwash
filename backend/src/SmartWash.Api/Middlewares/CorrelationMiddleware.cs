using SmartWash.Application.Abstractions.CrossCutting;
using SmartWash.Shared.Constants;
using Serilog.Context;

namespace SmartWash.Api.Middlewares;

public sealed class CorrelationMiddleware
{
    private readonly RequestDelegate _next;
    public CorrelationMiddleware(RequestDelegate next) => _next = next;

    public async Task Invoke(HttpContext context, ICorrelationContext correlation)
    {
        var incoming = context.Request.Headers[AppConstants.CorrelationIdHeader].ToString();
        var id = string.IsNullOrWhiteSpace(incoming) ? Guid.NewGuid().ToString("N") : incoming;
        correlation.Set(id);
        context.Response.Headers[AppConstants.CorrelationIdHeader] = id;
        using (LogContext.PushProperty("CorrelationId", id))
        {
            await _next(context);
        }
    }
}
