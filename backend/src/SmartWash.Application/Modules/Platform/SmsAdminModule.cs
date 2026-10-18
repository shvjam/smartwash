using System.Text.Json;
using SmartWash.Application.Abstractions.Billing;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Billing;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Platform;

// ---------- DTOs ----------

public sealed record PlatformSmsTemplateDto(Guid Id, string Code, string DisplayName, int ProviderTemplateId,
    SmsTemplateCategory Category, IReadOnlyList<string> Parameters, bool IsTenantAvailable, bool IsActive,
    int AssignedTenantCount, int SentUnitsThisMonth);

public sealed record SmsUsageRecordDto(Guid Id, Guid TenantId, string? TenantName, string? TenantSlug,
    string? TemplateCode, string Purpose, string Recipient, int Units, SmsUsageStatus Status,
    long OverageUnitPriceRials, long BillableAmountRials, string? ProviderMessageId, string? Error, DateTime OccurredAtUtc);

/// <summary>کلید API هرگز بازگردانده نمی‌شود؛ فقط نقاب و وجود/عدم‌وجود آن.</summary>
public sealed record SmsProviderSettingsDto(string Provider, string BaseUrl, string? LineNumber, bool IsEnabled,
    bool HasApiKey, string? ApiKeyMask, DateTime? LastTestedAtUtc, bool? LastTestSucceeded, string? LastTestMessage,
    DateTime? UpdatedAtUtc);

public sealed record SmsDeskStatsDto(int ActiveTemplates, int TenantAvailableTemplates, int SentUnits, int FailedUnits,
    int QueuedUnits, int InvoicedUnits, long BillableAmountRials, int ActiveTenants, DateTime FromUtc, DateTime ToUtc);

public sealed record TenantSmsAssignmentDto(Guid TemplateId, string Code, string DisplayName,
    SmsTemplateCategory Category, bool IsTenantAvailable, bool IsEnabled, int SentUnitsThisPeriod);

public sealed record TenantSmsQuotaDto(Guid TenantId, string TenantName, string TenantSlug, DateTime PeriodStartUtc,
    DateTime PeriodEndUtc, int IncludedUnits, int UsedUnits, int OverageUnits, long OverageUnitPriceRials,
    long OverageAmountRials, int TemplateLimit, int ActiveTemplateCount);

internal static class SmsMap
{
    public static IReadOnlyList<string> Parameters(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
        try { return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>(); }
        catch { return Array.Empty<string>(); }
    }

    public static string ToJson(IReadOnlyList<string>? parameters) =>
        JsonSerializer.Serialize(parameters?.Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p.Trim()).ToArray() ?? Array.Empty<string>());

    public static PlatformSmsTemplateDto ToDto(PlatformSmsTemplate t, int assignedTenantCount, int sentUnits) =>
        new(t.Id, t.Code, t.DisplayName, t.ProviderTemplateId, t.Category, Parameters(t.ParametersJson),
            t.IsTenantAvailable, t.IsActive, assignedTenantCount, sentUnits);

    public static SmsProviderSettingsDto ToDto(PlatformSmsSettings? s) => s is null
        ? new SmsProviderSettingsDto("sms.ir", "https://api.sms.ir/v1/", null, false, false, null, null, null, null, null)
        : new SmsProviderSettingsDto(s.Provider, s.BaseUrl, s.LineNumber, s.IsEnabled,
            !string.IsNullOrWhiteSpace(s.ApiKey), Mask(s.ApiKey), s.LastTestedAtUtc, s.LastTestSucceeded,
            s.LastTestMessage, s.UpdatedAtUtc);

    private static string? Mask(string? key) => string.IsNullOrWhiteSpace(key)
        ? null
        : key.Length <= 8 ? "••••" : $"{key[..4]}••••{key[^4..]}";
}

// ---------- Templates ----------

public sealed record ListPlatformSmsTemplatesQuery(bool? OnlyActive, bool? OnlyTenantAvailable)
    : IRequest<Result<IReadOnlyList<PlatformSmsTemplateDto>>>;

