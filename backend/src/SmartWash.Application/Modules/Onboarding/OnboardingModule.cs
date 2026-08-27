using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Onboarding;

public sealed record OnboardingStateDto(
    int Step,
    bool IsComplete,
    DateTime? CompletedAtUtc,
    bool HasBranch,
    bool HasBay,
    bool HasService);

public sealed record GetOnboardingStateQuery() : IRequest<Result<OnboardingStateDto>>;

public sealed class GetOnboardingStateHandler : IRequestHandler<GetOnboardingStateQuery, Result<OnboardingStateDto>>
{
    private readonly IAppDbContext _db;
    public GetOnboardingStateHandler(IAppDbContext db) => _db = db;

    public async Task<Result<OnboardingStateDto>> Handle(GetOnboardingStateQuery q, CancellationToken ct)
    {
        var settings = await _db.TenantSettings.FirstOrDefaultAsync(ct);
        if (settings is null)
            return Result.Failure<OnboardingStateDto>(Error.NotFound("Tenant.SettingsMissing", "تنظیمات مستاجر یافت نشد."));

        var hasBranch = await _db.Branches.AnyAsync(ct);
        var hasBay = await _db.Bays.AnyAsync(ct);
        var hasService = await _db.Services.AnyAsync(ct);

        return new OnboardingStateDto(
            settings.OnboardingStep,
            settings.IsOnboardingComplete,
            settings.OnboardingCompletedAtUtc,
            hasBranch, hasBay, hasService);
    }
}

public sealed record CompleteOnboardingStepCommand(int Step) : IRequest<Result>, ITransactionalRequest;

public sealed class CompleteOnboardingStepHandler : IRequestHandler<CompleteOnboardingStepCommand, Result>
{
    private readonly IAppDbContext _db;
    public CompleteOnboardingStepHandler(IAppDbContext db) => _db = db;

    public async Task<Result> Handle(CompleteOnboardingStepCommand c, CancellationToken ct)
    {
        var settings = await _db.TenantSettings.FirstOrDefaultAsync(ct);
        if (settings is null)
            return Result.Failure(Error.NotFound("Tenant.SettingsMissing", "تنظیمات مستاجر یافت نشد."));

        if (c.Step <= 0 || c.Step > 4)
            return Result.Failure(Error.Validation("Onboarding.InvalidStep", "گام نامعتبر است."));

        settings.AdvanceOnboarding(c.Step);
        if (c.Step >= 3) settings.CompleteOnboarding();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
