using System.Diagnostics;
using SmartWash.Application.Abstractions.CrossCutting;
using MediatR;
using Microsoft.Extensions.Logging;

namespace SmartWash.Application.Behaviors;

public sealed class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;
    private readonly ICorrelationContext _correlation;

    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger, ICorrelationContext correlation)
    {
        _logger = logger;
        _correlation = correlation;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var name = typeof(TRequest).Name;
        var sw = Stopwatch.StartNew();
        // Per-request start/success are diagnostic noise at Information level; keep them at
        // Debug so normal operation stays quiet and only failures (or slow requests) surface.
        _logger.LogDebug("[{Correlation}] -> {Request} started", _correlation.CorrelationId, name);

        try
        {
            var response = await next();
            sw.Stop();
            var level = sw.ElapsedMilliseconds > 2000 ? LogLevel.Warning : LogLevel.Debug;
            _logger.Log(level, "[{Correlation}] <- {Request} succeeded in {Elapsed}ms",
                _correlation.CorrelationId, name, sw.ElapsedMilliseconds);
            return response;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[{Correlation}] !! {Request} failed after {Elapsed}ms",
                _correlation.CorrelationId, name, sw.ElapsedMilliseconds);
            throw;
        }
    }
}
// resync-marker
