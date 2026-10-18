namespace SmartWash.Shared.Constants;

public static class AppConstants
{
    public const string TenantHeaderName = "X-Tenant-Slug";
    public const string TenantClaimType = "tenant_id";
    public const string TenantSlugClaimType = "tenant_slug";
    public const string UserClaimType = "sub";
    public const string PermissionClaimType = "permission";
    public const string CronSecretHeader = "X-Cron-Secret";
    public const string CorrelationIdHeader = "X-Correlation-Id";

    public const string TenantRoutePrefix = "/api/t/";
    public const string PlatformRoutePrefix = "/api/platform/";
    public const string PublicRoutePrefix = "/api/public/";
    public const string CronRoutePrefix = "/api/cron/";

    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 200;

    public const int RefreshTokenDays = 30;
    public const int AccessTokenMinutes = 60;
    public const int TrialDays = 14;
    public const int GracePeriodDays = 3;

    /// <summary>
    /// The plan a carwash is treated as being on during its free trial.
    ///
    /// A trial has no subscription, and plan features are read off the subscription, so
    /// without this a tenant on trial resolved to no features at all: no reservations, no
    /// loyalty, no branding, no campaigns, no SMS — a fortnight of a product with its
    /// features switched off, sold as a free trial of the product.
    /// </summary>
    public const string TrialPlanCode = "pro";
}

public static class Roles
{
    public const string PlatformOwner = "platform:owner";
    public const string PlatformSupport = "platform:support";

    public const string TenantOwner = "tenant:owner";
    public const string TenantManager = "tenant:manager";
    public const string TenantCashier = "tenant:cashier";
    public const string TenantOperator = "tenant:operator";
    public const string TenantAccountant = "tenant:accountant";
    public const string TenantMarketing = "tenant:marketing";
    public const string TenantViewer = "tenant:viewer";

    public static readonly string[] AllTenantRoles =
    [
        TenantOwner, TenantManager, TenantCashier,
        TenantOperator, TenantAccountant, TenantMarketing, TenantViewer
    ];

    public static readonly string[] AllPlatformRoles =
    [
        PlatformOwner, PlatformSupport
    ];
}

public static class Permissions
{
    public const string TenantsRead = "platform.tenants.read";
    public const string TenantsWrite = "platform.tenants.write";
    public const string PlansRead = "platform.plans.read";
    public const string PlansWrite = "platform.plans.write";
    public const string SubscriptionsRead = "platform.subscriptions.read";
    public const string SubscriptionsWrite = "platform.subscriptions.write";
    public const string AuditRead = "platform.audit.read";
    public const string SmsRead = "platform.sms.read";
    public const string SmsWrite = "platform.sms.write";
    /// <summary>اتصال تامین‌کننده، کلید API و خط ارسال — تنها مدیر ارشد پلتفرم.</summary>
    public const string SmsProviderManage = "platform.sms.provider";
    public const string SupportRead = "platform.support.read";
    public const string SupportWrite = "platform.support.write";

    public const string BranchesManage = "tenant.branches.manage";
    public const string BaysManage = "tenant.bays.manage";
    public const string WorkersManage = "tenant.workers.manage";
    public const string ServicesManage = "tenant.services.manage";
    public const string OrdersRead = "tenant.orders.read";
    public const string OrdersManage = "tenant.orders.manage";
    public const string ReservationsManage = "tenant.reservations.manage";
    public const string CustomersRead = "tenant.customers.read";
    public const string CustomersManage = "tenant.customers.manage";
    public const string WalletManage = "tenant.wallet.manage";
    public const string LoyaltyManage = "tenant.loyalty.manage";
    public const string ExpensesManage = "tenant.expenses.manage";
    public const string ShiftsManage = "tenant.shifts.manage";
    public const string ReportsView = "tenant.reports.view";
    public const string SettingsManage = "tenant.settings.manage";
    public const string UsersManage = "tenant.users.manage";
    public const string BillingManage = "tenant.billing.manage";
    public const string CampaignsManage = "tenant.campaigns.manage";
    public const string NotificationsRead = "tenant.notifications.read";
    public const string SmsManage = "tenant.sms.manage";
    public const string SupportManage = "tenant.support.manage";
}
// resync-marker
