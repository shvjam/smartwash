using SmartWash.Application.Abstractions.CrossCutting;
using MediatR;
using Microsoft.Extensions.Logging;

namespace SmartWash.Application.Behaviors;

/// <summary>
/// Writes an audit entry for every command that changes something.
///
/// The audit table, the writer and the query endpoint have existed since the beginning; what
/// was missing was anyone calling them, so the table has always been empty and "which cashier
/// edited that invoice" has never had an answer. Doing it here rather than in each handler
/// means a new command is audited the day it is written, instead of the day someone remembers
/// to add a line to it.
///
/// Only commands are recorded. Queries change nothing, and logging every report a manager
/// opens would bury the handful of entries that matter under thousands that do not.
///
/// It runs inside the transaction on purpose: an entry describing a change that was rolled
/// back would be worse than no entry, because it would be believed.
/// </summary>
public sealed class AuditBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IAuditWriter _audit;
    private readonly ILogger<AuditBehavior<TRequest, TResponse>> _logger;

    public AuditBehavior(IAuditWriter audit, ILogger<AuditBehavior<TRequest, TResponse>> logger)
    {
        _audit = audit;
        _logger = logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var response = await next();

        if (request is not ITransactionalRequest) return response;

        // A command that failed its own rules changed nothing, so there is nothing to record.
        if (!Succeeded(response)) return response;

        var name = typeof(TRequest).Name;
        var action = name.EndsWith("Command", StringComparison.Ordinal)
            ? name[..^"Command".Length]
            : name;

        try
        {
            await _audit.WriteAsync(action, EntityNameOf(action), EntityIdOf(request), null, request, ct);
        }
        catch (Exception ex)
        {
            // Never let bookkeeping break the thing it is bookkeeping for.
            _logger.LogWarning(ex, "Audit entry for {Action} could not be written", action);
        }

        return response;
    }

    /// <summary>
    /// Result-shaped responses carry their own success flag; anything else got this far without
    /// throwing, which is as much as can be known about it.
    /// </summary>
    private static bool Succeeded(TResponse response)
    {
        var prop = response?.GetType().GetProperty("IsSuccess");
        return prop?.GetValue(response) is not false;
    }

    /// <summary>
    /// The subject of the command, guessed from its name — CompleteOrder is about an Order.
    ///
    /// A guess is acceptable here because the entry also carries the full command, so a wrong
    /// label costs a little searchability and nothing else.
    /// </summary>
    private static string EntityNameOf(string action)
    {
        foreach (var known in KnownEntities)
            if (action.Contains(known, StringComparison.OrdinalIgnoreCase))
                return known;
        return action;
    }

    private static readonly string[] KnownEntities =
    {
        "Order", "Customer", "Vehicle", "Worker", "Service", "Bay", "Branch", "Shift", "Roster",
        "Reservation", "Expense", "Campaign", "Tip", "User", "Tenant", "Plan", "Subscription",
        "Invoice", "Payment", "Settings", "Reminder", "Ticket",
    };

    /// <summary>
    /// The id the command acts on, when it has an obvious one.
    ///
    /// Commands name their target inconsistently — Id on some, OrderId or WorkerId on others —
    /// so the first of those that is present is used, and an empty string when none is.
    /// </summary>
    private static string EntityIdOf(TRequest request)
    {
        var type = typeof(TRequest);
        foreach (var candidate in new[] { "Id", "OrderId", "CustomerId", "WorkerId", "BayId", "RosterId", "TenantId" })
        {
            var value = type.GetProperty(candidate)?.GetValue(request);
            if (value is Guid g && g != Guid.Empty) return g.ToString();
        }
        return string.Empty;
    }
}
