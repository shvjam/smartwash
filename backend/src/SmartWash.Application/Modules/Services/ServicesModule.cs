using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Services;

public sealed record ServiceDto(Guid Id, string Name, string? Description, ServiceCategory Category, long PriceRials, int DurationMinutes, decimal WorkerCommissionRate, bool IsActive, int SortOrder, string? IconKey);
public static class ServiceMap
{
    public static ServiceDto ToDto(Service s) => new(s.Id, s.Name, s.Description, s.Category, s.PriceRials, s.DurationMinutes, s.WorkerCommissionRate, s.IsActive, s.SortOrder, s.IconKey);
}

public sealed record ListServicesQuery(bool OnlyActive, ServiceCategory? Category) : IRequest<Result<IReadOnlyList<ServiceDto>>>;
public sealed class ListServicesHandler : IRequestHandler<ListServicesQuery, Result<IReadOnlyList<ServiceDto>>>
{
    private readonly IAppDbContext _db;
    public ListServicesHandler(IAppDbContext db) => _db = db;
    public async Task<Result<IReadOnlyList<ServiceDto>>> Handle(ListServicesQuery q, CancellationToken ct)
    {
        var query = _db.Services.AsNoTracking().AsQueryable();
        if (q.OnlyActive) query = query.Where(x => x.IsActive);
        if (q.Category.HasValue) query = query.Where(x => x.Category == q.Category.Value);
        var items = await query.OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ServiceDto>>(items.Select(ServiceMap.ToDto).ToArray());
    }
}

public sealed record CreateServiceCommand(string Name, string? Description, ServiceCategory Category, long PriceRials, int DurationMinutes, decimal WorkerCommissionRate) : IRequest<Result<ServiceDto>>, ITransactionalRequest;
public sealed class CreateServiceValidator : AbstractValidator<CreateServiceCommand>
{
    public CreateServiceValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.PriceRials).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DurationMinutes).GreaterThan(0).LessThanOrEqualTo(480);
        RuleFor(x => x.WorkerCommissionRate).InclusiveBetween(0m, 1m).WithMessage("نرخ کمیسیون باید کسری بین ۰ تا ۱ باشد (مثلاً ۰.۱ برای ۱۰٪).");
    }
}
public sealed class CreateServiceHandler : IRequestHandler<CreateServiceCommand, Result<ServiceDto>>
{
    private readonly IAppDbContext _db;
    public CreateServiceHandler(IAppDbContext db) => _db = db;
    public async Task<Result<ServiceDto>> Handle(CreateServiceCommand c, CancellationToken ct)
    {
        // c.Description قبلاً نادیده گرفته می‌شد و هنگام ایجادِ خدمت از دست می‌رفت.
        var s = Service.Create(Guid.Empty, c.Name, c.Category, c.PriceRials, c.DurationMinutes, c.WorkerCommissionRate, c.Description);
        _db.Services.Add(s);
        await _db.SaveChangesAsync(ct);
        return ServiceMap.ToDto(s);
    }
}

public sealed record UpdateServiceCommand(Guid Id, string Name, string? Description, ServiceCategory Category, long PriceRials, int DurationMinutes, decimal WorkerCommissionRate, int SortOrder, string? IconKey) : IRequest<Result<ServiceDto>>, ITransactionalRequest;
public sealed class UpdateServiceHandler : IRequestHandler<UpdateServiceCommand, Result<ServiceDto>>
{
    private readonly IAppDbContext _db;
    public UpdateServiceHandler(IAppDbContext db) => _db = db;
    public async Task<Result<ServiceDto>> Handle(UpdateServiceCommand c, CancellationToken ct)
    {
        var s = await _db.Services.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (s is null) return Result.Failure<ServiceDto>(Error.NotFound("Service.NotFound", "خدمت یافت نشد."));
        s.Update(c.Name, c.Description, c.Category, c.PriceRials, c.DurationMinutes, c.WorkerCommissionRate, c.SortOrder, c.IconKey);
        await _db.SaveChangesAsync(ct);
        return ServiceMap.ToDto(s);
    }
}

public sealed record SetServiceActiveCommand(Guid Id, bool IsActive) : IRequest<Result>, ITransactionalRequest;
public sealed class SetServiceActiveHandler : IRequestHandler<SetServiceActiveCommand, Result>
{
    private readonly IAppDbContext _db;
    public SetServiceActiveHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(SetServiceActiveCommand c, CancellationToken ct)
    {
        var s = await _db.Services.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (s is null) return Result.Failure(Error.NotFound("Service.NotFound", "خدمت یافت نشد."));
        if (c.IsActive) s.Activate(); else s.Deactivate();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
