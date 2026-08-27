using SmartWash.Application.Abstractions.Messaging;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Tenancy;
using SmartWash.Shared.Results;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.Billing;

public sealed record SubscriptionDto(Guid Id, Guid TenantId, Guid PlanId, BillingCycle Cycle, SubscriptionStatus Status,
    DateTime StartsAtUtc, DateTime CurrentPeriodStartUtc, DateTime CurrentPeriodEndUtc, DateTime? CancelledAtUtc,
    DateTime? GraceEndsAtUtc, long PriceRials, bool AutoRenew);

public sealed record InvoiceDto(Guid Id, Guid TenantId, Guid? SubscriptionId, string Number, InvoiceKind Kind,
    InvoiceStatus Status, DateTime IssuedAtUtc, DateTime DueAtUtc, DateTime? PaidAtUtc,
    long SubtotalRials, long TaxRials, long TotalRials, string? Notes, IReadOnlyList<InvoiceLineDto> Lines);

public sealed record InvoiceLineDto(Guid Id, string Description, int Quantity, long UnitPriceRials, long LineTotalRials);

public sealed record PaymentDto(Guid Id, Guid InvoiceId, PaymentGateway Gateway, PaymentStatus Status,
    long AmountRials, string? Authority, string? ReferenceId, DateTime? PaidAtUtc);

public static class BillingMap
{
    public static SubscriptionDto ToDto(Subscription s) => new(s.Id, s.TenantId, s.PlanId, s.Cycle, s.Status,
        s.StartsAtUtc, s.CurrentPeriodStartUtc, s.CurrentPeriodEndUtc, s.CancelledAtUtc, s.GraceEndsAtUtc, s.PriceRials, s.AutoRenew);

    public static InvoiceDto ToDto(Invoice i) => new(i.Id, i.TenantId, i.SubscriptionId, i.Number, i.Kind, i.Status,
        i.IssuedAtUtc, i.DueAtUtc, i.PaidAtUtc, i.SubtotalRials, i.TaxRials, i.TotalRials, i.Notes,
        i.Lines.Select(l => new InvoiceLineDto(l.Id, l.Description, l.Quantity, l.UnitPriceRials, l.LineTotalRials)).ToArray());

    public static PaymentDto ToDto(Payment p) => new(p.Id, p.InvoiceId, p.Gateway, p.Status, p.AmountRials, p.Authority, p.ReferenceId, p.PaidAtUtc);
}

