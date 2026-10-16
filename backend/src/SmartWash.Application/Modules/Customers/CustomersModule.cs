using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Pagination;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Customers;

public sealed record CustomerVehicleDto(Guid Id, string Plate, string Brand, string Model, string? Color, int? Year);
public sealed record CustomerDto(Guid Id, string FullName, string Phone, string? Email, string? NationalId, DateOnly? BirthDate, Gender Gender, string? Address, string? Notes,
    long WalletBalanceRials, int LoyaltyPoints, LoyaltyTier Tier, int TotalVisits, long LifetimeSpendRials, DateTime? LastVisitAtUtc, bool IsActive,
    // فیلدهای وفاداری — برای محاسبه صحیح خدمت رایگان در frontend
    int FreeServicesUsed, bool HasFreeServiceAvailable,
    IReadOnlyList<CustomerVehicleDto> Vehicles);

public static class CustomerMap
{
    public static CustomerDto ToDto(Customer c) => new(c.Id, c.FullName, c.Phone, c.Email, c.NationalId, c.BirthDate, c.Gender, c.Address, c.Notes,
        c.WalletBalanceRials, c.LoyaltyPoints, c.Tier, c.TotalVisits, c.LifetimeSpendRials, c.LastVisitAtUtc, c.IsActive,
        c.FreeServicesUsed, c.HasFreeServiceAvailable,
        c.Vehicles.Select(v => new CustomerVehicleDto(v.Id, v.Plate, v.Brand, v.Model, v.Color, v.Year)).ToArray());
}

public sealed record SearchCustomersQuery(string? Search, LoyaltyTier? Tier, int Page, int PageSize) : IRequest<Result<PagedList<CustomerDto>>>;
public sealed class SearchCustomersHandler : IRequestHandler<SearchCustomersQuery, Result<PagedList<CustomerDto>>>
{
    private readonly IAppDbContext _db;
    public SearchCustomersHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<CustomerDto>>> Handle(SearchCustomersQuery q, CancellationToken ct)
    {
        var query = _db.Customers.AsNoTracking().Include(x => x.Vehicles).AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(c => c.FullName.Contains(s) || c.Phone.Contains(s) || (c.Email != null && c.Email.Contains(s)));
        }
        if (q.Tier.HasValue) query = query.Where(c => c.Tier == q.Tier.Value);
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(c => c.CreatedAtUtc).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return Result.Success(new PagedList<CustomerDto>(items.Select(CustomerMap.ToDto).ToArray(), page, size, total));
    }
}

public sealed record GetCustomerQuery(Guid Id) : IRequest<Result<CustomerDto>>;
public sealed class GetCustomerHandler : IRequestHandler<GetCustomerQuery, Result<CustomerDto>>
{
    private readonly IAppDbContext _db;
    public GetCustomerHandler(IAppDbContext db) => _db = db;
    public async Task<Result<CustomerDto>> Handle(GetCustomerQuery q, CancellationToken ct)
    {
        var c = await _db.Customers.AsNoTracking().Include(x => x.Vehicles).FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        return c is null ? Result.Failure<CustomerDto>(Error.NotFound("Customer.NotFound", "مشتری یافت نشد.")) : CustomerMap.ToDto(c);
    }
}

public sealed record CreateCustomerCommand(string FullName, string Phone, string? Email) : IRequest<Result<CustomerDto>>, ITransactionalRequest;
public sealed class CreateCustomerValidator : AbstractValidator<CreateCustomerCommand>
{
    public CreateCustomerValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Phone).NotEmpty().Matches("^09[0-9]{9}$").WithMessage("شماره موبایل معتبر نیست.");
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}
public sealed class CreateCustomerHandler : IRequestHandler<CreateCustomerCommand, Result<CustomerDto>>
{
    private readonly IAppDbContext _db;
    public CreateCustomerHandler(IAppDbContext db) => _db = db;
    public async Task<Result<CustomerDto>> Handle(CreateCustomerCommand c, CancellationToken ct)
    {
        if (await _db.Customers.AnyAsync(x => x.Phone == c.Phone, ct))
            return Result.Failure<CustomerDto>(Error.Conflict("Customer.PhoneTaken", "این شماره قبلاً ثبت شده است."));
        var cust = Customer.Create(Guid.Empty, c.FullName, c.Phone, c.Email);
        _db.Customers.Add(cust);
        await _db.SaveChangesAsync(ct);
        return CustomerMap.ToDto(cust);
    }
}

public sealed record UpdateCustomerCommand(Guid Id, string FullName, string Phone, string? Email, string? NationalId, DateOnly? BirthDate, Gender Gender, string? Address, string? Notes) : IRequest<Result<CustomerDto>>, ITransactionalRequest;
public sealed class UpdateCustomerHandler : IRequestHandler<UpdateCustomerCommand, Result<CustomerDto>>
{
    private readonly IAppDbContext _db;
    public UpdateCustomerHandler(IAppDbContext db) => _db = db;
    public async Task<Result<CustomerDto>> Handle(UpdateCustomerCommand c, CancellationToken ct)
    {
        var cust = await _db.Customers.Include(x => x.Vehicles).FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (cust is null) return Result.Failure<CustomerDto>(Error.NotFound("Customer.NotFound", "مشتری یافت نشد."));
        cust.Update(c.FullName, c.Phone, c.Email, c.NationalId, c.BirthDate, c.Gender, c.Address, c.Notes);
        await _db.SaveChangesAsync(ct);
        return CustomerMap.ToDto(cust);
    }
}