public sealed class ListPlatformSmsTemplatesHandler
    : IRequestHandler<ListPlatformSmsTemplatesQuery, Result<IReadOnlyList<PlatformSmsTemplateDto>>>
{
    private readonly IAppDbContext _db;
    public ListPlatformSmsTemplatesHandler(IAppDbContext db) => _db = db;

    public async Task<Result<IReadOnlyList<PlatformSmsTemplateDto>>> Handle(
        ListPlatformSmsTemplatesQuery q, CancellationToken ct)
    {
        var qry = _db.PlatformSmsTemplates.AsNoTracking().AsQueryable();
        if (q.OnlyActive == true) qry = qry.Where(t => t.IsActive);
        if (q.OnlyTenantAvailable == true) qry = qry.Where(t => t.IsTenantAvailable);
        var templates = await qry.OrderBy(t => t.Category).ThenBy(t => t.DisplayName).ToListAsync(ct);

        var ids = templates.Select(t => t.Id).ToList();
        var assigned = (await _db.TenantSmsTemplates.IgnoreQueryFilters()
                .Where(x => ids.Contains(x.TemplateId))
                .GroupBy(x => x.TemplateId)
                .Select(g => new { TemplateId = g.Key, Count = g.Count() })
                .ToListAsync(ct))
            .ToDictionary(x => x.TemplateId, x => x.Count);

        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var sent = (await _db.SmsUsageRecords.IgnoreQueryFilters()
                .Where(r => r.TemplateId != null && ids.Contains(r.TemplateId.Value)
                            && r.OccurredAtUtc >= monthStart
                            && (r.Status == SmsUsageStatus.Sent || r.Status == SmsUsageStatus.Invoiced))
                .GroupBy(r => r.TemplateId!.Value)
                .Select(g => new { TemplateId = g.Key, Units = g.Sum(x => x.Units) })
                .ToListAsync(ct))
            .ToDictionary(x => x.TemplateId, x => x.Units);

        return Result.Success<IReadOnlyList<PlatformSmsTemplateDto>>(templates
            .Select(t => SmsMap.ToDto(t,
                assigned.TryGetValue(t.Id, out var a) ? a : 0,
                sent.TryGetValue(t.Id, out var s) ? s : 0))
            .ToArray());
    }
}

public sealed record CreatePlatformSmsTemplateCommand(string Code, string DisplayName, int ProviderTemplateId,
    SmsTemplateCategory Category, IReadOnlyList<string>? Parameters, bool IsTenantAvailable)
    : IRequest<Result<PlatformSmsTemplateDto>>, ITransactionalRequest;

public sealed class CreatePlatformSmsTemplateValidator : AbstractValidator<CreatePlatformSmsTemplateCommand>
{
    public CreatePlatformSmsTemplateValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(80);
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(160);
        RuleFor(x => x.ProviderTemplateId).GreaterThan(0);
    }
}

public sealed class CreatePlatformSmsTemplateHandler
    : IRequestHandler<CreatePlatformSmsTemplateCommand, Result<PlatformSmsTemplateDto>>
{
    private readonly IAppDbContext _db;
    public CreatePlatformSmsTemplateHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PlatformSmsTemplateDto>> Handle(CreatePlatformSmsTemplateCommand c, CancellationToken ct)
    {
        var code = c.Code.Trim();
        if (await _db.PlatformSmsTemplates.AnyAsync(t => t.Code == code, ct))
            return Result.Failure<PlatformSmsTemplateDto>(
                Error.Conflict("SmsTemplate.CodeTaken", "کد قالب پیامک تکراری است."));

        var template = PlatformSmsTemplate.Create(code, c.DisplayName, c.ProviderTemplateId, c.Category,
            SmsMap.ToJson(c.Parameters), c.IsTenantAvailable);
        _db.PlatformSmsTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return SmsMap.ToDto(template, 0, 0);
    }
}

