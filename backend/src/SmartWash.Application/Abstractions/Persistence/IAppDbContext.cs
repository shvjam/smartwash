using SmartWash.Domain.Audit;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Identity;
using SmartWash.Domain.Operations;
using SmartWash.Domain.Support;
using SmartWash.Domain.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage;

namespace SmartWash.Application.Abstractions.Persistence;

public interface IAppDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<Plan> Plans { get; }
    DbSet<PlanFeature> PlanFeatures { get; }
    DbSet<PlatformSmsTemplate> PlatformSmsTemplates { get; }
    DbSet<TenantSmsTemplate> TenantSmsTemplates { get; }
    DbSet<SmsUsageRecord> SmsUsageRecords { get; }
    DbSet<PlatformSmsSettings> PlatformSmsSettings { get; }
    DbSet<Subscription> Subscriptions { get; }
    DbSet<Invoice> Invoices { get; }
    DbSet<InvoiceLine> InvoiceLines { get; }
    DbSet<Payment> Payments { get; }
    DbSet<User> Users { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<OtpCode> OtpCodes { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<CronJobRun> CronJobRuns { get; }

    // Operations
    DbSet<Branch> Branches { get; }
    DbSet<Bay> Bays { get; }
    DbSet<Worker> Workers { get; }
    DbSet<Service> Services { get; }
    DbSet<Customer> Customers { get; }
    DbSet<CustomerVehicle> CustomerVehicles { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderLine> OrderLines { get; }
    DbSet<OrderPayment> OrderPayments { get; }
    DbSet<OrderStageEvent> OrderStageEvents { get; }
    DbSet<OrderBayVisit> OrderBayVisits { get; }
    DbSet<BayDowntime> BayDowntimes { get; }
    DbSet<ShiftRoster> ShiftRosters { get; }
    DbSet<ShiftAssignment> ShiftAssignments { get; }
    DbSet<TipSettlement> TipSettlements { get; }
    DbSet<Reservation> Reservations { get; }
    DbSet<ReservationService> ReservationServices { get; }
    DbSet<Expense> Expenses { get; }
    DbSet<Shift> Shifts { get; }
    DbSet<WalletTransaction> WalletTransactions { get; }
    DbSet<LoyaltyTransaction> LoyaltyTransactions { get; }
    DbSet<Campaign> Campaigns { get; }
    DbSet<UsageEvent> UsageEvents { get; }
    DbSet<AppNotification> AppNotifications { get; }
    DbSet<SmsMessage> SmsMessages { get; }
    DbSet<ServiceReminder> ServiceReminders { get; }
    DbSet<TenantSettings> TenantSettings { get; }

    // Support (ticketing)
    DbSet<Ticket> Tickets { get; }
    DbSet<TicketMessage> TicketMessages { get; }
    DbSet<TicketAttachment> TicketAttachments { get; }
    DbSet<TicketEvent> TicketEvents { get; }

    EntityEntry Entry(object entity);
    DbSet<TEntity> Set<TEntity>() where TEntity : class;

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);
    IExecutionStrategy CreateExecutionStrategy();

    // Discards all tracked entities so a retried execution-strategy attempt re-reads
    // fresh state from the database (avoids stale RowVersion → false concurrency errors).
    void ClearChangeTracker();
}
// resync-marker
