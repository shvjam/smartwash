using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Reservations;

public sealed record ReservationServiceDto(Guid Id, Guid ServiceId, string ServiceName, long PriceRials, int DurationMinutes);
public sealed record ReservationDto(Guid Id, Guid BranchId, Guid? CustomerId, string CustomerName, string CustomerPhone,
    string VehiclePlate, string? VehicleBrand, string? VehicleModel,
    DateTime ScheduledAtUtc, int EstimatedDurationMinutes, Guid? PreferredBayId,
    ReservationStatus Status, Guid? ConvertedOrderId, string? Notes,
    IReadOnlyList<ReservationServiceDto> Services);

public static class ReservationMap
{
    public static ReservationDto ToDto(Reservation r) => new(r.Id, r.BranchId, r.CustomerId, r.CustomerName, r.CustomerPhone,
        r.VehiclePlate, r.VehicleBrand, r.VehicleModel, r.ScheduledAtUtc, r.EstimatedDurationMinutes, r.PreferredBayId,
        r.Status, r.ConvertedOrderId, r.Notes,
        r.Services.Select(s => new ReservationServiceDto(s.Id, s.ServiceId, s.ServiceName, s.PriceRials, s.DurationMinutes)).ToArray());
}

public sealed record SearchReservationsQuery(Guid? BranchId, ReservationStatus? Status, DateTime? FromUtc, DateTime? ToUtc, int Page, int PageSize)
    : IRequest<Result<PagedList<ReservationDto>>>;
public sealed class SearchReservationsHandler : IRequestHandler<SearchReservationsQuery, Result<PagedList<ReservationDto>>>
{
    private readonly IAppDbContext _db;
    public SearchReservationsHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<ReservationDto>>> Handle(SearchReservationsQuery q, CancellationToken ct)
    {
        var query = _db.Reservations.AsNoTracking().Include(r => r.Services).AsQueryable();
        if (q.BranchId.HasValue) query = query.Where(r => r.BranchId == q.BranchId.Value);
        if (q.Status.HasValue) query = query.Where(r => r.Status == q.Status.Value);
        if (q.FromUtc.HasValue) query = query.Where(r => r.ScheduledAtUtc >= q.FromUtc.Value);
        if (q.ToUtc.HasValue) query = query.Where(r => r.ScheduledAtUtc <= q.ToUtc.Value);
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(r => r.ScheduledAtUtc).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return Result.Success(new PagedList<ReservationDto>(items.Select(ReservationMap.ToDto).ToArray(), page, size, total));
    }
}

// ── GetReservation: دریافت رزرو با شناسه ──────────────────────────────────
public sealed record GetReservationQuery(Guid Id) : IRequest<Result<ReservationDto>>;
public sealed class GetReservationHandler : IRequestHandler<GetReservationQuery, Result<ReservationDto>>
{
    private readonly IAppDbContext _db;
    public GetReservationHandler(IAppDbContext db) => _db = db;
    public async Task<Result<ReservationDto>> Handle(GetReservationQuery q, CancellationToken ct)
    {
        var r = await _db.Reservations.Include(x => x.Services).FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        if (r is null) return Result.Failure<ReservationDto>(Error.NotFound("Reservation.NotFound", "رزرو یافت نشد."));
        return ReservationMap.ToDto(r);
    }
}

public sealed record CreateReservationServiceInput(Guid ServiceId);
public sealed record CreateReservationCommand(Guid BranchId, Guid? CustomerId, string CustomerName, string CustomerPhone,
    string VehiclePlate, string? VehicleBrand, string? VehicleModel, DateTime ScheduledAtUtc, Guid? PreferredBayId, string? Notes,
    IReadOnlyList<CreateReservationServiceInput> Services) : IRequest<Result<ReservationDto>>, ITransactionalRequest;

public sealed class CreateReservationValidator : AbstractValidator<CreateReservationCommand>
{
    public CreateReservationValidator()
    {
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.CustomerName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.CustomerPhone).NotEmpty().Matches("^09[0-9]{9}$");
        RuleFor(x => x.VehiclePlate).NotEmpty().MaximumLength(20);
        RuleFor(x => x.ScheduledAtUtc).GreaterThan(DateTime.UtcNow.AddMinutes(-5));
        RuleFor(x => x.Services).NotEmpty();
    }
}

public sealed class CreateReservationHandler : IRequestHandler<CreateReservationCommand, Result<ReservationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantFeatureService _features;
    public CreateReservationHandler(IAppDbContext db, ITenantFeatureService features)
    { _db = db; _features = features; }
    public async Task<Result<ReservationDto>> Handle(CreateReservationCommand c, CancellationToken ct)
    {
        if (!await _features.HasFeatureAsync("reservations", ct))
            return Result.Failure<ReservationDto>(Error.Forbidden("Feature.NotAvailable", "سیستم رزرواسیون در پلن اشتراک شما فعال نیست."));

        var serviceIds = c.Services.Select(s => s.ServiceId).Distinct().ToArray();
        var services = await _db.Services.Where(s => serviceIds.Contains(s.Id)).ToListAsync(ct);
        if (services.Count != serviceIds.Length)
            return Result.Failure<ReservationDto>(Error.NotFound("Service.NotFound", "یکی از خدمات یافت نشد."));

        var totalDuration = services.Sum(s => s.DurationMinutes);
        var r = Reservation.Create(Guid.Empty, c.BranchId, c.CustomerId, c.CustomerName, c.CustomerPhone,
            c.VehiclePlate, c.VehicleBrand, c.VehicleModel, c.ScheduledAtUtc, totalDuration, c.PreferredBayId, c.Notes);
        foreach (var svc in services) r.AddService(svc.Id, svc.Name, svc.PriceRials, svc.DurationMinutes);
        _db.Reservations.Add(r);
        await _db.SaveChangesAsync(ct);
        return ReservationMap.ToDto(r);
    }
}

public sealed record ConfirmReservationCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class ConfirmReservationHandler : IRequestHandler<ConfirmReservationCommand, Result>
{
    private readonly IAppDbContext _db;
    public ConfirmReservationHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(ConfirmReservationCommand c, CancellationToken ct)
    {
        var r = await _db.Reservations.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (r is null) return Result.Failure(Error.NotFound("Reservation.NotFound", "رزرو یافت نشد."));
        r.Confirm();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record CancelReservationCommand(Guid Id, string? Reason) : IRequest<Result>, ITransactionalRequest;
public sealed class CancelReservationHandler : IRequestHandler<CancelReservationCommand, Result>
{
    private readonly IAppDbContext _db;
    public CancelReservationHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(CancelReservationCommand c, CancellationToken ct)
    {
        var r = await _db.Reservations.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (r is null) return Result.Failure(Error.NotFound("Reservation.NotFound", "رزرو یافت نشد."));
        r.Cancel(c.Reason);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record MarkNoShowCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class MarkNoShowHandler : IRequestHandler<MarkNoShowCommand, Result>
{
    private readonly IAppDbContext _db;
    public MarkNoShowHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(MarkNoShowCommand c, CancellationToken ct)
    {
        var r = await _db.Reservations.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (r is null) return Result.Failure(Error.NotFound("Reservation.NotFound", "رزرو یافت نشد."));
        r.MarkNoShow();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