public sealed record UpdatePlatformSmsTemplateCommand(Guid Id, string DisplayName, int ProviderTemplateId,
    SmsTemplateCategory Category, IReadOnlyList<string>? Parameters, bool IsTenantAvailable, bool IsActive)
    : IRequest<Result<PlatformSmsTemplateDto>>, ITransactionalRequest;

public sealed class UpdatePlatformSmsTemplateValidator : AbstractValidator<UpdatePlatformSmsTemplateCommand>
{
    public UpdatePlatformSmsTemplateValidator()
    {
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(160);
        RuleFor(x => x.ProviderTemplateId).GreaterThan(0);
    }
}

public sealed class UpdatePlatformSmsTemplateHandler
    : IRequestHandler<UpdatePlatformSmsTemplateCommand, Result<PlatformSmsTemplateDto>>
{
    private readonly IAppDbContext _db;
    public UpdatePlatformSmsTemplateHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PlatformSmsTemplateDto>> Handle(UpdatePlatformSmsTemplateCommand c, CancellationToken ct)
    {
        var template = await _db.PlatformSmsTemplates.FirstOrDefaultAsync(t => t.Id == c.Id, ct);
        if (template is null)
            return Result.Failure<PlatformSmsTemplateDto>(Error.NotFound("SmsTemplate.NotFound", "قالب پیامک یافت نشد."));

        template.Update(c.DisplayName, c.ProviderTemplateId, c.Category, SmsMap.ToJson(c.Parameters), c.IsTenantAvailable);
        template.SetActive(c.IsActive);

        // برداشتنِ قالب از دسترسِ مستاجران، تخصیص‌های موجود را هم باطل می‌کند تا ارسالِ ناخواسته رخ ندهد.
        if (!c.IsTenantAvailable || !c.IsActive)
            await _db.TenantSmsTemplates.IgnoreQueryFilters().Where(x => x.TemplateId == c.Id).ExecuteDeleteAsync(ct);

        await _db.SaveChangesAsync(ct);
        return SmsMap.ToDto(template, 0, 0);
    }
}

// ---------- Tenant assignment (platform-side grant) ----------

public sealed record ListTenantSmsAssignmentsQuery(Guid TenantId) : IRequest<Result<IReadOnlyList<TenantSmsAssignmentDto>>>;

public sealed class ListTenantSmsAssignmentsHandler
    : IRequestHandler<ListTenantSmsAssignmentsQuery, Result<IReadOnlyList<TenantSmsAssignmentDto>>>
{
    private readonly IAppDbContext _db;
    private readonly ISmsDispatcher _dispatcher;
    public ListTenantSmsAssignmentsHandler(IAppDbContext db, ISmsDispatcher dispatcher)
    { _db = db; _dispatcher = dispatcher; }

    public async Task<Result<IReadOnlyList<TenantSmsAssignmentDto>>> Handle(
        ListTenantSmsAssignmentsQuery q, CancellationToken ct)
    {
        var templates = await _db.PlatformSmsTemplates.AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.Category).ThenBy(t => t.DisplayName)
            .ToListAsync(ct);

        var enabled = (await _db.TenantSmsTemplates.IgnoreQueryFilters()
            .Where(x => x.TenantId == q.TenantId)
            .Select(x => x.TemplateId).ToListAsync(ct)).ToHashSet();

        var quota = await _dispatcher.GetQuotaAsync(q.TenantId, ct);
        var usage = (await _db.SmsUsageRecords.IgnoreQueryFilters()
                .Where(r => r.TenantId == q.TenantId && r.TemplateId != null
                            && r.OccurredAtUtc >= quota.PeriodStartUtc && r.OccurredAtUtc < quota.PeriodEndUtc
                            && (r.Status == SmsUsageStatus.Sent || r.Status == SmsUsageStatus.Invoiced))
                .GroupBy(r => r.TemplateId!.Value)
                .Select(g => new { TemplateId = g.Key, Units = g.Sum(x => x.Units) })
                .ToListAsync(ct))
            .ToDictionary(x => x.TemplateId, x => x.Units);

        return Result.Success<IReadOnlyList<TenantSmsAssignmentDto>>(templates
            .Select(t => new TenantSmsAssignmentDto(t.Id, t.Code, t.DisplayName, t.Category, t.IsTenantAvailable,
                enabled.Contains(t.Id), usage.TryGetValue(t.Id, out var u) ? u : 0))
            .ToArray());
    }
}