public sealed record GetCurrentSubscriptionQuery : IRequest<Result<SubscriptionDto?>>;
public sealed class GetCurrentSubscriptionHandler : IRequestHandler<GetCurrentSubscriptionQuery, Result<SubscriptionDto?>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public GetCurrentSubscriptionHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result<SubscriptionDto?>> Handle(GetCurrentSubscriptionQuery q, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure<SubscriptionDto?>(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        var s = await _db.Subscriptions.AsNoTracking().Where(x => x.TenantId == _tenant.TenantId.Value)
            .OrderByDescending(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
        return Result.Success<SubscriptionDto?>(s is null ? null : BillingMap.ToDto(s));
    }
}

public sealed record ListInvoicesQuery(InvoiceStatus? Status) : IRequest<Result<IReadOnlyList<InvoiceDto>>>;
public sealed class ListInvoicesHandler : IRequestHandler<ListInvoicesQuery, Result<IReadOnlyList<InvoiceDto>>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public ListInvoicesHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result<IReadOnlyList<InvoiceDto>>> Handle(ListInvoicesQuery q, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure<IReadOnlyList<InvoiceDto>>(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        // فاکتورها ITenantScoped نیستند، پس فیلترِ سراسریِ مستاجر روی آن‌ها اعمال نمی‌شود؛ باید دستی به مستاجر جاری محدود شوند.
        var query = _db.Invoices.AsNoTracking().Include(i => i.Lines).Where(i => i.TenantId == _tenant.TenantId.Value);
        if (q.Status.HasValue) query = query.Where(i => i.Status == q.Status.Value);
        var items = await query.OrderByDescending(i => i.IssuedAtUtc).ToListAsync(ct);
        return Result.Success<IReadOnlyList<InvoiceDto>>(items.Select(BillingMap.ToDto).ToArray());
    }
}

public sealed record SubscribeCommand(Guid PlanId, BillingCycle Cycle) : IRequest<Result<SubscriptionDto>>, ITransactionalRequest;
public sealed class SubscribeValidator : AbstractValidator<SubscribeCommand>
{
    public SubscribeValidator() { RuleFor(x => x.PlanId).NotEmpty(); }
}
public sealed class SubscribeHandler : IRequestHandler<SubscribeCommand, Result<SubscriptionDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ITenantFeatureService _features;
    public SubscribeHandler(IAppDbContext db, ITenantContext tenant, ITenantFeatureService features)
    { _db = db; _tenant = tenant; _features = features; }
    public async Task<Result<SubscriptionDto>> Handle(SubscribeCommand c, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure<SubscriptionDto>(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));

        // بررسی اشتراک فعال موجود — اجازه ثبت اشتراک تکراری داده نمی‌شود
        var existingActive = await _db.Subscriptions
            .Where(s => s.TenantId == _tenant.TenantId.Value
                        && (s.Status == SubscriptionStatus.Active
                            || s.Status == SubscriptionStatus.PendingPayment
                            || s.Status == SubscriptionStatus.PastDue))
            .FirstOrDefaultAsync(ct);
        if (existingActive is not null)
            return Result.Failure<SubscriptionDto>(Error.Conflict("Subscription.AlreadyActive",
                "اشتراک فعال یا در انتظار پرداخت دارید. ابتدا پلن فعلی را لغو کنید."));

        var plan = await _db.Plans.FirstOrDefaultAsync(p => p.Id == c.PlanId && p.IsActive, ct);
        if (plan is null) return Result.Failure<SubscriptionDto>(Error.NotFound("Plan.NotFound", "پلن یافت نشد یا غیرفعال است."));
        var price = c.Cycle == BillingCycle.Yearly ? plan.YearlyPriceRials : plan.MonthlyPriceRials;
        var sub = Subscription.Create(_tenant.TenantId.Value, plan.Id, c.Cycle, price);
        _db.Subscriptions.Add(sub);

        var number = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        var inv = Invoice.Create(_tenant.TenantId.Value, sub.Id, InvoiceKind.Subscription, number, DateTime.UtcNow.AddDays(7));
        inv.AddLine($"{plan.DisplayName} ({c.Cycle})", 1, price);
        _db.Invoices.Add(inv);

        await _db.SaveChangesAsync(ct);
        await _features.InvalidateAsync(_tenant.TenantId.Value, ct);
        return BillingMap.ToDto(sub);
    }
}

public sealed record RequestPaymentCommand(Guid InvoiceId, PaymentGateway Gateway, string CallbackUrl)
    : IRequest<Result<PaymentRequestDto>>, ITransactionalRequest;
public sealed record PaymentRequestDto(Guid PaymentId, string? Authority, string? RedirectUrl);

public sealed class RequestPaymentHandler : IRequestHandler<RequestPaymentCommand, Result<PaymentRequestDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IPaymentGatewayFactory _factory;
    public RequestPaymentHandler(IAppDbContext db, ITenantContext tenant, IPaymentGatewayFactory factory)
    { _db = db; _tenant = tenant; _factory = factory; }

    public async Task<Result<PaymentRequestDto>> Handle(RequestPaymentCommand c, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure<PaymentRequestDto>(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        // فاکتور ITenantScoped نیست؛ باید مالکیتِ مستاجرِ جاری دستی بررسی شود (جلوگیری از پرداختِ فاکتورِ مستاجرِ دیگر).
        var inv = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == c.InvoiceId && i.TenantId == _tenant.TenantId.Value, ct);
        if (inv is null) return Result.Failure<PaymentRequestDto>(Error.NotFound("Invoice.NotFound", "فاکتور یافت نشد."));
        if (inv.Status == InvoiceStatus.Paid) return Result.Failure<PaymentRequestDto>(Error.Conflict("Invoice.AlreadyPaid", "فاکتور قبلاً پرداخت شده است."));

        var payment = Payment.Create(_tenant.TenantId.Value, inv.Id, inv.TotalRials, c.Gateway, c.CallbackUrl);
        _db.Payments.Add(payment);
        await _db.SaveChangesAsync(ct);

        // درگاه پس از پرداخت باید به endpoint عمومی بک‌اند بازگردد تا verify انجام شود؛
        // paymentId تازه‌ساخته‌شده را به انتهای مسیر callback ضمیمه می‌کنیم.
        var gatewayCallback = $"{c.CallbackUrl.TrimEnd('/')}/{payment.Id}";

        var client = _factory.Create(c.Gateway);
        var req = await client.RequestAsync(inv.TotalRials, gatewayCallback, $"Invoice {inv.Number}", ct);
        if (!req.IsSuccess || string.IsNullOrEmpty(req.Authority))
        {
            payment.MarkFailed(req.Raw);
            await _db.SaveChangesAsync(ct);
            return Result.Failure<PaymentRequestDto>(Error.Problem("Payment.GatewayFailed", req.Error ?? "خطا در اتصال به درگاه پرداخت."));
        }
        payment.AttachAuthority(req.Authority);
        await _db.SaveChangesAsync(ct);
        return Result.Success(new PaymentRequestDto(payment.Id, req.Authority, req.RedirectUrl));
    }
}

