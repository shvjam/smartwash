using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Application.Behaviors;
using SmartWash.Domain.Operations;
using SmartWash.Shared.Results;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace SmartWash.Application.Modules.TenantSettings;

public sealed record TenantSettingsDto(
    bool LoyaltyEnabled, int LoyaltyPointsPerRial, long LoyaltyPointValueRials, int LoyaltyExpiryDays,
    bool WalletEnabled, bool SmsEnabled, string? SmsSenderNumber, string? SmsProvider,
    bool ReservationEnabled, int ReservationLeadMinutes, int ReservationMaxAdvanceDays,
    string ReceiptHeader, string? ReceiptFooter, string? InvoicePrefix,
    string? Tagline, string Theme, string? PrimaryColor, string? LogoUrl);

public sealed record GetTenantSettingsQuery : IRequest<Result<TenantSettingsDto>>;
public sealed class GetTenantSettingsHandler : IRequestHandler<GetTenantSettingsQuery, Result<TenantSettingsDto>>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public GetTenantSettingsHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result<TenantSettingsDto>> Handle(GetTenantSettingsQuery q, CancellationToken ct)
    {
        var s = await _db.TenantSettings.FirstOrDefaultAsync(ct);
        if (s is null)
        {
            s = Domain.Operations.TenantSettings.CreateDefault(_tenant.TenantId ?? Guid.Empty);
            _db.TenantSettings.Add(s);
            await _db.SaveChangesAsync(ct);
        }
        return Map(s);
    }
    public static TenantSettingsDto Map(Domain.Operations.TenantSettings s) => new(
        s.LoyaltyEnabled, s.LoyaltyPointsPerRial, s.LoyaltyPointValueRials, s.LoyaltyExpiryDays,
        s.WalletEnabled, s.SmsEnabled, s.SmsSenderNumber, s.SmsProvider,
        s.ReservationEnabled, s.ReservationLeadMinutes, s.ReservationMaxAdvanceDays,
        s.ReceiptHeader, s.ReceiptFooter, s.InvoicePrefix,
        s.Tagline, s.Theme, s.PrimaryColor, s.LogoUrl);
}

public sealed record UpdateBrandingCommand(string? LogoUrl, string? PrimaryColor, string? Tagline, string Theme) : IRequest<Result>, ITransactionalRequest;
public sealed class UpdateBrandingHandler : IRequestHandler<UpdateBrandingCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ITenantFeatureService _features;
    public UpdateBrandingHandler(IAppDbContext db, ITenantContext tenant, ITenantFeatureService features)
    { _db = db; _tenant = tenant; _features = features; }
    public async Task<Result> Handle(UpdateBrandingCommand c, CancellationToken ct)
    {
        if (!await _features.HasFeatureAsync("branding", ct))
            return Result.Failure(Error.Forbidden("Feature.NotAvailable", "ویژگی برندینگ در پلن اشتراک شما فعال نیست."));

        var s = await GetOrCreate(ct);
        s.UpdateBranding(c.LogoUrl, c.PrimaryColor, c.Tagline, c.Theme);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
    private async Task<Domain.Operations.TenantSettings> GetOrCreate(CancellationToken ct)
    {
        var s = await _db.TenantSettings.FirstOrDefaultAsync(ct);
        if (s is null) { s = Domain.Operations.TenantSettings.CreateDefault(_tenant.TenantId ?? Guid.Empty); _db.TenantSettings.Add(s); }
        return s;
    }
}

