using SmartWash.Domain.Common;

namespace SmartWash.Domain.Operations;

public sealed class TenantSettings : Entity<Guid>, ITenantScoped
{
    private TenantSettings() { }

    public Guid TenantId { get; private set; }

    public bool LoyaltyEnabled { get; private set; }
    public int LoyaltyPointsPerRial { get; private set; } = 1;
    public long LoyaltyPointValueRials { get; private set; } = 100;
    public int LoyaltyExpiryDays { get; private set; } = 365;

    public bool WalletEnabled { get; private set; }
    public bool SmsEnabled { get; private set; }
    public string? SmsSenderNumber { get; private set; }
    public string? SmsProvider { get; private set; }

    public bool ReservationEnabled { get; private set; } = true;
    public int ReservationLeadMinutes { get; private set; } = 30;
    public int ReservationMaxAdvanceDays { get; private set; } = 14;

    public string ReceiptHeader { get; private set; } = "SmartWash";
    public string? ReceiptFooter { get; private set; }
    public string? InvoicePrefix { get; private set; } = "ORD";
    public int LastOrderNumber { get; private set; }

    public string? Tagline { get; private set; }
    public string Theme { get; private set; } = "light";
    public string? PrimaryColor { get; private set; }
    public string? LogoUrl { get; private set; }

    public int OnboardingStep { get; private set; }
    public DateTime? OnboardingCompletedAtUtc { get; private set; }

    public void AdvanceOnboarding(int step)
    {
        if (step > OnboardingStep) OnboardingStep = step;
    }

    public void CompleteOnboarding()
    {
        OnboardingCompletedAtUtc = DateTime.UtcNow;
        OnboardingStep = int.MaxValue;
    }

    public bool IsOnboardingComplete => OnboardingCompletedAtUtc.HasValue;

    public static TenantSettings CreateDefault(Guid tenantId)
    {
        return new TenantSettings
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId
        };
    }

    public int NextOrderNumber()
    {
        LastOrderNumber++;
        return LastOrderNumber;
    }

    /// <summary>
    /// شمارندهٔ سفارش را با بزرگ‌ترین شمارهٔ واقعیِ موجود همگام می‌کند تا پس از
    /// ریست دیتابیس یا حذف/بازساختِ تنظیمات، تولیدِ شماره با شمارهٔ تکراری برخورد نکند.
    /// </summary>
    public void SyncOrderNumber(int lastUsed)
    {
        if (lastUsed > LastOrderNumber) LastOrderNumber = lastUsed;
    }

    public void UpdateBranding(string? logoUrl, string? primaryColor, string? tagline, string theme)
    {
        LogoUrl = logoUrl;
        PrimaryColor = primaryColor;
        Tagline = tagline;
        Theme = theme;
    }

    public void UpdateLoyalty(bool enabled, int pointsPerRial, long pointValue, int expiryDays)
    {
        LoyaltyEnabled = enabled;
        LoyaltyPointsPerRial = pointsPerRial;
        LoyaltyPointValueRials = pointValue;
        LoyaltyExpiryDays = expiryDays;
    }

    public void UpdateWallet(bool enabled) => WalletEnabled = enabled;

    /// <summary>
    /// مستاجر فقط می‌تواند سرویس پیامک را برای خودش روشن یا خاموش کند.
    /// خط ارسال و سامانه‌ی ارسال (SmsSenderNumber / SmsProvider) بخشی از اتصالِ
    /// متمرکز پلتفرم‌اند و فقط مدیر ارشد پلتفرم آن‌ها را تعیین می‌کند.
    /// </summary>
    public void UpdateSmsEnabled(bool enabled) => SmsEnabled = enabled;

    /// <summary>فقط برای استفاده‌ی سطح پلتفرم — خط و سامانه‌ی ارسال را تعیین می‌کند.</summary>
    public void SetPlatformSmsConnection(string? sender, string? provider)
    {
        SmsSenderNumber = sender;
        SmsProvider = provider;
    }

    public void UpdateReservation(bool enabled, int leadMinutes, int maxAdvanceDays)
    {
        ReservationEnabled = enabled;
        ReservationLeadMinutes = leadMinutes;
        ReservationMaxAdvanceDays = maxAdvanceDays;
    }

    public void UpdateReceipt(string header, string? footer, string? invoicePrefix)
    {
        ReceiptHeader = header;
        ReceiptFooter = footer;
        InvoicePrefix = invoicePrefix;
    }
}
// resync-marker