public sealed record SetTenantSmsTemplateCommand(Guid TenantId, Guid TemplateId, bool Enabled)
    : IRequest<Result>, ITransactionalRequest;

public sealed class SetTenantSmsTemplateHandler : IRequestHandler<SetTenantSmsTemplateCommand, Result>
{
    private readonly IAppDbContext _db;
    public SetTenantSmsTemplateHandler(IAppDbContext db) => _db = db;

    public async Task<Result> Handle(SetTenantSmsTemplateCommand c, CancellationToken ct)
    {
        var result = await TenantSmsTemplateToggle.ApplyAsync(_db, c.TenantId, c.TemplateId, c.Enabled, ct);
        if (result.IsFailure) return result;
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

/// <summary>
/// منطقِ مشترکِ فعال/غیرفعال‌سازی قالب برای یک مستاجر — هم مسیر پلتفرم و هم مسیر خودِ مستاجر
/// از همین قواعد (قابل‌ارائه بودن قالب و سقفِ تعداد قالبِ پلن) پیروی می‌کنند.
/// </summary>
public static class TenantSmsTemplateToggle
{
    public static async Task<Result> ApplyAsync(IAppDbContext db, Guid tenantId, Guid templateId, bool enabled,
        CancellationToken ct)
    {
        var template = await db.PlatformSmsTemplates.AsNoTracking().FirstOrDefaultAsync(t => t.Id == templateId, ct);
        if (template is null) return Result.Failure(Error.NotFound("SmsTemplate.NotFound", "قالب پیامک یافت نشد."));

        var existing = await db.TenantSmsTemplates.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.TemplateId == templateId, ct);

        if (!enabled)
        {
            if (existing is not null) db.TenantSmsTemplates.Remove(existing);
            return Result.Success();
        }

        if (existing is not null) return Result.Success();
        if (!template.IsActive || !template.IsTenantAvailable)
            return Result.Failure(Error.Validation("SmsTemplate.NotAvailable",
                "این قالب در اختیار مستاجران قرار نگرفته است."));

        var limit = await ResolveTemplateLimitAsync(db, tenantId, ct);
        var current = await db.TenantSmsTemplates.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenantId, ct);
        if (limit > 0 && current >= limit)
            return Result.Failure(Error.Validation("SmsTemplate.LimitReached",
                $"سقف قالب‌های پیامکی پلن شما {limit} عدد است."));
        if (limit == 0)
            return Result.Failure(Error.Validation("SmsTemplate.NotIncluded",
                "پلن فعلی شما امکان استفاده از قالب‌های پیامکی را ندارد."));

        db.TenantSmsTemplates.Add(TenantSmsTemplate.Enable(tenantId, templateId));
        return Result.Success();
    }

    private static async Task<int> ResolveTemplateLimitAsync(IAppDbContext db, Guid tenantId, CancellationToken ct)
    {
        var planId = await GoverningPlan.ResolveIdAsync(db, tenantId, ct);
        if (planId is null) return 0;
        return await db.Plans.AsNoTracking().Where(p => p.Id == planId).Select(p => p.IncludedSmsTemplateCount)
            .FirstOrDefaultAsync(ct);
    }
}

// ---------- Usage ledger ----------

public sealed record ListSmsUsageQuery(Guid? TenantId, SmsUsageStatus? Status, Guid? TemplateId,
    DateTime? FromUtc, DateTime? ToUtc, string? Search, int Page, int PageSize)
    : IRequest<Result<PagedList<SmsUsageRecordDto>>>;