public sealed record AddCustomerVehicleCommand(Guid CustomerId, string Plate, string Brand, string Model, string? Color, int? Year) : IRequest<Result<CustomerVehicleDto>>, ITransactionalRequest;
public sealed class AddCustomerVehicleValidator : AbstractValidator<AddCustomerVehicleCommand>
{
    public AddCustomerVehicleValidator()
    {
        RuleFor(x => x.Plate).NotEmpty().MaximumLength(20);
        // Optional: at the bay the operator knows the plate and little else, and demanding a
        // make and model meant the car was never saved at all — so the customer's next visit
        // started with an empty plate and the car had no history.
        RuleFor(x => x.Brand).MaximumLength(60);
        RuleFor(x => x.Model).MaximumLength(80);
        RuleFor(x => x.Year).InclusiveBetween(1300, 1500).When(x => x.Year.HasValue);
    }
}
public sealed class AddCustomerVehicleHandler : IRequestHandler<AddCustomerVehicleCommand, Result<CustomerVehicleDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantFeatureService _features;
    public AddCustomerVehicleHandler(IAppDbContext db, ITenantFeatureService features) { _db = db; _features = features; }
    public async Task<Result<CustomerVehicleDto>> Handle(AddCustomerVehicleCommand c, CancellationToken ct)
    {
        var cust = await _db.Customers.Include(x => x.Vehicles).FirstOrDefaultAsync(x => x.Id == c.CustomerId, ct);
        if (cust is null) return Result.Failure<CustomerVehicleDto>(Error.NotFound("Customer.NotFound", "مشتری یافت نشد."));
        var limit = await _features.GetLimitAsync("limit.vehicles", ct);
        if (limit.HasValue)
        {
            var count = await _db.CustomerVehicles.CountAsync(ct);
            if (count >= limit.Value)
                return Result.Failure<CustomerVehicleDto>(Error.Conflict("Quota.Exceeded", $"سقف تعداد خودروهای پلن ({limit.Value}) پر شده است."));
        }
        var v = cust.AddVehicle(c.Plate, c.Brand, c.Model, c.Color, c.Year);
        await _db.SaveChangesAsync(ct);
        return new CustomerVehicleDto(v.Id, v.Plate, v.Brand, v.Model, v.Color, v.Year);
    }
}

public sealed record RemoveCustomerVehicleCommand(Guid CustomerId, Guid VehicleId) : IRequest<Result>, ITransactionalRequest;
public sealed class RemoveCustomerVehicleHandler : IRequestHandler<RemoveCustomerVehicleCommand, Result>
{
    private readonly IAppDbContext _db;
    public RemoveCustomerVehicleHandler(IAppDbContext db) => _db = db;
    public async Task<Result> Handle(RemoveCustomerVehicleCommand c, CancellationToken ct)
    {
        var cust = await _db.Customers.Include(x => x.Vehicles).FirstOrDefaultAsync(x => x.Id == c.CustomerId, ct);
        if (cust is null) return Result.Failure(Error.NotFound("Customer.NotFound", "مشتری یافت نشد."));
        cust.RemoveVehicle(c.VehicleId);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record AdjustWalletCommand(Guid CustomerId, long AmountRials, string? Description) : IRequest<Result<long>>, ITransactionalRequest;
public sealed class AdjustWalletValidator : AbstractValidator<AdjustWalletCommand>
{
    public AdjustWalletValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.AmountRials).NotEqual(0).WithMessage("مبلغ تغییر کیف پول نمی‌تواند صفر باشد.");
    }
}
public sealed class AdjustWalletHandler : IRequestHandler<AdjustWalletCommand, Result<long>>
{
    private readonly IAppDbContext _db;
    public AdjustWalletHandler(IAppDbContext db) => _db = db;
    public async Task<Result<long>> Handle(AdjustWalletCommand c, CancellationToken ct)
    {
        var cust = await _db.Customers.FirstOrDefaultAsync(x => x.Id == c.CustomerId, ct);
        if (cust is null) return Result.Failure<long>(Error.NotFound("Customer.NotFound", "مشتری یافت نشد."));
        cust.AdjustWallet(c.AmountRials);
        var tx = new WalletTransaction(Guid.Empty, cust.Id, c.AmountRials >= 0 ? WalletTransactionType.Charge : WalletTransactionType.Spend, c.AmountRials, cust.WalletBalanceRials, c.Description, null);
        _db.WalletTransactions.Add(tx);
        await _db.SaveChangesAsync(ct);
        return Result.Success(cust.WalletBalanceRials);
    }
}

