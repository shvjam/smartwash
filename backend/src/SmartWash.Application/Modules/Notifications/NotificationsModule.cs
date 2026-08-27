using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Notifications;

public sealed record NotificationDto(Guid Id, NotificationType Type, string Title, string Body, string? EntityType, Guid? EntityId, bool IsRead, DateTime CreatedAtUtc);

public sealed record ListNotificationsQuery(bool? UnreadOnly, int Page, int PageSize) : IRequest<Result<PagedList<NotificationDto>>>;
public sealed class ListNotificationsHandler : IRequestHandler<ListNotificationsQuery, Result<PagedList<NotificationDto>>>
{
    private readonly IAppDbContext _db;
    public ListNotificationsHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<NotificationDto>>> Handle(ListNotificationsQuery q, CancellationToken ct)
    {
        var query = _db.AppNotifications.AsNoTracking().AsQueryable();
        if (q.UnreadOnly == true) query = query.Where(n => !n.IsRead);
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(n => n.CreatedAtUtc).Skip((page - 1) * size).Take(size)
            .Select(n => new NotificationDto(n.Id, n.Type, n.Title, n.Body, n.EntityType, n.EntityId, n.IsRead, n.CreatedAtUtc))
            .ToListAsync(ct);
        return Result.Success(new PagedList<NotificationDto>(items, page, size, total));
    }
}

public sealed record MarkNotificationReadCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class MarkNotificationReadHandler : IRequestHandler<MarkNotificationReadCommand, Result>
{
    private readonly IAppDbContext _db;
    public MarkNotificationReadHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(MarkNotificationReadCommand c, CancellationToken ct)
    {
        var n = await _db.AppNotifications.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (n is null) return Result.Failure(Error.NotFound("Notification.NotFound", "اعلان یافت نشد."));
        n.MarkRead();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record MarkAllReadCommand : IRequest<Result>, ITransactionalRequest;
public sealed class MarkAllReadHandler : IRequestHandler<MarkAllReadCommand, Result>
{
    private readonly IAppDbContext _db;
    public MarkAllReadHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(MarkAllReadCommand c, CancellationToken ct)
    {
        var items = await _db.AppNotifications.Where(n => !n.IsRead).ToListAsync(ct);
        foreach (var n in items) n.MarkRead();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
