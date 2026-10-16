using System.Linq.Expressions;
using System.Reflection;
using Microsoft.EntityFrameworkCore.Metadata;
using SmartWash.Application.Abstractions.Identity;
using SmartWash.Application.Abstractions.Multitenancy;
using SmartWash.Application.Abstractions.Persistence;
using SmartWash.Domain.Audit;
using SmartWash.Domain.Billing;
using SmartWash.Domain.Common;
using SmartWash.Domain.Identity;
using SmartWash.Domain.Operations;
using SmartWash.Domain.Support;
using SmartWash.Domain.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace SmartWash.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUser _currentUser;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenantContext, ICurrentUser currentUser)
        : base(options)
    {
        _tenantContext = tenantContext;
        _currentUser = currentUser;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<PlanFeature> PlanFeatures => Set<PlanFeature>();
    public DbSet<PlatformSmsTemplate> PlatformSmsTemplates => Set<PlatformSmsTemplate>();
    public DbSet<TenantSmsTemplate> TenantSmsTemplates => Set<TenantSmsTemplate>();
    public DbSet<SmsUsageRecord> SmsUsageRecords => Set<SmsUsageRecord>();
    public DbSet<PlatformSmsSettings> PlatformSmsSettings => Set<PlatformSmsSettings>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<CronJobRun> CronJobRuns => Set<CronJobRun>();

    // Operations
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Bay> Bays => Set<Bay>();
    public DbSet<Worker> Workers => Set<Worker>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerVehicle> CustomerVehicles => Set<CustomerVehicle>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<OrderPayment> OrderPayments => Set<OrderPayment>();
    public DbSet<OrderStageEvent> OrderStageEvents => Set<OrderStageEvent>();
    public DbSet<BayDowntime> BayDowntimes => Set<BayDowntime>();
    public DbSet<OrderBayVisit> OrderBayVisits => Set<OrderBayVisit>();
    public DbSet<ShiftRoster> ShiftRosters => Set<ShiftRoster>();
    public DbSet<ShiftAssignment> ShiftAssignments => Set<ShiftAssignment>();
    public DbSet<TipSettlement> TipSettlements => Set<TipSettlement>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<ReservationService> ReservationServices => Set<ReservationService>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<Shift> Shifts => Set<Shift>();
    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();
    public DbSet<LoyaltyTransaction> LoyaltyTransactions => Set<LoyaltyTransaction>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<UsageEvent> UsageEvents => Set<UsageEvent>();
    public DbSet<AppNotification> AppNotifications => Set<AppNotification>();
    public DbSet<SmsMessage> SmsMessages => Set<SmsMessage>();
    public DbSet<ServiceReminder> ServiceReminders => Set<ServiceReminder>();
    public DbSet<TenantSettings> TenantSettings => Set<TenantSettings>();

    // Support (ticketing)
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketMessage> TicketMessages => Set<TicketMessage>();
    public DbSet<TicketAttachment> TicketAttachments => Set<TicketAttachment>();
    public DbSet<TicketEvent> TicketEvents => Set<TicketEvent>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);
        // Every timestamp this application writes is UTC; say so when reading it back, so it
        // reaches the browser with its time zone attached. See UtcDateTimeConverter.
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        UseClientGeneratedGuidKeys(modelBuilder);
        ApplyGlobalQueryFilters(modelBuilder);
    }

    /// <summary>
    /// Every aggregate and child entity assigns its own <c>Id = Guid.NewGuid()</c> in its
    /// constructor, but EF's convention for a Guid key is <c>ValueGeneratedOnAdd</c>. That
    /// combination breaks child entities added through a navigation collection: when
    /// DetectChanges discovers the new entity, EF decides whether it is new by asking
    /// whether the key is set. The constructor has already set it, so EF concludes the row
    /// exists, tracks it as Modified and issues an UPDATE against a row that was never
    /// inserted. The update matches nothing and surfaces as a DbUpdateConcurrencyException,
    /// which retrying cannot fix because every retry builds another pre-keyed entity.
    ///
    /// Aggregate roots escaped this only because handlers call Add() explicitly, which
    /// forces the Added state. Declaring the keys client-generated makes both paths agree.
    /// </summary>
    private static void UseClientGeneratedGuidKeys(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var key = entityType.FindPrimaryKey();
            if (key is null || key.Properties.Count != 1) continue;

            var property = key.Properties[0];
            if (property.ClrType == typeof(Guid))
                property.ValueGenerated = ValueGenerated.Never;
        }
    }

    private void ApplyGlobalQueryFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var clrType = entityType.ClrType;
            var isTenantScoped = typeof(ITenantScoped).IsAssignableFrom(clrType);
            var isSoftDeletable = typeof(ISoftDeletable).IsAssignableFrom(clrType);

            if (!isTenantScoped && !isSoftDeletable) continue;

            var parameter = Expression.Parameter(clrType, "e");
            Expression? combined = null;

            if (isTenantScoped)
            {
                var tenantIdProp = Expression.Property(parameter, nameof(ITenantScoped.TenantId));
                var currentTenant = Expression.Property(
                    Expression.Constant(this),
                    nameof(CurrentTenantIdOrEmpty));
                combined = Expression.Equal(tenantIdProp, currentTenant);
            }

            if (isSoftDeletable)
            {
                var isDeletedProp = Expression.Property(parameter, nameof(ISoftDeletable.IsDeleted));
                var notDeleted = Expression.Equal(isDeletedProp, Expression.Constant(false));
                combined = combined is null ? notDeleted : Expression.AndAlso(combined, notDeleted);
            }

            if (combined is not null)
                modelBuilder.Entity(clrType).HasQueryFilter(Expression.Lambda(combined, parameter));
        }
    }

    public Guid CurrentTenantIdOrEmpty => _tenantContext.TenantId ?? Guid.Empty;

    public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) =>
        Database.BeginTransactionAsync(cancellationToken);

    public IExecutionStrategy CreateExecutionStrategy() => Database.CreateExecutionStrategy();

    public void ClearChangeTracker() => ChangeTracker.Clear();

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyConventions();
        return await base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyConventions()
    {
        var now = DateTime.UtcNow;
        var userId = _currentUser.UserId;

        foreach (var entry in ChangeTracker.Entries())
        {
            // Soft-delete interception: convert Delete → soft-delete for ISoftDeletable
            if (entry.State == EntityState.Deleted && entry.Entity is ISoftDeletable)
            {
                entry.State = EntityState.Modified;
                SetProperty(entry, nameof(ISoftDeletable.IsDeleted), true);
                SetProperty(entry, nameof(ISoftDeletable.DeletedAtUtc), now);
                if (userId.HasValue)
                    SetProperty(entry, nameof(ISoftDeletable.DeletedByUserId), userId.Value);
            }

            if (entry.Entity is IAuditable)
            {
                switch (entry.State)
                {
                    case EntityState.Added:
                        SetProperty(entry, nameof(IAuditable.CreatedAtUtc), now);
                        if (userId.HasValue) SetProperty(entry, nameof(IAuditable.CreatedByUserId), userId.Value);
                        break;
                    case EntityState.Modified:
                        SetProperty(entry, nameof(IAuditable.UpdatedAtUtc), now);
                        if (userId.HasValue) SetProperty(entry, nameof(IAuditable.UpdatedByUserId), userId.Value);
                        break;
                }
            }

            // توکنِ همزمانی اپلیکیشن‌محور: در هر درج/به‌روزرسانی یک مقدارِ تازه می‌گیرد
            // تا شرطِ «WHERE RowVersion=@original» همیشه با یک مقدارِ غیرِ NULL مطابقت کند.
            // این کار وابستگی به نوعِ خاصِ ستون (SQL Server rowversion) را حذف می‌کند؛
            // migration ستونی معمولی می‌سازد و نیازی به اسکریپتِ اصلاحیِ جداگانه نیست.
            if (entry.Entity is IConcurrencyStamped && entry.State is EntityState.Added or EntityState.Modified)
            {
                ((IConcurrencyStamped)entry.Entity).StampConcurrencyToken(Guid.NewGuid().ToByteArray());
            }

            if (entry.Entity is ITenantScoped && entry.State == EntityState.Added)
            {
                if (((Guid)entry.Property(nameof(ITenantScoped.TenantId)).CurrentValue!) == Guid.Empty
                    && _tenantContext.TenantId.HasValue)
                {
                    entry.Property(nameof(ITenantScoped.TenantId)).CurrentValue = _tenantContext.TenantId.Value;
                }
            }
        }
    }

    private static void SetProperty(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry, string name, object value)
    {
        var prop = entry.Properties.FirstOrDefault(p => p.Metadata.Name == name);
        if (prop is not null) prop.CurrentValue = value;
    }
}
// resync-marker
