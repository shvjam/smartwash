using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Platform;

public sealed record AuditLogDto(
    Guid Id,
    Guid? TenantId,
    string? TenantSlug,
    Guid? UserId,
    string? UserDisplayName,
    string Action,
    string EntityName,
    string EntityId,
    string? OldValues,
    string? NewValues,
    string? IpAddress,
    string? UserAgent,
    string? CorrelationId,
    DateTime OccurredAtUtc);

public sealed record ListAuditLogsQuery(
    Guid? TenantId,
    Guid? UserId,
    string? EntityName,
    string? Action,
    DateTime? FromUtc,
    DateTime? ToUtc,
    int Page,
    int PageSize) : IRequest<Result<PagedList<AuditLogDto>>>;

public sealed class ListAuditLogsHandler : IRequestHandler<ListAuditLogsQuery, Result<PagedList<AuditLogDto>>>
{
    private readonly IAppDbContext _db;
    public ListAuditLogsHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<AuditLogDto>>> Handle(ListAuditLogsQuery q, CancellationToken ct)
    {
        var qry = _db.AuditLogs.IgnoreQueryFilters().AsNoTracking().AsQueryable();
        if (q.TenantId.HasValue) qry = qry.Where(a => a.TenantId == q.TenantId.Value);
        if (q.UserId.HasValue) qry = qry.Where(a => a.UserId == q.UserId.Value);
        if (!string.IsNullOrWhiteSpace(q.EntityName)) qry = qry.Where(a => a.EntityName == q.EntityName);
        if (!string.IsNullOrWhiteSpace(q.Action)) qry = qry.Where(a => a.Action == q.Action);
        if (q.FromUtc.HasValue) qry = qry.Where(a => a.OccurredAtUtc >= q.FromUtc.Value);
        if (q.ToUtc.HasValue) qry = qry.Where(a => a.OccurredAtUtc <= q.ToUtc.Value);

        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 50 : q.PageSize, 1, 200);
        var total = await qry.CountAsync(ct);

        var items = await (
            from a in qry.OrderByDescending(x => x.OccurredAtUtc).Skip((page - 1) * size).Take(size)
            join t in _db.Tenants.IgnoreQueryFilters().AsNoTracking() on a.TenantId equals t.Id into tj
            from t in tj.DefaultIfEmpty()
            join u in _db.Users.IgnoreQueryFilters().AsNoTracking() on a.UserId equals u.Id into uj
            from u in uj.DefaultIfEmpty()
            select new AuditLogDto(
                a.Id, a.TenantId, t != null ? t.Slug : null,
                a.UserId, u != null ? u.DisplayName : null,
                a.Action, a.EntityName, a.EntityId,
                a.OldValues, a.NewValues,
                a.IpAddress, a.UserAgent, a.CorrelationId,
                a.OccurredAtUtc)
        ).ToListAsync(ct);

        return Result.Success(new PagedList<AuditLogDto>(items, page, size, total));
    }
}
// resync-marker