public sealed record UpdateLoyaltyCommand(bool Enabled, int PointsPerRial, long PointValue, int ExpiryDays) : IRequest<Result>, ITransactionalRequest;
public sealed class UpdateLoyaltyHandler : IRequestHandler<UpdateLoyaltyCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ITenantFeatureService _features;
    public UpdateLoyaltyHandler(IAppDbContext db, ITenantContext tenant, ITenantFeatureService features)
    { _db = db; _tenant = tenant; _features = features; }
    public async Task<Result> Handle(UpdateLoyaltyCommand c, CancellationToken ct)
    {
        if (!await _features.HasFeatureAsync("loyalty", ct))
            return Result.Failure(Error.Forbidden("Feature.NotAvailable", "باشگاه وفاداری در پلن اشتراک شما فعال نیست."));

        var s = await _db.TenantSettings.FirstOrDefaultAsync(ct) ?? Domain.Operations.TenantSettings.CreateDefault(_tenant.TenantId ?? Guid.Empty);
        if (_db.Entry(s).State == EntityState.Detached) _db.TenantSettings.Add(s);
        s.UpdateLoyalty(c.Enabled, c.PointsPerRial, c.PointValue, c.ExpiryDays);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record UpdateReceiptCommand(string Header, string? Footer, string? InvoicePrefix) : IRequest<Result>, ITransactionalRequest;
public sealed class UpdateReceiptHandler : IRequestHandler<UpdateReceiptCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    public UpdateReceiptHandler(IAppDbContext db, ITenantContext tenant) { _db = db; _tenant = tenant; }
    public async Task<Result> Handle(UpdateReceiptCommand c, CancellationToken ct)
    {
        // Receipt settings are available on all plans
        var s = await _db.TenantSettings.FirstOrDefaultAsync(ct) ?? Domain.Operations.TenantSettings.CreateDefault(_tenant.TenantId ?? Guid.Empty);
        if (_db.Entry(s).State == EntityState.Detached) _db.TenantSettings.Add(s);
        s.UpdateReceipt(c.Header, c.Footer, c.InvoicePrefix);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// خط و سامانه‌ی ارسال عمداً در این کامند نیستند؛ مستاجر حق تغییرشان را ندارد.
public sealed record UpdateSmsSettingsCommand(bool Enabled) : IRequest<Result>, ITransactionalRequest;
public sealed class UpdateSmsSettingsHandler : IRequestHandler<UpdateSmsSettingsCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ITenantFeatureService _features;
    public UpdateSmsSettingsHandler(IAppDbContext db, ITenantContext tenant, ITenantFeatureService features)
    { _db = db; _tenant = tenant; _features = features; }
    public async Task<Result> Handle(UpdateSmsSettingsCommand c, CancellationToken ct)
    {
        if (!await _features.HasFeatureAsync("sms", ct))
            return Result.Failure(Error.Forbidden("Feature.NotAvailable", "سرویس پیامک در پلن اشتراک شما فعال نیست."));

        var s = await _db.TenantSettings.FirstOrDefaultAsync(ct) ?? Domain.Operations.TenantSettings.CreateDefault(_tenant.TenantId ?? Guid.Empty);
        if (_db.Entry(s).State == EntityState.Detached) _db.TenantSettings.Add(s);
        s.UpdateSmsEnabled(c.Enabled);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed record UpdateReservationSettingsCommand(bool Enabled, int LeadMinutes, int MaxAdvanceDays) : IRequest<Result>, ITransactionalRequest;
public sealed class UpdateReservationSettingsHandler : IRequestHandler<UpdateReservationSettingsCommand, Result>
{
    private readonly IAppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ITenantFeatureService _features;
    public UpdateReservationSettingsHandler(IAppDbContext db, ITenantContext tenant, ITenantFeatureService features)
    { _db = db; _tenant = tenant; _features = features; }
    public async Task<Result> Handle(UpdateReservationSettingsCommand c, CancellationToken ct)
    {
        if (!await _features.HasFeatureAsync("reservations", ct))
            return Result.Failure(Error.Forbidden("Feature.NotAvailable", "سیستم رزرواسیون در پلن اشتراک شما فعال نیست."));

        var s = await _db.TenantSettings.FirstOrDefaultAsync(ct) ?? Domain.Operations.TenantSettings.CreateDefault(_tenant.TenantId ?? Guid.Empty);
        if (_db.Entry(s).State == EntityState.Detached) _db.TenantSettings.Add(s);
        s.UpdateReservation(c.Enabled, c.LeadMinutes, c.MaxAdvanceDays);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
// resync-marker
