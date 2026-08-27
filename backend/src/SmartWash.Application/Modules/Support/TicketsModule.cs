using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Domain.Support;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Support;

// ---------- DTOs (shared by tenant and platform modules) ----------

public sealed record TicketAttachmentDto(Guid Id, Guid? MessageId, string FileName, string Path, string Url,
    string ContentType, long SizeBytes, DateTime CreatedAtUtc);

public sealed record TicketMessageDto(Guid Id, Guid? AuthorUserId, string AuthorName, TicketActorSide AuthorSide,
    string Body, bool IsInternalNote, DateTime CreatedAtUtc, IReadOnlyList<TicketAttachmentDto> Attachments);

public sealed record TicketEventDto(Guid Id, TicketEventType Type, string? FromValue, string? ToValue, string? Note,
    Guid? ActorUserId, string ActorName, TicketActorSide ActorSide, DateTime OccurredAtUtc);

public sealed record TicketListItemDto(
    Guid Id, Guid TenantId, string? TenantSlug, string? TenantName, string Number, string Subject,
    TicketCategory Category, TicketPriority Priority, TicketStatus Status,
    string RequesterName, string? RequesterPhone, Guid? AssignedToUserId, string? AssignedToName,
    DateTime DueAtUtc, bool IsSlaBreached, DateTime? FirstResponseAtUtc, DateTime? ResolvedAtUtc, DateTime? ClosedAtUtc,
    DateTime LastMessageAtUtc, TicketActorSide LastMessageSide, int MessageCount,
    int UnreadForTenant, int UnreadForPlatform, int ReopenCount,
    int? SatisfactionRating, DateTime CreatedAtUtc);

public sealed record TicketDetailDto(
    TicketListItemDto Ticket, string? RelatedEntityType, Guid? RelatedEntityId, Guid? BranchId,
    string? SatisfactionComment,
    IReadOnlyList<TicketMessageDto> Messages,
    IReadOnlyList<TicketEventDto> Events,
    IReadOnlyList<TicketAttachmentDto> Attachments);

public sealed record TicketSummaryDto(int Total, int Open, int AwaitingCustomer, int Resolved, int Closed,
    int UnreadForTenant, int SlaBreached);

public sealed record TicketAttachmentInput(string FileName, string Path, string Url, string ContentType, long SizeBytes);

public static class TicketMap
{
    public static TicketAttachmentDto ToDto(TicketAttachment a) =>
        new(a.Id, a.MessageId, a.FileName, a.Path, a.Url, a.ContentType, a.SizeBytes, a.CreatedAtUtc);

    public static TicketEventDto ToDto(TicketEvent e) =>
        new(e.Id, e.Type, e.FromValue, e.ToValue, e.Note, e.ActorUserId, e.ActorName, e.ActorSide, e.OccurredAtUtc);

    public static TicketMessageDto ToDto(TicketMessage m, IReadOnlyList<TicketAttachmentDto> attachments) =>
        new(m.Id, m.AuthorUserId, m.AuthorName, m.AuthorSide, m.Body, m.IsInternalNote, m.CreatedAtUtc, attachments);

    public static TicketListItemDto ToListItem(Ticket t, DateTime nowUtc,
        string? tenantSlug = null, string? tenantName = null, string? assignedToName = null) =>
        new(t.Id, t.TenantId, tenantSlug, tenantName, t.Number, t.Subject, t.Category, t.Priority, t.Status,
            t.RequesterName, t.RequesterPhone, t.AssignedToUserId, assignedToName,
            t.DueAtUtc, t.IsSlaBreached(nowUtc), t.FirstResponseAtUtc, t.ResolvedAtUtc, t.ClosedAtUtc,
            t.LastMessageAtUtc, t.LastMessageSide, t.MessageCount,
            t.UnreadForTenant, t.UnreadForPlatform, t.ReopenCount, t.SatisfactionRating, t.CreatedAtUtc);
}

