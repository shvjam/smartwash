using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Application.Modules.Support;
using SmartWash.Domain.Support;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Platform;

/// <summary>
/// میز پشتیبانی پلتفرم. همهٔ کوئری‌ها با IgnoreQueryFilters اجرا می‌شوند چون
/// تیکت‌ها tenant-scoped هستند و پلتفرم باید سراسری به آن‌ها دسترسی داشته باشد.
/// </summary>
public sealed record ListAllTicketsQuery(
    Guid? TenantId, TicketStatus? Status, TicketCategory? Category, TicketPriority? Priority,
    Guid? AssignedToUserId, bool UnassignedOnly, bool OpenOnly, bool SlaBreachedOnly, bool UnansweredOnly,
    string? Search, int Page, int PageSize) : IRequest<Result<PagedList<TicketListItemDto>>>;

public sealed class ListAllTicketsHandler : IRequestHandler<ListAllTicketsQuery, Result<PagedList<TicketListItemDto>>>
{
    private static readonly TicketStatus[] OpenStatuses =
        [TicketStatus.New, TicketStatus.InProgress, TicketStatus.AwaitingCustomer];

    private readonly IAppDbContext _db;
    public ListAllTicketsHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<TicketListItemDto>>> Handle(ListAllTicketsQuery q, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var query = _db.Tickets.IgnoreQueryFilters().AsNoTracking().Where(t => !t.IsDeleted);

        if (q.TenantId.HasValue) query = query.Where(t => t.TenantId == q.TenantId.Value);
        if (q.Status.HasValue) query = query.Where(t => t.Status == q.Status.Value);
        else if (q.OpenOnly) query = query.Where(t => OpenStatuses.Contains(t.Status));
        if (q.Category.HasValue) query = query.Where(t => t.Category == q.Category.Value);
        if (q.Priority.HasValue) query = query.Where(t => t.Priority == q.Priority.Value);
        if (q.AssignedToUserId.HasValue) query = query.Where(t => t.AssignedToUserId == q.AssignedToUserId.Value);
        if (q.UnassignedOnly) query = query.Where(t => t.AssignedToUserId == null);
        if (q.SlaBreachedOnly)
            query = query.Where(t => t.FirstResponseAtUtc == null && t.DueAtUtc < now && OpenStatuses.Contains(t.Status));
        // «بی‌پاسخ» یعنی آخرین پیام از سمت مستاجر بوده و منتظر پاسخ پلتفرم است.
        if (q.UnansweredOnly)
            query = query.Where(t => t.LastMessageSide == TicketActorSide.Tenant && OpenStatuses.Contains(t.Status));
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(t => t.Number.Contains(s) || t.Subject.Contains(s) || t.RequesterName.Contains(s));
        }

        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 25 : q.PageSize, 1, 200);
        var total = await query.CountAsync(ct);

        var items = await (
            // اولویت بالاتر و مهلت نزدیک‌تر، بالای صف پشتیبانی می‌آید.
            from t in query
                .OrderByDescending(x => x.Priority).ThenBy(x => x.DueAtUtc)
                .Skip((page - 1) * size).Take(size)
            join tn in _db.Tenants.IgnoreQueryFilters().AsNoTracking() on t.TenantId equals tn.Id into tnj
            from tn in tnj.DefaultIfEmpty()
            join u in _db.Users.IgnoreQueryFilters().AsNoTracking() on t.AssignedToUserId equals u.Id into uj
            from u in uj.DefaultIfEmpty()
            select new { Ticket = t, TenantSlug = tn != null ? tn.Slug : null, TenantName = tn != null ? tn.DisplayName : null, AgentName = u != null ? u.DisplayName : null }
        ).ToListAsync(ct);

        return Result.Success(new PagedList<TicketListItemDto>(
            items.Select(r => TicketMap.ToListItem(r.Ticket, now, r.TenantSlug, r.TenantName, r.AgentName)).ToArray(),
            page, size, total));
    }
}

// ---------- DETAIL ----------

public sealed record GetTicketAdminQuery(Guid Id) : IRequest<Result<TicketDetailDto>>, ITransactionalRequest;

