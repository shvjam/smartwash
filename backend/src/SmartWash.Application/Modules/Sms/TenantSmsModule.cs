using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Application.Modules.Platform;
using SmartWash.Domain.Billing;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Sms;

/// <summary>
/// دیدِ مستاجر از سرویس پیامک: سهمیه، قالب‌های مجاز و دفترِ ارسال‌های خودش.
/// هیچ‌یک از DTOهای این ماژول شناسه قالبِ تامین‌کننده، کلید API یا خط ارسال را افشا نمی‌کند.
/// </summary>
public sealed record MySmsSummaryDto(DateTime PeriodStartUtc, DateTime PeriodEndUtc, int IncludedUnits, int UsedUnits,
    int OverageUnits, long OverageUnitPriceRials, long OverageAmountRials, int ActiveTemplateCount, int TemplateLimit,
    bool CanSend, string? BlockReason, int FailedUnitsThisPeriod);

public sealed record MySmsTemplateDto(Guid Id, string Code, string DisplayName, SmsTemplateCategory Category,
    IReadOnlyList<string> Parameters, bool IsEnabled, int SentUnitsThisPeriod);

public sealed record MySmsUsageDto(Guid Id, string? TemplateCode, string Purpose, string Recipient, int Units,
    SmsUsageStatus Status, long BillableAmountRials, string? Error, DateTime OccurredAtUtc);

public sealed record GetMySmsSummaryQuery() : IRequest<Result<MySmsSummaryDto>>;

public sealed class GetMySmsSummaryHandler : IRequestHandler<GetMySmsSummaryQuery, Result<MySmsSummaryDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly ISmsDispatcher _dispatcher;

    public GetMySmsSummaryHandler(IAppDbContext db, ICurrentUser currentUser, ISmsDispatcher dispatcher)
    { _db = db; _currentUser = currentUser; _dispatcher = dispatcher; }

    public async Task<Result<MySmsSummaryDto>> Handle(GetMySmsSummaryQuery q, CancellationToken ct)
    {
        if (_currentUser.TenantId is not { } tenantId)
            return Result.Failure<MySmsSummaryDto>(Error.Forbidden("Sms.NoTenant", "کارواش جاری مشخص نیست."));

        var quota = await _dispatcher.GetQuotaAsync(tenantId, ct);
        var failed = await _db.SmsUsageRecords
            .Where(r => r.Status == SmsUsageStatus.Failed
                        && r.OccurredAtUtc >= quota.PeriodStartUtc && r.OccurredAtUtc < quota.PeriodEndUtc)
            .SumAsync(r => (int?)r.Units, ct) ?? 0;

        return Result.Success(new MySmsSummaryDto(quota.PeriodStartUtc, quota.PeriodEndUtc, quota.IncludedUnits,
            quota.UsedUnits, quota.OverageUnits, quota.OverageUnitPriceRials, quota.OverageAmountRials,
            quota.ActiveTemplateCount, quota.TemplateLimit, quota.CanSend, quota.BlockReason, failed));
    }
}

public sealed record ListMySmsTemplatesQuery() : IRequest<Result<IReadOnlyList<MySmsTemplateDto>>>;