/// <summary>
/// خواندن جزئیات تیکت برای هر دو سمت. یادداشت‌های داخلی فقط وقتی برگردانده می‌شوند
/// که درخواست از پنل پلتفرم آمده باشد.
/// </summary>
public static class TicketDetailBuilder
{
    public static async Task<TicketDetailDto> BuildAsync(IAppDbContext db, Ticket ticket, bool includeInternalNotes,
        string? tenantSlug, string? tenantName, string? assignedToName, CancellationToken ct)
    {
        var messagesQuery = db.TicketMessages.IgnoreQueryFilters().AsNoTracking()
            .Where(m => m.TicketId == ticket.Id);
        if (!includeInternalNotes) messagesQuery = messagesQuery.Where(m => !m.IsInternalNote);

        var messages = await messagesQuery.OrderBy(m => m.CreatedAtUtc).ToListAsync(ct);

        var attachments = await db.TicketAttachments.IgnoreQueryFilters().AsNoTracking()
            .Where(a => a.TicketId == ticket.Id)
            .OrderBy(a => a.CreatedAtUtc)
            .ToListAsync(ct);

        var events = await db.TicketEvents.IgnoreQueryFilters().AsNoTracking()
            .Where(e => e.TicketId == ticket.Id)
            .OrderBy(e => e.OccurredAtUtc)
            .ToListAsync(ct);

        var byMessage = attachments
            .Where(a => a.MessageId.HasValue)
            .GroupBy(a => a.MessageId!.Value)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<TicketAttachmentDto>)g.Select(TicketMap.ToDto).ToArray());

        var messageDtos = messages
            .Select(m => TicketMap.ToDto(m, byMessage.TryGetValue(m.Id, out var list) ? list : Array.Empty<TicketAttachmentDto>()))
            .ToArray();

        var now = DateTime.UtcNow;
        return new TicketDetailDto(
            TicketMap.ToListItem(ticket, now, tenantSlug, tenantName, assignedToName),
            ticket.RelatedEntityType, ticket.RelatedEntityId, ticket.BranchId, ticket.SatisfactionComment,
            messageDtos,
            events.Select(TicketMap.ToDto).ToArray(),
            attachments.Select(TicketMap.ToDto).ToArray());
    }
}

// ---------- LIST (tenant) ----------

public sealed record ListMyTicketsQuery(TicketStatus? Status, TicketCategory? Category, TicketPriority? Priority,
    bool OpenOnly, string? Search, int Page, int PageSize) : IRequest<Result<PagedList<TicketListItemDto>>>;

public sealed class ListMyTicketsHandler : IRequestHandler<ListMyTicketsQuery, Result<PagedList<TicketListItemDto>>>
{
    private static readonly TicketStatus[] OpenStatuses =
        [TicketStatus.New, TicketStatus.InProgress, TicketStatus.AwaitingCustomer];

    private readonly IAppDbContext _db;
    public ListMyTicketsHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<TicketListItemDto>>> Handle(ListMyTicketsQuery q, CancellationToken ct)
    {
        var query = _db.Tickets.AsNoTracking().AsQueryable();
        if (q.Status.HasValue) query = query.Where(t => t.Status == q.Status.Value);
        else if (q.OpenOnly) query = query.Where(t => OpenStatuses.Contains(t.Status));
        if (q.Category.HasValue) query = query.Where(t => t.Category == q.Category.Value);
        if (q.Priority.HasValue) query = query.Where(t => t.Priority == q.Priority.Value);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(t => t.Number.Contains(s) || t.Subject.Contains(s) || t.RequesterName.Contains(s));
        }

        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(t => t.LastMessageAtUtc)
            .Skip((page - 1) * size).Take(size)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        return Result.Success(new PagedList<TicketListItemDto>(
            items.Select(t => TicketMap.ToListItem(t, now)).ToArray(), page, size, total));
    }
}

// ---------- SUMMARY (tenant badge) ----------

public sealed record MyTicketsSummaryQuery : IRequest<Result<TicketSummaryDto>>;

public sealed class MyTicketsSummaryHandler : IRequestHandler<MyTicketsSummaryQuery, Result<TicketSummaryDto>>
{
    private readonly IAppDbContext _db;
    public MyTicketsSummaryHandler(IAppDbContext db) => _db = db;