public sealed class GetTicketAdminHandler : IRequestHandler<GetTicketAdminQuery, Result<TicketDetailDto>>
{
    private readonly IAppDbContext _db;
    public GetTicketAdminHandler(IAppDbContext db) => _db = db;

    public async Task<Result<TicketDetailDto>> Handle(GetTicketAdminQuery q, CancellationToken ct)
    {
        var ticket = await _db.Tickets.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == q.Id && !t.IsDeleted, ct);
        if (ticket is null) return Result.Failure<TicketDetailDto>(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));

        if (ticket.UnreadForPlatform > 0)
        {
            ticket.MarkReadBy(TicketActorSide.Platform);
            await _db.SaveChangesAsync(ct);
        }

        var tenant = await _db.Tenants.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.Id == ticket.TenantId).Select(t => new { t.Slug, t.DisplayName }).FirstOrDefaultAsync(ct);
        var agentName = ticket.AssignedToUserId.HasValue
            ? await _db.Users.IgnoreQueryFilters().AsNoTracking()
                .Where(u => u.Id == ticket.AssignedToUserId.Value).Select(u => u.DisplayName).FirstOrDefaultAsync(ct)
            : null;

        return await TicketDetailBuilder.BuildAsync(_db, ticket, includeInternalNotes: true,
            tenant?.Slug, tenant?.DisplayName, agentName, ct);
    }
}

// ---------- REPLY ----------

public sealed record ReplyToTicketCommand(Guid Id, string Body, bool IsInternalNote,
    IReadOnlyList<TicketAttachmentInput>? Attachments) : IRequest<Result<TicketDetailDto>>, ITransactionalRequest;

public sealed class ReplyToTicketValidator : AbstractValidator<ReplyToTicketCommand>
{
    public ReplyToTicketValidator()
    {
        RuleFor(x => x.Body).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.Attachments).Must(a => a is null || a.Count <= 10)
            .WithMessage("حداکثر ۱۰ پیوست برای هر پیام مجاز است.");
    }
}

public sealed class ReplyToTicketHandler : IRequestHandler<ReplyToTicketCommand, Result<TicketDetailDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public ReplyToTicketHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<TicketDetailDto>> Handle(ReplyToTicketCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == c.Id && !t.IsDeleted, ct);
        if (ticket is null) return Result.Failure<TicketDetailDto>(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));
        if (ticket.Status == TicketStatus.Cancelled)
            return Result.Failure<TicketDetailDto>(Error.Conflict("Ticket.Cancelled", "تیکت لغو شده است."));

        var agentName = await ResolveAgentNameAsync(_db, _currentUser, ct);
        var message = TicketMessage.Create(ticket.TenantId, ticket.Id, _currentUser.UserId, agentName,
            TicketActorSide.Platform, c.Body, c.IsInternalNote);
        _db.TicketMessages.Add(message);
        CreateTicketHandler.AddAttachments(_db, ticket.TenantId, ticket.Id, message.Id, c.Attachments, _currentUser.UserId);

        ticket.RegisterMessage(TicketActorSide.Platform, c.IsInternalNote);
        // پاسخ‌دهنده اگر تیکت بی‌مسئول است، خودش را مسئول می‌کند.
        if (!c.IsInternalNote && ticket.AssignedToUserId is null && _currentUser.UserId.HasValue)
            ticket.AssignTo(_currentUser.UserId);

        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, TicketEventType.Message,
            _currentUser.UserId, agentName, TicketActorSide.Platform,
            note: c.IsInternalNote ? "یادداشت داخلی" : null));

        if (!c.IsInternalNote)
            TicketNotifier.NotifyTenant(_db, ticket, $"پاسخ پشتیبانی برای تیکت {ticket.Number}",
                $"تیم پشتیبانی SmartWash به تیکت «{ticket.Subject}» پاسخ داد.");

        await _db.SaveChangesAsync(ct);

        var tenant = await _db.Tenants.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.Id == ticket.TenantId).Select(t => new { t.Slug, t.DisplayName }).FirstOrDefaultAsync(ct);
        return await TicketDetailBuilder.BuildAsync(_db, ticket, includeInternalNotes: true,
            tenant?.Slug, tenant?.DisplayName, agentName, ct);
    }

    internal static async Task<string> ResolveAgentNameAsync(IAppDbContext db, ICurrentUser currentUser, CancellationToken ct)
    {
        if (!currentUser.UserId.HasValue) return "پشتیبانی SmartWash";
        var name = await db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => u.Id == currentUser.UserId.Value).Select(u => u.DisplayName).FirstOrDefaultAsync(ct);
        return string.IsNullOrWhiteSpace(name) ? currentUser.Email ?? "پشتیبانی SmartWash" : name;
    }
}