public sealed class ListMySmsTemplatesHandler
    : IRequestHandler<ListMySmsTemplatesQuery, Result<IReadOnlyList<MySmsTemplateDto>>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly ISmsDispatcher _dispatcher;

    public ListMySmsTemplatesHandler(IAppDbContext db, ICurrentUser currentUser, ISmsDispatcher dispatcher)
    { _db = db; _currentUser = currentUser; _dispatcher = dispatcher; }

    public async Task<Result<IReadOnlyList<MySmsTemplateDto>>> Handle(ListMySmsTemplatesQuery q, CancellationToken ct)
    {
        if (_currentUser.TenantId is not { } tenantId)
            return Result.Failure<IReadOnlyList<MySmsTemplateDto>>(Error.Forbidden("Sms.NoTenant", "کارواش جاری مشخص نیست."));

        // مستاجر تنها قالب‌هایی را می‌بیند که پلتفرم در اختیار مستاجران گذاشته است.
        var templates = await _db.PlatformSmsTemplates.AsNoTracking()
            .Where(t => t.IsActive && t.IsTenantAvailable)
            .OrderBy(t => t.Category).ThenBy(t => t.DisplayName)
            .ToListAsync(ct);

        var enabled = (await _db.TenantSmsTemplates.Select(x => x.TemplateId).ToListAsync(ct)).ToHashSet();
        var quota = await _dispatcher.GetQuotaAsync(tenantId, ct);

        var usage = (await _db.SmsUsageRecords
                .Where(r => r.TemplateId != null
                            && r.OccurredAtUtc >= quota.PeriodStartUtc && r.OccurredAtUtc < quota.PeriodEndUtc
                            && (r.Status == SmsUsageStatus.Sent || r.Status == SmsUsageStatus.Invoiced))
                .GroupBy(r => r.TemplateId!.Value)
                .Select(g => new { TemplateId = g.Key, Units = g.Sum(x => x.Units) })
                .ToListAsync(ct))
            .ToDictionary(x => x.TemplateId, x => x.Units);

        return Result.Success<IReadOnlyList<MySmsTemplateDto>>(templates
            .Select(t => new MySmsTemplateDto(t.Id, t.Code, t.DisplayName, t.Category,
                SmsMap.Parameters(t.ParametersJson), enabled.Contains(t.Id),
                usage.TryGetValue(t.Id, out var u) ? u : 0))
            .ToArray());
    }
}

public sealed record SetMySmsTemplateCommand(Guid TemplateId, bool Enabled) : IRequest<Result>, ITransactionalRequest;

public sealed class SetMySmsTemplateHandler : IRequestHandler<SetMySmsTemplateCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public SetMySmsTemplateHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<Result> Handle(SetMySmsTemplateCommand c, CancellationToken ct)
    {
        if (_currentUser.TenantId is not { } tenantId)
            return Result.Failure(Error.Forbidden("Sms.NoTenant", "کارواش جاری مشخص نیست."));

        var result = await TenantSmsTemplateToggle.ApplyAsync(_db, tenantId, c.TemplateId, c.Enabled, ct);
        if (result.IsFailure) return result;
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record ListMySmsUsageQuery(SmsUsageStatus? Status, int Page, int PageSize)
    : IRequest<Result<PagedList<MySmsUsageDto>>>;

public sealed class ListMySmsUsageHandler : IRequestHandler<ListMySmsUsageQuery, Result<PagedList<MySmsUsageDto>>>
{
    private readonly IAppDbContext _db;
    public ListMySmsUsageHandler(IAppDbContext db) => _db = db;

    public async Task<Result<PagedList<MySmsUsageDto>>> Handle(ListMySmsUsageQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 100);

        // فیلترِ سراسریِ مستاجر خودکار اعمال می‌شود؛ مستاجر فقط ارسال‌های خودش را می‌بیند.
        var qry = _db.SmsUsageRecords.AsNoTracking().AsQueryable();
        if (q.Status is not null) qry = qry.Where(r => r.Status == q.Status);

        var total = await qry.CountAsync(ct);
        var rows = await qry.OrderByDescending(r => r.OccurredAtUtc)
            .Skip((page - 1) * size).Take(size).ToListAsync(ct);

        var templateIds = rows.Where(r => r.TemplateId != null).Select(r => r.TemplateId!.Value).Distinct().ToList();
        var codes = (await _db.PlatformSmsTemplates.AsNoTracking()
                .Where(t => templateIds.Contains(t.Id)).Select(t => new { t.Id, t.Code }).ToListAsync(ct))
            .ToDictionary(t => t.Id, t => t.Code);

        var items = rows.Select(r => new MySmsUsageDto(r.Id,
                r.TemplateId is not null && codes.TryGetValue(r.TemplateId.Value, out var code) ? code : null,
                r.Purpose, r.Recipient, r.Units, r.Status, r.BillableAmountRials, r.Error, r.OccurredAtUtc))
            .ToArray();

        return Result.Success(new PagedList<MySmsUsageDto>(items, page, size, total));
    }
}