    public async Task<Result<TicketSummaryDto>> Handle(MyTicketsSummaryQuery q, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var rows = await _db.Tickets.AsNoTracking()
            .Select(t => new { t.Status, t.UnreadForTenant, t.DueAtUtc, t.FirstResponseAtUtc })
            .ToListAsync(ct);

        var open = rows.Count(r => r.Status is TicketStatus.New or TicketStatus.InProgress or TicketStatus.AwaitingCustomer);
        return Result.Success(new TicketSummaryDto(
            Total: rows.Count,
            Open: open,
            AwaitingCustomer: rows.Count(r => r.Status == TicketStatus.AwaitingCustomer),
            Resolved: rows.Count(r => r.Status == TicketStatus.Resolved),
            Closed: rows.Count(r => r.Status == TicketStatus.Closed),
            UnreadForTenant: rows.Sum(r => r.UnreadForTenant),
            SlaBreached: rows.Count(r => r.FirstResponseAtUtc is null && now > r.DueAtUtc
                && r.Status is TicketStatus.New or TicketStatus.InProgress or TicketStatus.AwaitingCustomer)));
    }
}

// ---------- DETAIL (tenant) ----------

public sealed record GetMyTicketQuery(Guid Id) : IRequest<Result<TicketDetailDto>>, ITransactionalRequest;

public sealed class GetMyTicketHandler : IRequestHandler<GetMyTicketQuery, Result<TicketDetailDto>>
{
    private readonly IAppDbContext _db;
    public GetMyTicketHandler(IAppDbContext db) => _db = db;

    public async Task<Result<TicketDetailDto>> Handle(GetMyTicketQuery q, CancellationToken ct)
    {
        var ticket = await _db.Tickets.FirstOrDefaultAsync(t => t.Id == q.Id, ct);
        if (ticket is null) return Result.Failure<TicketDetailDto>(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));

        // بازکردن تیکت توسط مستاجر، پیام‌های خوانده‌نشده‌ی او را صفر می‌کند.
        if (ticket.UnreadForTenant > 0)
        {
            ticket.MarkReadBy(TicketActorSide.Tenant);
            await _db.SaveChangesAsync(ct);
        }

        var assignedToName = ticket.AssignedToUserId.HasValue
            ? await _db.Users.IgnoreQueryFilters().AsNoTracking()
                .Where(u => u.Id == ticket.AssignedToUserId.Value).Select(u => u.DisplayName).FirstOrDefaultAsync(ct)
            : null;

        return await TicketDetailBuilder.BuildAsync(_db, ticket, includeInternalNotes: false,
            tenantSlug: null, tenantName: null, assignedToName: assignedToName, ct);
    }
}

// ---------- CREATE (tenant) ----------

public sealed record CreateTicketCommand(string Subject, string Description, TicketCategory Category,
    TicketPriority Priority, Guid? BranchId, string? RelatedEntityType, Guid? RelatedEntityId,
    IReadOnlyList<TicketAttachmentInput>? Attachments) : IRequest<Result<TicketDetailDto>>, ITransactionalRequest;

public sealed class CreateTicketValidator : AbstractValidator<CreateTicketCommand>
{
    public CreateTicketValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.Attachments).Must(a => a is null || a.Count <= 10)
            .WithMessage("حداکثر ۱۰ پیوست برای هر تیکت مجاز است.");
    }
}