public sealed class ListSmsUsageHandler : IRequestHandler<ListSmsUsageQuery, Result<PagedList<SmsUsageRecordDto>>>
{
    private readonly IAppDbContext _db;
    public ListSmsUsageHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<SmsUsageRecordDto>>> Handle(ListSmsUsageQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);

        var qry = _db.SmsUsageRecords.IgnoreQueryFilters().AsNoTracking().AsQueryable();
        if (q.TenantId is not null) qry = qry.Where(r => r.TenantId == q.TenantId);
        if (q.Status is not null) qry = qry.Where(r => r.Status == q.Status);
        if (q.TemplateId is not null) qry = qry.Where(r => r.TemplateId == q.TemplateId);
        if (q.FromUtc is not null) qry = qry.Where(r => r.OccurredAtUtc >= q.FromUtc);
        if (q.ToUtc is not null) qry = qry.Where(r => r.OccurredAtUtc < q.ToUtc);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            qry = qry.Where(r => r.Recipient.Contains(s) || r.Purpose.Contains(s));
        }

        var total = await qry.CountAsync(ct);
        var rows = await qry.OrderByDescending(r => r.OccurredAtUtc).Skip((page - 1) * size).Take(size).ToListAsync(ct);

        var tenantIds = rows.Select(r => r.TenantId).Distinct().ToList();
        var tenants = await _db.Tenants.IgnoreQueryFilters().AsNoTracking()
            .Where(t => tenantIds.Contains(t.Id))
            .Select(t => new { t.Id, t.DisplayName, t.Slug }).ToListAsync(ct);
        var tenantMap = tenants.ToDictionary(t => t.Id);

        var templateIds = rows.Where(r => r.TemplateId != null).Select(r => r.TemplateId!.Value).Distinct().ToList();
        var templateMap = (await _db.PlatformSmsTemplates.AsNoTracking()
            .Where(t => templateIds.Contains(t.Id)).Select(t => new { t.Id, t.Code }).ToListAsync(ct))
            .ToDictionary(t => t.Id, t => t.Code);

        var items = rows.Select(r => new SmsUsageRecordDto(r.Id, r.TenantId,
                tenantMap.TryGetValue(r.TenantId, out var t) ? t.DisplayName : null,
                tenantMap.TryGetValue(r.TenantId, out var t2) ? t2.Slug : null,
                r.TemplateId is not null && templateMap.TryGetValue(r.TemplateId.Value, out var code) ? code : null,
                r.Purpose, r.Recipient, r.Units, r.Status, r.OverageUnitPriceRials, r.BillableAmountRials,
                r.ProviderMessageId, r.Error, r.OccurredAtUtc))
            .ToArray();

        return Result.Success(new PagedList<SmsUsageRecordDto>(items, page, size, total));
    }
}

public sealed record GetSmsDeskStatsQuery(DateTime? FromUtc, DateTime? ToUtc) : IRequest<Result<SmsDeskStatsDto>>;

public sealed class GetSmsDeskStatsHandler : IRequestHandler<GetSmsDeskStatsQuery, Result<SmsDeskStatsDto>>
{
    private readonly IAppDbContext _db;
    public GetSmsDeskStatsHandler(IAppDbContext db) => _db = db;