// ---------- TRIAGE (status / priority / category / assignment) ----------

public sealed record ChangeTicketStatusCommand(Guid Id, TicketStatus Status, string? Note)
    : IRequest<Result>, ITransactionalRequest;

public sealed class ChangeTicketStatusHandler : IRequestHandler<ChangeTicketStatusCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public ChangeTicketStatusHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result> Handle(ChangeTicketStatusCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == c.Id && !t.IsDeleted, ct);
        if (ticket is null) return Result.Failure(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));

        var from = ticket.Status;
        if (from == c.Status) return Result.Success();

        var agentName = await ReplyToTicketHandler.ResolveAgentNameAsync(_db, _currentUser, ct);
        if (c.Status == TicketStatus.InProgress && !ticket.IsOpen) ticket.Reopen(_currentUser.UserId);
        else ticket.ChangeStatus(c.Status, _currentUser.UserId);

        var type = c.Status switch
        {
            TicketStatus.Resolved => TicketEventType.Resolved,
            TicketStatus.Closed or TicketStatus.Cancelled => TicketEventType.Closed,
            TicketStatus.InProgress when !IsOpenStatus(from) => TicketEventType.Reopened,
            _ => TicketEventType.StatusChanged,
        };
        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, type, _currentUser.UserId,
            agentName, TicketActorSide.Platform, from.ToString(), c.Status.ToString(), c.Note));

        TicketNotifier.NotifyTenant(_db, ticket, $"تغییر وضعیت تیکت {ticket.Number}",
            $"وضعیت تیکت «{ticket.Subject}» به {StatusLabel(c.Status)} تغییر کرد.");

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static bool IsOpenStatus(TicketStatus s) =>
        s is TicketStatus.New or TicketStatus.InProgress or TicketStatus.AwaitingCustomer;

    private static string StatusLabel(TicketStatus s) => s switch
    {
        TicketStatus.New => "جدید",
        TicketStatus.InProgress => "در حال بررسی",
        TicketStatus.AwaitingCustomer => "در انتظار پاسخ شما",
        TicketStatus.Resolved => "حل‌شده",
        TicketStatus.Closed => "بسته‌شده",
        _ => "لغوشده",
    };
}

public sealed record ChangeTicketPriorityCommand(Guid Id, TicketPriority Priority)
    : IRequest<Result>, ITransactionalRequest;

public sealed class ChangeTicketPriorityHandler : IRequestHandler<ChangeTicketPriorityCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public ChangeTicketPriorityHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result> Handle(ChangeTicketPriorityCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == c.Id && !t.IsDeleted, ct);
        if (ticket is null) return Result.Failure(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));

        var from = ticket.Priority;
        if (from == c.Priority) return Result.Success();

        var agentName = await ReplyToTicketHandler.ResolveAgentNameAsync(_db, _currentUser, ct);
        ticket.ChangePriority(c.Priority);
        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, TicketEventType.PriorityChanged,
            _currentUser.UserId, agentName, TicketActorSide.Platform, from.ToString(), c.Priority.ToString()));

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record ChangeTicketCategoryCommand(Guid Id, TicketCategory Category)
    : IRequest<Result>, ITransactionalRequest;

public sealed class ChangeTicketCategoryHandler : IRequestHandler<ChangeTicketCategoryCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public ChangeTicketCategoryHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result> Handle(ChangeTicketCategoryCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == c.Id && !t.IsDeleted, ct);
        if (ticket is null) return Result.Failure(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));

        var from = ticket.Category;
        if (from == c.Category) return Result.Success();

        var agentName = await ReplyToTicketHandler.ResolveAgentNameAsync(_db, _currentUser, ct);
        ticket.ChangeCategory(c.Category);
        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, TicketEventType.CategoryChanged,
            _currentUser.UserId, agentName, TicketActorSide.Platform, from.ToString(), c.Category.ToString()));

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record AssignTicketCommand(Guid Id, Guid? AssignedToUserId) : IRequest<Result>, ITransactionalRequest;

