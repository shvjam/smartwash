using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Campaigns;

public sealed record CampaignDto(Guid Id, string Name, CampaignType Type, CampaignStatus Status, CampaignTarget Target,
    string MessageTemplate, DateTime? ScheduledAtUtc, int? TargetMinVisits, int? TargetDaysSinceLastVisit, LoyaltyTier? TargetMinTier,
    int RecipientCount, int SuccessCount, int FailedCount, long EstimatedCostRials, long ActualCostRials,
    DateTime? StartedAtUtc, DateTime? CompletedAtUtc, DateTime CreatedAtUtc);

public static class CampaignMap
{
    public static CampaignDto ToDto(Campaign c) => new(c.Id, c.Name, c.Type, c.Status, c.Target, c.MessageTemplate, c.ScheduledAtUtc,
        c.TargetMinVisits, c.TargetDaysSinceLastVisit, c.TargetMinTier, c.RecipientCount, c.SuccessCount, c.FailedCount,
        c.EstimatedCostRials, c.ActualCostRials, c.StartedAtUtc, c.CompletedAtUtc, c.CreatedAtUtc);
}

public sealed record ListCampaignsQuery(CampaignStatus? Status) : IRequest<Result<IReadOnlyList<CampaignDto>>>;
public sealed class ListCampaignsHandler : IRequestHandler<ListCampaignsQuery, Result<IReadOnlyList<CampaignDto>>>
{
    private readonly IAppDbContext _db;
    public ListCampaignsHandler(IAppDbContext db) => _db = db;
    public async Task<Result<IReadOnlyList<CampaignDto>>> Handle(ListCampaignsQuery q, CancellationToken ct)
    {
        var query = _db.Campaigns.AsNoTracking().AsQueryable();
        if (q.Status.HasValue) query = query.Where(c => c.Status == q.Status.Value);
        var items = await query.OrderByDescending(c => c.CreatedAtUtc).ToListAsync(ct);
        return Result.Success<IReadOnlyList<CampaignDto>>(items.Select(CampaignMap.ToDto).ToArray());
    }
}

public sealed record CreateCampaignCommand(string Name, CampaignType Type, CampaignTarget Target, string MessageTemplate,
    DateTime? ScheduledAtUtc, int? MinVisits, int? DaysSinceLastVisit, LoyaltyTier? MinTier) : IRequest<Result<CampaignDto>>, ITransactionalRequest;

public sealed class CreateCampaignValidator : AbstractValidator<CreateCampaignCommand>
{
    public CreateCampaignValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.MessageTemplate).NotEmpty().MaximumLength(2000);
    }
}

public sealed class CreateCampaignHandler : IRequestHandler<CreateCampaignCommand, Result<CampaignDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantFeatureService _features;
    public CreateCampaignHandler(IAppDbContext db, ITenantFeatureService features)
    { _db = db; _features = features; }
    public async Task<Result<CampaignDto>> Handle(CreateCampaignCommand c, CancellationToken ct)
    {
        if (!await _features.HasFeatureAsync("campaigns", ct))
            return Result.Failure<CampaignDto>(Error.Forbidden("Feature.NotAvailable", "کمپین‌های پیامکی در پلن اشتراک شما فعال نیست."));

        var camp = Campaign.Create(Guid.Empty, c.Name, c.Type, c.Target, c.MessageTemplate, c.ScheduledAtUtc);
        camp.SetSegmentFilters(c.MinVisits, c.DaysSinceLastVisit, c.MinTier);
        _db.Campaigns.Add(camp);
        await _db.SaveChangesAsync(ct);
        return CampaignMap.ToDto(camp);
    }
}

public sealed record ScheduleCampaignCommand(Guid Id, DateTime ScheduledAtUtc) : IRequest<Result>, ITransactionalRequest;
public sealed class ScheduleCampaignHandler : IRequestHandler<ScheduleCampaignCommand, Result>
{
    private readonly IAppDbContext _db;
    public ScheduleCampaignHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(ScheduleCampaignCommand c, CancellationToken ct)
    {
        var camp = await _db.Campaigns.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (camp is null) return Result.Failure(Error.NotFound("Campaign.NotFound", "کمپین یافت نشد."));
        camp.Schedule(c.ScheduledAtUtc);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record CancelCampaignCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class CancelCampaignHandler : IRequestHandler<CancelCampaignCommand, Result>
{
    private readonly IAppDbContext _db;
    public CancelCampaignHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(CancelCampaignCommand c, CancellationToken ct)
    {
        var camp = await _db.Campaigns.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (camp is null) return Result.Failure(Error.NotFound("Campaign.NotFound", "کمپین یافت نشد."));
        camp.Cancel();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
