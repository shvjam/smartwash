using SmartWash.Shared.Constants;

namespace SmartWash.Application.Modules.Auth;

public static class PermissionMap
{
    private static readonly string[] AllTenantPermissions =
    [
        Permissions.BranchesManage, Permissions.BaysManage, Permissions.WorkersManage,
        Permissions.ServicesManage, Permissions.OrdersRead, Permissions.OrdersManage,
        Permissions.ReservationsManage, Permissions.CustomersRead, Permissions.CustomersManage,
        Permissions.WalletManage, Permissions.LoyaltyManage,
        Permissions.ExpensesManage, Permissions.ShiftsManage,
        Permissions.ReportsView, Permissions.SettingsManage, Permissions.UsersManage,
        Permissions.BillingManage, Permissions.CampaignsManage,
        Permissions.NotificationsRead, Permissions.SmsManage, Permissions.SupportManage
    ];

    private static readonly Dictionary<string, string[]> _map = new()
    {
        [Roles.PlatformOwner] =
        [
            Permissions.TenantsRead, Permissions.TenantsWrite,
            Permissions.PlansRead, Permissions.PlansWrite,
            Permissions.SubscriptionsRead, Permissions.SubscriptionsWrite,
            Permissions.AuditRead,
            Permissions.SmsRead, Permissions.SmsWrite, Permissions.SmsProviderManage,
            Permissions.SupportRead, Permissions.SupportWrite
        ],
        // پشتیبانی فقط مصرف و قالب‌ها را می‌بیند؛ اتصال تامین‌کننده و کلید API در اختیارش نیست.
        [Roles.PlatformSupport] =
        [
            Permissions.TenantsRead, Permissions.PlansRead, Permissions.SubscriptionsRead,
            Permissions.AuditRead, Permissions.SmsRead,
            Permissions.SupportRead, Permissions.SupportWrite
        ],
        [Roles.TenantOwner] = AllTenantPermissions,
        [Roles.TenantManager] =
        [
            Permissions.BranchesManage, Permissions.BaysManage, Permissions.WorkersManage,
            Permissions.ServicesManage, Permissions.OrdersRead, Permissions.OrdersManage,
            Permissions.ReservationsManage, Permissions.CustomersRead, Permissions.CustomersManage,
            Permissions.WalletManage, Permissions.LoyaltyManage,
            Permissions.ExpensesManage, Permissions.ShiftsManage,
            Permissions.ReportsView, Permissions.SettingsManage, Permissions.CampaignsManage,
            Permissions.NotificationsRead, Permissions.SmsManage, Permissions.SupportManage
        ],
        [Roles.TenantCashier] =
        [
            Permissions.OrdersRead, Permissions.OrdersManage, Permissions.ReservationsManage,
            Permissions.CustomersRead, Permissions.CustomersManage,
            Permissions.WalletManage, Permissions.ShiftsManage, Permissions.NotificationsRead
        ],
        [Roles.TenantOperator] =
        [
            Permissions.BaysManage, Permissions.OrdersRead, Permissions.OrdersManage,
            Permissions.ReservationsManage, Permissions.NotificationsRead
        ],
        [Roles.TenantAccountant] =
        [
            Permissions.ReportsView, Permissions.BillingManage,
            Permissions.ExpensesManage, Permissions.OrdersRead,
            Permissions.SupportManage
        ],
        [Roles.TenantMarketing] =
        [
            Permissions.CampaignsManage, Permissions.CustomersRead, Permissions.CustomersManage,
            Permissions.LoyaltyManage, Permissions.SmsManage, Permissions.ReportsView
        ],
        [Roles.TenantViewer] =
        [
            Permissions.ReportsView, Permissions.OrdersRead, Permissions.CustomersRead, Permissions.NotificationsRead
        ]
    };

    public static IReadOnlyCollection<string> ResolvePermissions(IEnumerable<string> roles) =>
        roles.SelectMany(r => _map.TryGetValue(r, out var p) ? p : Array.Empty<string>())
             .Distinct()
             .ToArray();
}
// resync-marker