public sealed class CreateTicketHandler : IRequestHandler<CreateTicketCommand, Result<TicketDetailDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ICurrentUser _currentUser;

    public CreateTicketHandler(IAppDbContext db, ITenantContext tenant, ICurrentUser currentUser)
    { _db = db; _tenant = tenant; _currentUser = currentUser; }

    public async Task<Result<TicketDetailDto>> Handle(CreateTicketCommand c, CancellationToken ct)
    {
        var tenantId = _tenant.TenantId;
        if (!tenantId.HasValue)
            return Result.Failure<TicketDetailDto>(Error.Validation("Tenant.Missing", "مستاجر مشخص نشده است."));

        var userId = _currentUser.UserId;
        var requester = userId.HasValue
            ? await _db.Users.AsNoTracking().Where(u => u.Id == userId.Value)
                .Select(u => new { u.DisplayName, u.Phone }).FirstOrDefaultAsync(ct)
            : null;

        // شمارهٔ تیکت به‌صورت ترتیبی در دامنهٔ همان مستاجر تولید می‌شود.
        var seq = await _db.Tickets.IgnoreQueryFilters().CountAsync(t => t.TenantId == tenantId.Value, ct) + 1;
        var number = $"TCK-{seq:D5}";

        var ticket = Ticket.Create(tenantId.Value, number, c.Subject, c.Category, c.Priority,
            userId ?? Guid.Empty, requester?.DisplayName ?? _currentUser.Email ?? "کاربر مستاجر",
            requester?.Phone, c.BranchId, c.RelatedEntityType, c.RelatedEntityId);
        _db.Tickets.Add(ticket);

        var message = TicketMessage.Create(tenantId.Value, ticket.Id, userId, ticket.RequesterName,
            TicketActorSide.Tenant, c.Description, isInternalNote: false);
        _db.TicketMessages.Add(message);

        AddAttachments(_db, tenantId.Value, ticket.Id, message.Id, c.Attachments, userId);

        _db.TicketEvents.Add(TicketEvent.Create(tenantId.Value, ticket.Id, TicketEventType.Created, userId,
            ticket.RequesterName, TicketActorSide.Tenant, toValue: ticket.Number));

        await _db.SaveChangesAsync(ct);

        return await TicketDetailBuilder.BuildAsync(_db, ticket, includeInternalNotes: false,
            tenantSlug: null, tenantName: null, assignedToName: null, ct);
    }

    internal static void AddAttachments(IAppDbContext db, Guid tenantId, Guid ticketId, Guid? messageId,
        IReadOnlyList<TicketAttachmentInput>? attachments, Guid? userId)
    {
        if (attachments is null) return;
        foreach (var a in attachments)
        {
            if (string.IsNullOrWhiteSpace(a.Path) || string.IsNullOrWhiteSpace(a.FileName)) continue;
            db.TicketAttachments.Add(TicketAttachment.Create(tenantId, ticketId, messageId, a.FileName,
                a.Path, a.Url, string.IsNullOrWhiteSpace(a.ContentType) ? "application/octet-stream" : a.ContentType,
                Math.Max(0, a.SizeBytes), userId));
        }
    }
}

// ---------- REPLY (tenant) ----------

public sealed record AddMyTicketMessageCommand(Guid TicketId, string Body,
    IReadOnlyList<TicketAttachmentInput>? Attachments) : IRequest<Result<TicketDetailDto>>, ITransactionalRequest;

public sealed class AddMyTicketMessageValidator : AbstractValidator<AddMyTicketMessageCommand>
{
    public AddMyTicketMessageValidator()
    {
        RuleFor(x => x.Body).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.Attachments).Must(a => a is null || a.Count <= 10)
            .WithMessage("حداکثر ۱۰ پیوست برای هر پیام مجاز است.");
    }
}

public sealed class AddMyTicketMessageHandler : IRequestHandler<AddMyTicketMessageCommand, Result<TicketDetailDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public AddMyTicketMessageHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<TicketDetailDto>> Handle(AddMyTicketMessageCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.FirstOrDefaultAsync(t => t.Id == c.TicketId, ct);
        if (ticket is null) return Result.Failure<TicketDetailDto>(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));
        if (ticket.Status is TicketStatus.Closed or TicketStatus.Cancelled)
            return Result.Failure<TicketDetailDto>(Error.Conflict("Ticket.Closed",
                "این تیکت بسته شده است. برای ادامه، ابتدا آن را بازگشایی کنید."));

        var userId = _currentUser.UserId;
        var authorName = userId.HasValue
            ? await _db.Users.AsNoTracking().Where(u => u.Id == userId.Value)
                .Select(u => u.DisplayName).FirstOrDefaultAsync(ct) ?? ticket.RequesterName
            : ticket.RequesterName;

        var message = TicketMessage.Create(ticket.TenantId, ticket.Id, userId, authorName,
            TicketActorSide.Tenant, c.Body, isInternalNote: false);
        _db.TicketMessages.Add(message);
        CreateTicketHandler.AddAttachments(_db, ticket.TenantId, ticket.Id, message.Id, c.Attachments, userId);

        ticket.RegisterMessage(TicketActorSide.Tenant, isInternalNote: false);
        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, TicketEventType.Message, userId,
            authorName, TicketActorSide.Tenant));

        await _db.SaveChangesAsync(ct);

        return await TicketDetailBuilder.BuildAsync(_db, ticket, includeInternalNotes: false,
            tenantSlug: null, tenantName: null, assignedToName: null, ct);
    }
}