public sealed class AssignTicketHandler : IRequestHandler<AssignTicketCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public AssignTicketHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result> Handle(AssignTicketCommand c, CancellationToken ct)
    {
        var ticket = await _db.Tickets.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == c.Id && !t.IsDeleted, ct);
        if (ticket is null) return Result.Failure(Error.NotFound("Ticket.NotFound", "تیکت یافت نشد."));

        string? targetName = null;
        if (c.AssignedToUserId.HasValue)
        {
            targetName = await _db.Users.IgnoreQueryFilters().AsNoTracking()
                .Where(u => u.Id == c.AssignedToUserId.Value).Select(u => u.DisplayName).FirstOrDefaultAsync(ct);
            if (targetName is null)
                return Result.Failure(Error.NotFound("User.NotFound", "کاربر پشتیبان یافت نشد."));
        }

        var agentName = await ReplyToTicketHandler.ResolveAgentNameAsync(_db, _currentUser, ct);
        ticket.AssignTo(c.AssignedToUserId);
        _db.TicketEvents.Add(TicketEvent.Create(ticket.TenantId, ticket.Id, TicketEventType.Assigned,
            _currentUser.UserId, agentName, TicketActorSide.Platform, toValue: targetName ?? "بدون مسئول"));

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ---------- STATS ----------

public sealed record TicketAgentLoadDto(Guid UserId, string DisplayName, int OpenTickets);
public sealed record TicketCategoryCountDto(TicketCategory Category, int Count);

public sealed record TicketDeskStatsDto(
    int Total, int New, int InProgress, int AwaitingCustomer, int Resolved, int Closed,
    int Unassigned, int SlaBreached, int UnansweredByPlatform,
    double? AvgFirstResponseHours, double? AvgResolutionHours, double? AvgSatisfaction, int RatedCount,
    IReadOnlyList<TicketCategoryCountDto> ByCategory, IReadOnlyList<TicketAgentLoadDto> AgentLoad);

public sealed record GetTicketDeskStatsQuery(Guid? TenantId, DateTime? FromUtc, DateTime? ToUtc)
    : IRequest<Result<TicketDeskStatsDto>>;

public sealed class GetTicketDeskStatsHandler : IRequestHandler<GetTicketDeskStatsQuery, Result<TicketDeskStatsDto>>
{
    private readonly IAppDbContext _db;
    public GetTicketDeskStatsHandler(IAppDbContext db) => _db = db;

    public async Task<Result<TicketDeskStatsDto>> Handle(GetTicketDeskStatsQuery q, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var query = _db.Tickets.IgnoreQueryFilters().AsNoTracking().Where(t => !t.IsDeleted);
        if (q.TenantId.HasValue) query = query.Where(t => t.TenantId == q.TenantId.Value);
        if (q.FromUtc.HasValue) query = query.Where(t => t.CreatedAtUtc >= q.FromUtc.Value);
        if (q.ToUtc.HasValue) query = query.Where(t => t.CreatedAtUtc <= q.ToUtc.Value);

        var rows = await query.Select(t => new
        {
            t.Status, t.Category, t.Priority, t.AssignedToUserId, t.DueAtUtc,
            t.CreatedAtUtc, t.FirstResponseAtUtc, t.ResolvedAtUtc, t.LastMessageSide, t.SatisfactionRating,
        }).ToListAsync(ct);

        bool IsOpen(TicketStatus s) => s is TicketStatus.New or TicketStatus.InProgress or TicketStatus.AwaitingCustomer;

        var responded = rows.Where(r => r.FirstResponseAtUtc.HasValue).ToList();
        var resolved = rows.Where(r => r.ResolvedAtUtc.HasValue).ToList();
        var rated = rows.Where(r => r.SatisfactionRating.HasValue).ToList();

        var byCategory = rows.GroupBy(r => r.Category)
            .Select(g => new TicketCategoryCountDto(g.Key, g.Count()))
            .OrderByDescending(x => x.Count).ToArray();

        var openByAgent = rows
            .Where(r => IsOpen(r.Status) && r.AssignedToUserId.HasValue)
            .GroupBy(r => r.AssignedToUserId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var agentNames = await _db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => openByAgent.Keys.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName }).ToListAsync(ct);