    public async Task<Result<SmsDeskStatsDto>> Handle(GetSmsDeskStatsQuery q, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var from = q.FromUtc ?? new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = q.ToUtc ?? from.AddMonths(1);

        var rows = await _db.SmsUsageRecords.IgnoreQueryFilters().AsNoTracking()
            .Where(r => r.OccurredAtUtc >= from && r.OccurredAtUtc < to)
            .Select(r => new { r.TenantId, r.Status, r.Units, r.OverageUnitPriceRials })
            .ToListAsync(ct);

        var activeTemplates = await _db.PlatformSmsTemplates.CountAsync(t => t.IsActive, ct);
        var tenantAvailable = await _db.PlatformSmsTemplates.CountAsync(t => t.IsActive && t.IsTenantAvailable, ct);

        int Units(SmsUsageStatus status) => rows.Where(r => r.Status == status).Sum(r => r.Units);

        // فقط ارسال‌های موفق مبلغ‌دار می‌شوند؛ Queued و Failed هرگز.
        var billable = rows
            .Where(r => r.Status is SmsUsageStatus.Sent or SmsUsageStatus.Invoiced)
            .Sum(r => (long)r.Units * r.OverageUnitPriceRials);

        return Result.Success(new SmsDeskStatsDto(activeTemplates, tenantAvailable,
            Units(SmsUsageStatus.Sent), Units(SmsUsageStatus.Failed), Units(SmsUsageStatus.Queued),
            Units(SmsUsageStatus.Invoiced), billable,
            rows.Select(r => r.TenantId).Distinct().Count(), from, to));
    }
}

public sealed record ListTenantSmsQuotasQuery() : IRequest<Result<IReadOnlyList<TenantSmsQuotaDto>>>;

public sealed class ListTenantSmsQuotasHandler
    : IRequestHandler<ListTenantSmsQuotasQuery, Result<IReadOnlyList<TenantSmsQuotaDto>>>
{
    private readonly IAppDbContext _db;
    private readonly ISmsDispatcher _dispatcher;
    public ListTenantSmsQuotasHandler(IAppDbContext db, ISmsDispatcher dispatcher)
    { _db = db; _dispatcher = dispatcher; }

    public async Task<Result<IReadOnlyList<TenantSmsQuotaDto>>> Handle(ListTenantSmsQuotasQuery q, CancellationToken ct)
    {
        var tenants = await _db.Tenants.IgnoreQueryFilters().AsNoTracking()
            .Select(t => new { t.Id, t.DisplayName, t.Slug })
            .OrderBy(t => t.DisplayName)
            .ToListAsync(ct);

        var result = new List<TenantSmsQuotaDto>(tenants.Count);
        foreach (var t in tenants)
        {
            var quota = await _dispatcher.GetQuotaAsync(t.Id, ct);
            if (quota.IncludedUnits == 0 && quota.UsedUnits == 0 && quota.ActiveTemplateCount == 0) continue;
            result.Add(new TenantSmsQuotaDto(t.Id, t.DisplayName, t.Slug, quota.PeriodStartUtc, quota.PeriodEndUtc,
                quota.IncludedUnits, quota.UsedUnits, quota.OverageUnits, quota.OverageUnitPriceRials,
                quota.OverageAmountRials, quota.TemplateLimit, quota.ActiveTemplateCount));
        }
        return Result.Success<IReadOnlyList<TenantSmsQuotaDto>>(result);
    }
}

// ---------- Provider connection (super-admin only) ----------

public sealed record GetSmsProviderSettingsQuery() : IRequest<Result<SmsProviderSettingsDto>>;

public sealed class GetSmsProviderSettingsHandler
    : IRequestHandler<GetSmsProviderSettingsQuery, Result<SmsProviderSettingsDto>>
{
    private readonly IAppDbContext _db;
    public GetSmsProviderSettingsHandler(IAppDbContext db) => _db = db;

    public async Task<Result<SmsProviderSettingsDto>> Handle(GetSmsProviderSettingsQuery q, CancellationToken ct)
        => Result.Success(SmsMap.ToDto(await _db.PlatformSmsSettings.AsNoTracking().FirstOrDefaultAsync(ct)));
}

/// <summary>ارسالِ ApiKey خالی یعنی «کلید فعلی را نگه دار».</summary>
public sealed record UpdateSmsProviderSettingsCommand(string Provider, string BaseUrl, string? ApiKey,
    string? LineNumber, bool IsEnabled) : IRequest<Result<SmsProviderSettingsDto>>, ITransactionalRequest;