// ---------- CLOSE / REOPEN / RATE (tenant) ----------

public sealed record CloseMyTicketCommand(Guid Id, string? Reason) : IRequest<Result>, ITransactionalRequest;

public sealed class CloseMyTicketHandler : IRequestHandler<CloseMyTicketCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public CloseMyTicketHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result> Handle(CloseMyTicketCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.FirstOrDefaultAsync(t => t.Id == c.Id, ct);
        if (ticket is null) return Result.Failure(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));
        if (!ticket.IsOpen) return Result.Failure(Error.Conflict("Ticket.NotOpen", "این تیکت باز نیست."));

        var from = ticket.Status;
        ticket.ChangeStatus(TicketStatus.Closed, _currentUser.UserId);
        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, TicketEventType.Closed,
            _currentUser.UserId, ticket.RequesterName, TicketActorSide.Tenant,
            from.ToString(), TicketStatus.Closed.ToString(), c.Reason));

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record ReopenMyTicketCommand(Guid Id, string? Reason) : IRequest<Result>, ITransactionalRequest;

public sealed class ReopenMyTicketHandler : IRequestHandler<ReopenMyTicketCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public ReopenMyTicketHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result> Handle(ReopenMyTicketCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.FirstOrDefaultAsync(t => t.Id == c.Id, ct);
        if (ticket is null) return Result.Failure(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));
        if (ticket.IsOpen) return Result.Failure(Error.Conflict("Ticket.AlreadyOpen", "این تیکت هم‌اکنون باز است."));

        var from = ticket.Status;
        ticket.Reopen(_currentUser.UserId);
        ticket.RegisterMessage(TicketActorSide.Tenant, isInternalNote: false);
        // بازگشایی همیشه با یک پیام همراه است تا تیم پشتیبانی دلیل را ببیند.
        _db.TicketMessages.Add(TicketMessage.Create(ticket.TenantId, ticket.Id, _currentUser.UserId,
            ticket.RequesterName, TicketActorSide.Tenant,
            string.IsNullOrWhiteSpace(c.Reason) ? "این تیکت توسط مستاجر بازگشایی شد." : c.Reason!, false));
        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, TicketEventType.Reopened,
            _currentUser.UserId, ticket.RequesterName, TicketActorSide.Tenant,
            from.ToString(), TicketStatus.InProgress.ToString(), c.Reason));

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record RateMyTicketCommand(Guid Id, int Rating, string? Comment) : IRequest<Result>, ITransactionalRequest;

public sealed class RateMyTicketValidator : AbstractValidator<RateMyTicketCommand>
{
    public RateMyTicketValidator()
    {
        RuleFor(x => x.Rating).InclusiveBetween(1, 5);
        RuleFor(x => x.Comment).MaximumLength(1000);
    }
}

public sealed class RateMyTicketHandler : IRequestHandler<RateMyTicketCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public RateMyTicketHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result> Handle(RateMyTicketCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.FirstOrDefaultAsync(t => t.Id == c.Id, ct);
        if (ticket is null) return Result.Failure(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));

        ticket.Rate(c.Rating, c.Comment);
        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, TicketEventType.Rated,
            _currentUser.UserId, ticket.RequesterName, TicketActorSide.Tenant,
            toValue: c.Rating.ToString(), note: c.Comment));

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ---------- NOTIFICATION HELPER ----------

public static class TicketNotifier
{
    /// <summary>اعلان درون‌برنامه‌ای برای مستاجر وقتی تیم پلتفرم روی تیکت اقدامی می‌کند.</summary>
    public static void NotifyTenant(IAppDbContext db, Ticket ticket, string title, string body)
    {
        var notification = new AppNotification(ticket.TenantId, NotificationType.SupportReply, title, body,
            "Ticket", ticket.Id);
        if (ticket.RequesterUserId != Guid.Empty) notification.AssignToUser(ticket.RequesterUserId);
        db.AppNotifications.Add(notification);
    }
}