public sealed record VerifyPaymentCommand(Guid PaymentId, string Authority) : IRequest<Result<PaymentDto>>, ITransactionalRequest;
public sealed class VerifyPaymentHandler : IRequestHandler<VerifyPaymentCommand, Result<PaymentDto>>
{
    private readonly IAppDbContext _db;
    private readonly IPaymentGatewayFactory _factory;
    public VerifyPaymentHandler(IAppDbContext db, IPaymentGatewayFactory factory) { _db = db; _factory = factory; }
    public async Task<Result<PaymentDto>> Handle(VerifyPaymentCommand c, CancellationToken ct)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == c.PaymentId, ct);
        if (payment is null) return Result.Failure<PaymentDto>(Error.NotFound("Payment.NotFound", "پرداخت یافت نشد."));
        if (payment.Status == PaymentStatus.Succeeded) return BillingMap.ToDto(payment);

        // تأیید باید با authorityِ ذخیره‌شده روی خودِ پرداخت انجام شود، نه با مقدارِ ارسالیِ فراخوان (جلوگیری از دستکاری).
        if (string.IsNullOrEmpty(payment.Authority))
            return Result.Failure<PaymentDto>(Error.Problem("Payment.NoAuthority", "پرداخت فاقد شناسه معتبر درگاه است."));
        if (!string.IsNullOrEmpty(c.Authority) && !string.Equals(c.Authority, payment.Authority, StringComparison.Ordinal))
            return Result.Failure<PaymentDto>(Error.Problem("Payment.AuthorityMismatch", "شناسه پرداخت با درخواست اصلی مطابقت ندارد."));

        var client = _factory.Create(payment.Gateway);
        var verify = await client.VerifyAsync(payment.Authority, payment.AmountRials, ct);
        if (!verify.IsSuccess)
        {
            payment.MarkFailed(verify.Raw);
            await _db.SaveChangesAsync(ct);
            return Result.Failure<PaymentDto>(Error.Problem("Payment.VerifyFailed", verify.Error ?? "تأیید پرداخت ناموفق بود."));
        }

        payment.MarkSucceeded(verify.ReferenceId ?? string.Empty, verify.Raw);

        var inv = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == payment.InvoiceId, ct);
        if (inv is not null && inv.Status != InvoiceStatus.Paid)
        {
            inv.MarkPaid();
            if (inv.SubscriptionId.HasValue)
            {
                var sub = await _db.Subscriptions.FirstOrDefaultAsync(s => s.Id == inv.SubscriptionId.Value, ct);
                if (sub is not null)
                {
                    if (sub.Status == SubscriptionStatus.PendingPayment) sub.MarkActive();
                    else if (sub.Status is SubscriptionStatus.PastDue or SubscriptionStatus.Expired) sub.Renew();

                    var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == sub.TenantId, ct);
                    if (tenant is not null && tenant.Status is TenantStatus.Trial or TenantStatus.Grace or TenantStatus.Suspended)
                        tenant.Activate(sub.Id);
                }
            }
        }

        await _db.SaveChangesAsync(ct);
        return BillingMap.ToDto(payment);
    }
}

public sealed record CancelSubscriptionCommand(Guid Id) : IRequest<Result>, ITransactionalRequest;
public sealed class CancelSubscriptionHandler : IRequestHandler<CancelSubscriptionCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public CancelSubscriptionHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result> Handle(CancelSubscriptionCommand c, CancellationToken ct)
    {
        if (!_tenant.TenantId.HasValue) return Result.Failure(Error.Unauthorized("Tenant.None", "مستاجر مشخص نیست."));
        // اشتراک ITenantScoped نیست؛ مالکیتِ مستاجرِ جاری دستی بررسی می‌شود.
        var s = await _db.Subscriptions.FirstOrDefaultAsync(x => x.Id == c.Id && x.TenantId == _tenant.TenantId.Value, ct);
        if (s is null) return Result.Failure(Error.NotFound("Subscription.NotFound", "اشتراک یافت نشد."));
        s.Cancel();
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