public sealed class UpdateSmsProviderSettingsValidator : AbstractValidator<UpdateSmsProviderSettingsCommand>
{
    public UpdateSmsProviderSettingsValidator()
    {
        RuleFor(x => x.Provider).NotEmpty().MaximumLength(60);
        RuleFor(x => x.BaseUrl).NotEmpty().MaximumLength(300);
        RuleFor(x => x.LineNumber).MaximumLength(40);
    }
}

public sealed class UpdateSmsProviderSettingsHandler
    : IRequestHandler<UpdateSmsProviderSettingsCommand, Result<SmsProviderSettingsDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public UpdateSmsProviderSettingsHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<SmsProviderSettingsDto>> Handle(UpdateSmsProviderSettingsCommand c, CancellationToken ct)
    {
        var settings = await _db.PlatformSmsSettings.FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            settings = PlatformSmsSettings.CreateDefault();
            _db.PlatformSmsSettings.Add(settings);
        }
        settings.UpdateConnection(c.Provider, c.BaseUrl, c.ApiKey, c.LineNumber, c.IsEnabled, _currentUser.UserId);
        await _db.SaveChangesAsync(ct);
        return SmsMap.ToDto(settings);
    }
}

public sealed record ClearSmsApiKeyCommand() : IRequest<Result<SmsProviderSettingsDto>>, ITransactionalRequest;

public sealed class ClearSmsApiKeyHandler : IRequestHandler<ClearSmsApiKeyCommand, Result<SmsProviderSettingsDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public ClearSmsApiKeyHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result<SmsProviderSettingsDto>> Handle(ClearSmsApiKeyCommand c, CancellationToken ct)
    {
        var settings = await _db.PlatformSmsSettings.FirstOrDefaultAsync(ct);
        if (settings is null)
            return Result.Failure<SmsProviderSettingsDto>(
                Error.NotFound("SmsSettings.NotFound", "تنظیمات سرویس پیامک ثبت نشده است."));
        settings.ClearApiKey(_currentUser.UserId);
        await _db.SaveChangesAsync(ct);
        return SmsMap.ToDto(settings);
    }
}

public sealed record SendSmsTestCommand(string Recipient, string? Body) : IRequest<Result<SmsProviderSettingsDto>>;

public sealed class SendSmsTestValidator : AbstractValidator<SendSmsTestCommand>
{
    public SendSmsTestValidator()
        => RuleFor(x => x.Recipient).NotEmpty().Matches(@"^09\d{9}$")
            .WithMessage("شماره موبایل باید ۱۱ رقم و با ۰۹ آغاز شود.");
}

public sealed class SendSmsTestHandler : IRequestHandler<SendSmsTestCommand, Result<SmsProviderSettingsDto>>
{
    private readonly IAppDbContext _db;
    private readonly ISmsSender _sender;
    public SendSmsTestHandler(IAppDbContext db, ISmsSender sender) { _db = db; _sender = sender; }

    public async Task<Result<SmsProviderSettingsDto>> Handle(SendSmsTestCommand c, CancellationToken ct)
    {
        var settings = await _db.PlatformSmsSettings.FirstOrDefaultAsync(ct);
        if (settings is null || string.IsNullOrWhiteSpace(settings.ApiKey))
            return Result.Failure<SmsProviderSettingsDto>(
                Error.Validation("SmsSettings.NotConfigured", "ابتدا کلید API سرویس پیامک را ثبت کنید."));

        // ارسال آزمایشی به هیچ مستاجری تعلق ندارد، پس در دفتر مصرف و صورتحساب ثبت نمی‌شود.
        var body = string.IsNullOrWhiteSpace(c.Body) ? "SmartWash: ارسال آزمایشی سرویس پیامک." : c.Body!.Trim();
        var result = await _sender.TrySendTextAsync(c.Recipient, body,
            new SmsCredentials(settings.ApiKey!, settings.LineNumber, settings.BaseUrl), ct);

        settings.RecordTest(result.Succeeded, result.Succeeded ? "ارسال آزمایشی موفق بود." : result.Error);
        await _db.SaveChangesAsync(ct);
        return SmsMap.ToDto(settings);
    }
}
