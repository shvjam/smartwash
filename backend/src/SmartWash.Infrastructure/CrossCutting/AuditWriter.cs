using System.Text.Json;
using SmartWash.Application.Abstractions.CrossCutting;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Audit;
using Microsoft.AspNetCore.Http;

namespace SmartWash.Infrastructure.CrossCutting;

public sealed class AuditWriter : IAuditWriter
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly ITenantContext _tenant;
    private readonly ICorrelationContext _correlation;
    private readonly IHttpContextAccessor _http;

    public AuditWriter(IAppDbContext db, ICurrentUser currentUser, ITenantContext tenant,
        ICorrelationContext correlation, IHttpContextAccessor http)
    {
        _db = db;
        _currentUser = currentUser;
        _tenant = tenant;
        _correlation = correlation;
        _http = http;
    }

    public async Task WriteAsync(string action, string entityName, string entityId, object? oldValues, object? newValues, CancellationToken ct = default)
    {
        var ip = _http.HttpContext?.Connection.RemoteIpAddress?.ToString();
        var ua = _http.HttpContext?.Request.Headers.UserAgent.ToString();

        var log = new AuditLog(
            _tenant.TenantId,
            _currentUser.UserId,
            action,
            entityName,
            entityId,
            oldValues is null ? null : JsonSerializer.Serialize(oldValues),
            newValues is null ? null : JsonSerializer.Serialize(newValues),
            ip,
            ua,
            _correlation.CorrelationId);

        _db.AuditLogs.Add(log);
        // Saved here rather than left for the caller: the unit of work commits the
        // transaction without calling SaveChanges, so an entry merely added to the context
        // would be discarded — which is why this table has stayed empty.
        await _db.SaveChangesAsync(ct);
    }
}
// resync-marker