public sealed record WalletTransactionDto(Guid Id, WalletTransactionType Type, long AmountRials, long BalanceAfterRials, string? Description, Guid? RelatedOrderId, DateTime OccurredAtUtc);
public sealed record ListWalletTxQuery(Guid CustomerId, int Page, int PageSize) : IRequest<Result<PagedList<WalletTransactionDto>>>;
public sealed class ListWalletTxHandler : IRequestHandler<ListWalletTxQuery, Result<PagedList<WalletTransactionDto>>>
{
    private readonly IAppDbContext _db;
    public ListWalletTxHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<WalletTransactionDto>>> Handle(ListWalletTxQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var query = _db.WalletTransactions.AsNoTracking().Where(x => x.CustomerId == q.CustomerId).OrderByDescending(x => x.OccurredAtUtc);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * size).Take(size)
            .Select(x => new WalletTransactionDto(x.Id, x.Type, x.AmountRials, x.BalanceAfterRials, x.Description, x.RelatedOrderId, x.OccurredAtUtc))
            .ToListAsync(ct);
        return Result.Success(new PagedList<WalletTransactionDto>(items, page, size, total));
    }
}

public sealed record LoyaltyTransactionDto(Guid Id, LoyaltyTransactionType Type, int Points, int BalanceAfter, string? Description, Guid? RelatedOrderId, DateTime OccurredAtUtc);
public sealed record ListLoyaltyTxQuery(Guid CustomerId, int Page, int PageSize) : IRequest<Result<PagedList<LoyaltyTransactionDto>>>;
public sealed class ListLoyaltyTxHandler : IRequestHandler<ListLoyaltyTxQuery, Result<PagedList<LoyaltyTransactionDto>>>
{
    private readonly IAppDbContext _db;
    public ListLoyaltyTxHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<LoyaltyTransactionDto>>> Handle(ListLoyaltyTxQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var query = _db.LoyaltyTransactions.AsNoTracking().Where(x => x.CustomerId == q.CustomerId).OrderByDescending(x => x.OccurredAtUtc);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * size).Take(size)
            .Select(x => new LoyaltyTransactionDto(x.Id, x.Type, x.Points, x.BalanceAfter, x.Description, x.RelatedOrderId, x.OccurredAtUtc))
            .ToListAsync(ct);
        return Result.Success(new PagedList<LoyaltyTransactionDto>(items, page, size, total));
    }
}

public sealed record CustomerOrderSummaryDto(Guid Id, string Number, OrderStatus Status, long TotalRials, DateTime CreatedAtUtc, DateTime? CompletedAtUtc, string VehiclePlate);
public sealed record ListCustomerOrdersQuery(Guid CustomerId, int Page, int PageSize) : IRequest<Result<PagedList<CustomerOrderSummaryDto>>>;
public sealed class ListCustomerOrdersHandler : IRequestHandler<ListCustomerOrdersQuery, Result<PagedList<CustomerOrderSummaryDto>>>
{
    private readonly IAppDbContext _db;
    public ListCustomerOrdersHandler(IAppDbContext db) => _db = db;
    public async Task<Result<PagedList<CustomerOrderSummaryDto>>> Handle(ListCustomerOrdersQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 1, 200);
        var query = _db.Orders.AsNoTracking().Where(o => o.CustomerId == q.CustomerId).OrderByDescending(o => o.CreatedAtUtc);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * size).Take(size)
            .Select(o => new CustomerOrderSummaryDto(o.Id, o.Number, o.Status, o.TotalRials, o.CreatedAtUtc, o.CompletedAtUtc, o.VehiclePlate ?? ""))
            .ToListAsync(ct);
        return Result.Success(new PagedList<CustomerOrderSummaryDto>(items, page, size, total));
    }
}

public sealed record AdjustLoyaltyCommand(Guid CustomerId, int Points, string? Description) : IRequest<Result<int>>, ITransactionalRequest;
public sealed class AdjustLoyaltyValidator : AbstractValidator<AdjustLoyaltyCommand>
{
    public AdjustLoyaltyValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Points).NotEqual(0).WithMessage("تغییر امتیاز نمی‌تواند صفر باشد.");
    }
}
public sealed class AdjustLoyaltyHandler : IRequestHandler<AdjustLoyaltyCommand, Result<int>>
{
    private readonly IAppDbContext _db;
    public AdjustLoyaltyHandler(IAppDbContext db) => _db = db;
    public async Task<Result<int>> Handle(AdjustLoyaltyCommand c, CancellationToken ct)
    {
        var cust = await _db.Customers.FirstOrDefaultAsync(x => x.Id == c.CustomerId, ct);
        if (cust is null) return Result.Failure<int>(Error.NotFound("Customer.NotFound", "مشتری یافت نشد."));
        if (c.Points >= 0) cust.AddLoyaltyPoints(c.Points); else cust.RedeemLoyaltyPoints(-c.Points);
        var tx = new LoyaltyTransaction(Guid.Empty, cust.Id, c.Points >= 0 ? LoyaltyTransactionType.Earned : LoyaltyTransactionType.Adjustment, c.Points, cust.LoyaltyPoints, c.Description, null);
        _db.LoyaltyTransactions.Add(tx);
        await _db.SaveChangesAsync(ct);
        return Result.Success(cust.LoyaltyPoints);
    }
}
// resync-marker