        var agentLoad = agentNames
            .Select(a => new TicketAgentLoadDto(a.Id, a.DisplayName, openByAgent[a.Id]))
            .OrderByDescending(a => a.OpenTickets).ToArray();

        return Result.Success(new TicketDeskStatsDto(
            Total: rows.Count,
            New: rows.Count(r => r.Status == TicketStatus.New),
            InProgress: rows.Count(r => r.Status == TicketStatus.InProgress),
            AwaitingCustomer: rows.Count(r => r.Status == TicketStatus.AwaitingCustomer),
            Resolved: rows.Count(r => r.Status == TicketStatus.Resolved),
            Closed: rows.Count(r => r.Status == TicketStatus.Closed),
            Unassigned: rows.Count(r => IsOpen(r.Status) && r.AssignedToUserId is null),
            SlaBreached: rows.Count(r => r.FirstResponseAtUtc is null && IsOpen(r.Status) && now > r.DueAtUtc),
            UnansweredByPlatform: rows.Count(r => IsOpen(r.Status) && r.LastMessageSide == TicketActorSide.Tenant),
            AvgFirstResponseHours: responded.Count == 0 ? null
                : Math.Round(responded.Average(r => (r.FirstResponseAtUtc!.Value - r.CreatedAtUtc).TotalHours), 2),
            AvgResolutionHours: resolved.Count == 0 ? null
                : Math.Round(resolved.Average(r => (r.ResolvedAtUtc!.Value - r.CreatedAtUtc).TotalHours), 2),
            AvgSatisfaction: rated.Count == 0 ? null
                : Math.Round(rated.Average(r => r.SatisfactionRating!.Value), 2),
            RatedCount: rated.Count,
            ByCategory: byCategory,
            AgentLoad: agentLoad));
    }
}

// ---------- SUPPORT AGENTS (assignment dropdown) ----------

public sealed record SupportAgentDto(Guid Id, string DisplayName, string Email, int OpenTickets);

public sealed record ListSupportAgentsQuery : IRequest<Result<IReadOnlyList<SupportAgentDto>>>;

public sealed class ListSupportAgentsHandler : IRequestHandler<ListSupportAgentsQuery, Result<IReadOnlyList<SupportAgentDto>>>
{
    private readonly IAppDbContext _db;
    public ListSupportAgentsHandler(IAppDbContext db) => _db = db;

    public async Task<Result<IReadOnlyList<SupportAgentDto>>> Handle(ListSupportAgentsQuery q, CancellationToken ct)
    {
        // کارشناس پشتیبانی = کاربر بدون مستاجر (کاربر پلتفرم) و فعال.
        var agents = await _db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => u.TenantId == null && u.IsActive)
            .Select(u => new { u.Id, u.DisplayName, u.Email })
            .ToListAsync(ct);

        var ids = agents.Select(a => a.Id).ToArray();
        var openCounts = await _db.Tickets.IgnoreQueryFilters().AsNoTracking()
            .Where(t => !t.IsDeleted && t.AssignedToUserId != null && ids.Contains(t.AssignedToUserId!.Value)
                && (t.Status == TicketStatus.New || t.Status == TicketStatus.InProgress || t.Status == TicketStatus.AwaitingCustomer))
            .GroupBy(t => t.AssignedToUserId!.Value)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var map = openCounts.ToDictionary(x => x.UserId, x => x.Count);
        return Result.Success<IReadOnlyList<SupportAgentDto>>(agents
            .Select(a => new SupportAgentDto(a.Id, a.DisplayName, a.Email, map.TryGetValue(a.Id, out var n) ? n : 0))
            .OrderBy(a => a.DisplayName).ToArray());
    }
}
