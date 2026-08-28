-- SmartWash — schema for a single-batch SQL runner (Plesk Webadmin / myLittleAdmin).
--
-- Identical to migration.sql with the GO separators removed. GO is not T-SQL: it is a
-- batch separator that only sqlcmd and SSMS understand, so a web query window sends the
-- whole file as one batch and SQL Server rejects it with "Incorrect syntax near 'GO'".
-- The script contains no CREATE VIEW/PROCEDURE/TRIGGER, which are the statements that
-- genuinely require their own batch, so collapsing it into one is safe.
--
-- Still wrapped in the original transaction: it either applies completely or not at all.
IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;

BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [AppNotifications] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [Type] int NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Body] nvarchar(2000) NOT NULL,
        [EntityType] nvarchar(60) NULL,
        [EntityId] uniqueidentifier NULL,
        [IsRead] bit NOT NULL,
        [ReadAtUtc] datetime2 NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [UserId] uniqueidentifier NULL,
        CONSTRAINT [PK_AppNotifications] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [AuditLogs] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NULL,
        [UserId] uniqueidentifier NULL,
        [Action] nvarchar(60) NOT NULL,
        [EntityName] nvarchar(100) NOT NULL,
        [EntityId] nvarchar(60) NOT NULL,
        [OldValues] nvarchar(max) NULL,
        [NewValues] nvarchar(max) NULL,
        [IpAddress] nvarchar(60) NULL,
        [UserAgent] nvarchar(300) NULL,
        [CorrelationId] nvarchar(60) NULL,
        [OccurredAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Bays] (
        [Id] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NOT NULL,
        [Name] nvarchar(80) NOT NULL,
        [Number] int NOT NULL,
        [Status] int NOT NULL,
        [CurrentOrderId] uniqueidentifier NULL,
        [Notes] nvarchar(500) NULL,
        [IsActive] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Bays] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Branches] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Address] nvarchar(500) NULL,
        [Phone] nvarchar(20) NULL,
        [Latitude] nvarchar(32) NULL,
        [Longitude] nvarchar(32) NULL,
        [IsActive] bit NOT NULL,
        [IsDefault] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Branches] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Campaigns] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(150) NOT NULL,
        [Type] int NOT NULL,
        [Status] int NOT NULL,
        [Target] int NOT NULL,
        [MessageTemplate] nvarchar(2000) NOT NULL,
        [ScheduledAtUtc] datetime2 NULL,
        [StartedAtUtc] datetime2 NULL,
        [CompletedAtUtc] datetime2 NULL,
        [TargetMinVisits] int NULL,
        [TargetDaysSinceLastVisit] int NULL,
        [TargetMinTier] int NULL,
        [RecipientCount] int NOT NULL,
        [SuccessCount] int NOT NULL,
        [FailedCount] int NOT NULL,
        [EstimatedCostRials] bigint NOT NULL,
        [ActualCostRials] bigint NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Campaigns] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [CronJobRuns] (
        [Id] uniqueidentifier NOT NULL,
        [JobName] nvarchar(80) NOT NULL,
        [CorrelationId] nvarchar(60) NULL,
        [StartedAtUtc] datetime2 NOT NULL,
        [FinishedAtUtc] datetime2 NULL,
        [Status] int NOT NULL,
        [ItemsProcessed] int NOT NULL,
        [ErrorMessage] nvarchar(max) NULL,
        CONSTRAINT [PK_CronJobRuns] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Customers] (
        [Id] uniqueidentifier NOT NULL,
        [FullName] nvarchar(150) NOT NULL,
        [Phone] nvarchar(20) NOT NULL,
        [Email] nvarchar(256) NULL,
        [NationalId] nvarchar(20) NULL,
        [BirthDate] date NULL,
        [Gender] int NOT NULL,
        [Address] nvarchar(500) NULL,
        [Notes] nvarchar(1000) NULL,
        [WalletBalanceRials] bigint NOT NULL,
        [LoyaltyPoints] int NOT NULL,
        [Tier] int NOT NULL,
        [TotalVisits] int NOT NULL,
        [LifetimeSpendRials] bigint NOT NULL,
        [LastVisitAtUtc] datetime2 NULL,
        [IsActive] bit NOT NULL,
        [FreeServicesUsed] int NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Customers] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Expenses] (
        [Id] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NOT NULL,
        [Category] int NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [AmountRials] bigint NOT NULL,
        [PaymentMethod] int NOT NULL,
        [Date] date NOT NULL,
        [Description] nvarchar(1000) NULL,
        [ReceiptUrl] nvarchar(500) NULL,
        [RelatedWorkerId] uniqueidentifier NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Expenses] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Invoices] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [SubscriptionId] uniqueidentifier NULL,
        [Number] nvarchar(40) NOT NULL,
        [Kind] int NOT NULL,
        [Status] int NOT NULL,
        [IssuedAtUtc] datetime2 NOT NULL,
        [DueAtUtc] datetime2 NOT NULL,
        [PaidAtUtc] datetime2 NULL,
        [SubtotalRials] bigint NOT NULL,
        [TaxRials] bigint NOT NULL,
        [TotalRials] bigint NOT NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        CONSTRAINT [PK_Invoices] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [LoyaltyTransactions] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [Type] int NOT NULL,
        [Points] int NOT NULL,
        [BalanceAfter] int NOT NULL,
        [Description] nvarchar(500) NULL,
        [RelatedOrderId] uniqueidentifier NULL,
        [OccurredAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_LoyaltyTransactions] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Orders] (
        [Id] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NOT NULL,
        [Number] nvarchar(40) NOT NULL,
        [BayId] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NULL,
        [VehicleId] uniqueidentifier NULL,
        [CustomerName] nvarchar(150) NOT NULL,
        [CustomerPhone] nvarchar(20) NULL,
        [VehiclePlate] nvarchar(20) NOT NULL,
        [VehicleBrand] nvarchar(60) NULL,
        [VehicleModel] nvarchar(80) NULL,
        [Status] int NOT NULL,
        [Source] int NOT NULL,
        [StartedAtUtc] datetime2 NOT NULL,
        [CompletedAtUtc] datetime2 NULL,
        [CancelledAtUtc] datetime2 NULL,
        [ExpectedDurationMinutes] int NOT NULL,
        [SubtotalRials] bigint NOT NULL,
        [DiscountRials] bigint NOT NULL,
        [WalletUsedRials] bigint NOT NULL,
        [LoyaltyPointsUsed] int NOT NULL,
        [TotalRials] bigint NOT NULL,
        [PaidRials] bigint NOT NULL,
        [FinalPaymentMethod] int NULL,
        [Notes] nvarchar(1000) NULL,
        [ReservationId] uniqueidentifier NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Orders] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [OtpCodes] (
        [Id] uniqueidentifier NOT NULL,
        [Destination] nvarchar(256) NOT NULL,
        [Purpose] int NOT NULL,
        [CodeHash] nvarchar(256) NOT NULL,
        [ExpiresAtUtc] datetime2 NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [ConsumedAtUtc] datetime2 NULL,
        [AttemptCount] int NOT NULL,
        [UserId] uniqueidentifier NULL,
        CONSTRAINT [PK_OtpCodes] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Payments] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [InvoiceId] uniqueidentifier NOT NULL,
        [Gateway] int NOT NULL,
        [Status] int NOT NULL,
        [AmountRials] bigint NOT NULL,
        [Authority] nvarchar(100) NULL,
        [ReferenceId] nvarchar(100) NULL,
        [RawResponse] nvarchar(4000) NULL,
        [PaidAtUtc] datetime2 NULL,
        [CallbackUrl] nvarchar(500) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        CONSTRAINT [PK_Payments] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Plans] (
        [Id] uniqueidentifier NOT NULL,
        [Code] nvarchar(40) NOT NULL,
        [DisplayName] nvarchar(120) NOT NULL,
        [Description] nvarchar(1000) NULL,
        [BillingModel] int NOT NULL,
        [SetupFeeRials] bigint NOT NULL,
        [MonthlyPriceRials] bigint NOT NULL,
        [YearlyPriceRials] bigint NOT NULL,
        [PerCarPriceRials] bigint NOT NULL,
        [IncludedCarsPerMonth] int NULL,
        [IncludedSmsPerMonth] int NOT NULL,
        [IncludedSmsTemplateCount] int NOT NULL,
        [SmsOverageUnitPriceRials] bigint NOT NULL,
        [PerCarBrackets] nvarchar(max) NOT NULL,
        [SortOrder] int NOT NULL,
        [IsActive] bit NOT NULL,
        [IsPublic] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        CONSTRAINT [PK_Plans] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [PlatformSmsSettings] (
        [Id] uniqueidentifier NOT NULL,
        [Provider] nvarchar(60) NOT NULL,
        [BaseUrl] nvarchar(300) NOT NULL,
        [ApiKey] nvarchar(300) NULL,
        [LineNumber] nvarchar(40) NULL,
        [IsEnabled] bit NOT NULL,
        [LastTestedAtUtc] datetime2 NULL,
        [LastTestSucceeded] bit NULL,
        [LastTestMessage] nvarchar(500) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(max) NOT NULL,
        CONSTRAINT [PK_PlatformSmsSettings] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [PlatformSmsTemplates] (
        [Id] uniqueidentifier NOT NULL,
        [Code] nvarchar(80) NOT NULL,
        [DisplayName] nvarchar(160) NOT NULL,
        [ProviderTemplateId] int NOT NULL,
        [Category] int NOT NULL,
        [ParametersJson] nvarchar(2000) NOT NULL,
        [IsTenantAvailable] bit NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(max) NOT NULL,
        CONSTRAINT [PK_PlatformSmsTemplates] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Reservations] (
        [Id] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NULL,
        [CustomerName] nvarchar(150) NOT NULL,
        [CustomerPhone] nvarchar(20) NOT NULL,
        [VehiclePlate] nvarchar(20) NOT NULL,
        [VehicleBrand] nvarchar(60) NULL,
        [VehicleModel] nvarchar(80) NULL,
        [ScheduledAtUtc] datetime2 NOT NULL,
        [EstimatedDurationMinutes] int NOT NULL,
        [PreferredBayId] uniqueidentifier NULL,
        [Status] int NOT NULL,
        [ConvertedAtUtc] datetime2 NULL,
        [ConvertedOrderId] uniqueidentifier NULL,
        [CancelledAtUtc] datetime2 NULL,
        [CancelReason] nvarchar(500) NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Reservations] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [ServiceReminders] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [VehicleId] uniqueidentifier NULL,
        [Title] nvarchar(200) NOT NULL,
        [DueAtUtc] datetime2 NOT NULL,
        [Type] int NOT NULL,
        [Status] int NOT NULL,
        [SentAtUtc] datetime2 NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_ServiceReminders] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Services] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Description] nvarchar(500) NULL,
        [Category] int NOT NULL,
        [PriceRials] bigint NOT NULL,
        [DurationMinutes] int NOT NULL,
        [WorkerCommissionRate] decimal(5,2) NOT NULL,
        [IsActive] bit NOT NULL,
        [SortOrder] int NOT NULL,
        [IconKey] nvarchar(60) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Services] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Shifts] (
        [Id] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NOT NULL,
        [OpenedByUserId] uniqueidentifier NOT NULL,
        [ClosedByUserId] uniqueidentifier NULL,
        [OpenedAtUtc] datetime2 NOT NULL,
        [ClosedAtUtc] datetime2 NULL,
        [OpeningCashRials] bigint NOT NULL,
        [ClosingCashRials] bigint NOT NULL,
        [ExpectedCashRials] bigint NOT NULL,
        [CashSalesRials] bigint NOT NULL,
        [CardSalesRials] bigint NOT NULL,
        [OnlineSalesRials] bigint NOT NULL,
        [TipsRials] bigint NOT NULL,
        [WalletSalesRials] bigint NOT NULL,
        [ExpensesRials] bigint NOT NULL,
        [OrderCount] int NOT NULL,
        [Status] int NOT NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Shifts] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [SmsMessages] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [Phone] nvarchar(20) NOT NULL,
        [Body] nvarchar(2000) NOT NULL,
        [Kind] int NOT NULL,
        [RelatedEntityId] uniqueidentifier NULL,
        [Status] int NOT NULL,
        [ProviderMessageId] nvarchar(120) NULL,
        [Error] nvarchar(1000) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [SentAtUtc] datetime2 NULL,
        [CostRials] bigint NOT NULL,
        CONSTRAINT [PK_SmsMessages] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [SmsUsageRecords] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [SubscriptionId] uniqueidentifier NULL,
        [TemplateId] uniqueidentifier NULL,
        [Purpose] nvarchar(80) NOT NULL,
        [Recipient] nvarchar(20) NOT NULL,
        [Units] int NOT NULL,
        [OverageUnitPriceRials] bigint NOT NULL,
        [Status] int NOT NULL,
        [ProviderMessageId] nvarchar(80) NULL,
        [Error] nvarchar(1000) NULL,
        [OccurredAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_SmsUsageRecords] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Subscriptions] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [PlanId] uniqueidentifier NOT NULL,
        [Cycle] int NOT NULL,
        [Status] int NOT NULL,
        [StartsAtUtc] datetime2 NOT NULL,
        [CurrentPeriodStartUtc] datetime2 NOT NULL,
        [CurrentPeriodEndUtc] datetime2 NOT NULL,
        [CancelledAtUtc] datetime2 NULL,
        [GraceEndsAtUtc] datetime2 NULL,
        [PriceRials] bigint NOT NULL,
        [AutoRenew] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        CONSTRAINT [PK_Subscriptions] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Tenants] (
        [Id] uniqueidentifier NOT NULL,
        [Slug] nvarchar(60) NOT NULL,
        [DisplayName] nvarchar(150) NOT NULL,
        [OwnerEmail] nvarchar(256) NOT NULL,
        [OwnerPhone] nvarchar(20) NULL,
        [LogoUrl] nvarchar(500) NULL,
        [PrimaryColor] nvarchar(20) NULL,
        [TimeZone] nvarchar(60) NOT NULL,
        [Locale] nvarchar(10) NOT NULL,
        [Currency] nvarchar(10) NOT NULL,
        [Status] int NOT NULL,
        [TrialEndsAtUtc] datetime2 NULL,
        [SuspendedAtUtc] datetime2 NULL,
        [SuspendReason] nvarchar(500) NULL,
        [ArchivedAtUtc] datetime2 NULL,
        [ActiveSubscriptionId] uniqueidentifier NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        CONSTRAINT [PK_Tenants] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [TenantSettings] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [LoyaltyEnabled] bit NOT NULL,
        [LoyaltyPointsPerRial] int NOT NULL,
        [LoyaltyPointValueRials] bigint NOT NULL,
        [LoyaltyExpiryDays] int NOT NULL,
        [WalletEnabled] bit NOT NULL,
        [SmsEnabled] bit NOT NULL,
        [SmsSenderNumber] nvarchar(20) NULL,
        [SmsProvider] nvarchar(60) NULL,
        [ReservationEnabled] bit NOT NULL,
        [ReservationLeadMinutes] int NOT NULL,
        [ReservationMaxAdvanceDays] int NOT NULL,
        [ReceiptHeader] nvarchar(200) NOT NULL,
        [ReceiptFooter] nvarchar(500) NULL,
        [InvoicePrefix] nvarchar(10) NULL,
        [LastOrderNumber] int NOT NULL,
        [Tagline] nvarchar(200) NULL,
        [Theme] nvarchar(20) NOT NULL,
        [PrimaryColor] nvarchar(20) NULL,
        [LogoUrl] nvarchar(500) NULL,
        [OnboardingStep] int NOT NULL,
        [OnboardingCompletedAtUtc] datetime2 NULL,
        CONSTRAINT [PK_TenantSettings] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [TenantSmsTemplates] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [TemplateId] uniqueidentifier NOT NULL,
        [EnabledAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_TenantSmsTemplates] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [TicketAttachments] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [TicketId] uniqueidentifier NOT NULL,
        [MessageId] uniqueidentifier NULL,
        [FileName] nvarchar(260) NOT NULL,
        [Path] nvarchar(500) NOT NULL,
        [Url] nvarchar(500) NOT NULL,
        [ContentType] nvarchar(120) NOT NULL,
        [SizeBytes] bigint NOT NULL,
        [UploadedByUserId] uniqueidentifier NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_TicketAttachments] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [TicketEvents] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [TicketId] uniqueidentifier NOT NULL,
        [Type] int NOT NULL,
        [FromValue] nvarchar(100) NULL,
        [ToValue] nvarchar(100) NULL,
        [Note] nvarchar(1000) NULL,
        [ActorUserId] uniqueidentifier NULL,
        [ActorName] nvarchar(150) NOT NULL,
        [ActorSide] int NOT NULL,
        [OccurredAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_TicketEvents] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [TicketMessages] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [TicketId] uniqueidentifier NOT NULL,
        [AuthorUserId] uniqueidentifier NULL,
        [AuthorName] nvarchar(150) NOT NULL,
        [AuthorSide] int NOT NULL,
        [Body] nvarchar(4000) NOT NULL,
        [IsInternalNote] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_TicketMessages] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Tickets] (
        [Id] uniqueidentifier NOT NULL,
        [Number] nvarchar(30) NOT NULL,
        [Subject] nvarchar(200) NOT NULL,
        [Category] int NOT NULL,
        [Priority] int NOT NULL,
        [Status] int NOT NULL,
        [RequesterUserId] uniqueidentifier NOT NULL,
        [RequesterName] nvarchar(150) NOT NULL,
        [RequesterPhone] nvarchar(20) NULL,
        [BranchId] uniqueidentifier NULL,
        [RelatedEntityType] nvarchar(60) NULL,
        [RelatedEntityId] uniqueidentifier NULL,
        [AssignedToUserId] uniqueidentifier NULL,
        [AssignedAtUtc] datetime2 NULL,
        [DueAtUtc] datetime2 NOT NULL,
        [FirstResponseAtUtc] datetime2 NULL,
        [ResolvedAtUtc] datetime2 NULL,
        [ClosedAtUtc] datetime2 NULL,
        [ClosedByUserId] uniqueidentifier NULL,
        [LastMessageAtUtc] datetime2 NOT NULL,
        [LastMessageSide] int NOT NULL,
        [MessageCount] int NOT NULL,
        [UnreadForTenant] int NOT NULL,
        [UnreadForPlatform] int NOT NULL,
        [ReopenCount] int NOT NULL,
        [SatisfactionRating] int NULL,
        [SatisfactionComment] nvarchar(1000) NULL,
        [RatedAtUtc] datetime2 NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Tickets] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [UsageEvents] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [OrderId] uniqueidentifier NOT NULL,
        [PeriodDate] date NOT NULL,
        [RevenueRials] bigint NOT NULL,
        [Invoiced] bit NOT NULL,
        [InvoiceId] uniqueidentifier NULL,
        [OccurredAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_UsageEvents] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Users] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NULL,
        [Email] nvarchar(256) NOT NULL,
        [NormalizedEmail] nvarchar(256) NOT NULL,
        [Phone] nvarchar(20) NULL,
        [DisplayName] nvarchar(100) NOT NULL,
        [PasswordHash] nvarchar(256) NOT NULL,
        [EmailConfirmed] bit NOT NULL,
        [PhoneConfirmed] bit NOT NULL,
        [IsActive] bit NOT NULL,
        [IsLockedOut] bit NOT NULL,
        [LastLoginAtUtc] datetime2 NULL,
        [FailedLoginAttempts] int NOT NULL,
        [LockoutEndUtc] datetime2 NULL,
        [AvatarUrl] nvarchar(500) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [WalletTransactions] (
        [Id] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [Type] int NOT NULL,
        [AmountRials] bigint NOT NULL,
        [BalanceAfterRials] bigint NOT NULL,
        [Description] nvarchar(500) NULL,
        [RelatedOrderId] uniqueidentifier NULL,
        [OccurredAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_WalletTransactions] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [Workers] (
        [Id] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NULL,
        [FullName] nvarchar(150) NOT NULL,
        [Role] nvarchar(60) NOT NULL,
        [Phone] nvarchar(20) NULL,
        [NationalId] nvarchar(20) NULL,
        [AvatarUrl] nvarchar(500) NULL,
        [CommissionRate] decimal(5,2) NOT NULL,
        [IsActive] bit NOT NULL,
        [HiredAtUtc] datetime2 NULL,
        [TerminatedAtUtc] datetime2 NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByUserId] uniqueidentifier NULL,
        [UpdatedAtUtc] datetime2 NULL,
        [UpdatedByUserId] uniqueidentifier NULL,
        [RowVersion] varbinary(16) NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedByUserId] uniqueidentifier NULL,
        CONSTRAINT [PK_Workers] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [CustomerVehicles] (
        [Id] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [Plate] nvarchar(20) NOT NULL,
        [Brand] nvarchar(60) NOT NULL,
        [Model] nvarchar(80) NOT NULL,
        [Color] nvarchar(40) NULL,
        [Year] int NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_CustomerVehicles] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CustomerVehicles_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [InvoiceLines] (
        [Id] uniqueidentifier NOT NULL,
        [InvoiceId] uniqueidentifier NOT NULL,
        [Description] nvarchar(300) NOT NULL,
        [Quantity] int NOT NULL,
        [UnitPriceRials] bigint NOT NULL,
        [LineTotalRials] bigint NOT NULL,
        CONSTRAINT [PK_InvoiceLines] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_InvoiceLines_Invoices_InvoiceId] FOREIGN KEY ([InvoiceId]) REFERENCES [Invoices] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [OrderLines] (
        [Id] uniqueidentifier NOT NULL,
        [OrderId] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [ServiceId] uniqueidentifier NOT NULL,
        [ServiceName] nvarchar(120) NOT NULL,
        [UnitPriceRials] bigint NOT NULL,
        [Quantity] int NOT NULL,
        [DurationMinutes] int NOT NULL,
        [LineTotalRials] bigint NOT NULL,
        [WorkerId] uniqueidentifier NULL,
        [WorkerName] nvarchar(150) NULL,
        [WorkerCommissionRate] decimal(5,2) NOT NULL,
        [WorkerCommissionRials] bigint NOT NULL,
        [TipRials] bigint NOT NULL,
        CONSTRAINT [PK_OrderLines] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_OrderLines_Orders_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [Orders] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [OrderPayments] (
        [Id] uniqueidentifier NOT NULL,
        [OrderId] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [Method] int NOT NULL,
        [AmountRials] bigint NOT NULL,
        [Reference] nvarchar(200) NULL,
        [PaidAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_OrderPayments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_OrderPayments_Orders_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [Orders] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [PlanFeatures] (
        [Id] uniqueidentifier NOT NULL,
        [PlanId] uniqueidentifier NOT NULL,
        [Key] nvarchar(60) NOT NULL,
        [Value] nvarchar(500) NOT NULL,
        CONSTRAINT [PK_PlanFeatures] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PlanFeatures_Plans_PlanId] FOREIGN KEY ([PlanId]) REFERENCES [Plans] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [ReservationServices] (
        [Id] uniqueidentifier NOT NULL,
        [ReservationId] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [ServiceId] uniqueidentifier NOT NULL,
        [ServiceName] nvarchar(120) NOT NULL,
        [PriceRials] bigint NOT NULL,
        [DurationMinutes] int NOT NULL,
        CONSTRAINT [PK_ReservationServices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ReservationServices_Reservations_ReservationId] FOREIGN KEY ([ReservationId]) REFERENCES [Reservations] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [RefreshTokens] (
        [Id] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [Token] nvarchar(256) NOT NULL,
        [ExpiresAtUtc] datetime2 NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [CreatedByIp] nvarchar(60) NULL,
        [RevokedAtUtc] datetime2 NULL,
        [RevokedByIp] nvarchar(60) NULL,
        [ReplacedByToken] nvarchar(256) NULL,
        CONSTRAINT [PK_RefreshTokens] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RefreshTokens_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE TABLE [UserRoles] (
        [Id] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NULL,
        [Role] nvarchar(60) NOT NULL,
        [AssignedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_UserRoles] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_UserRoles_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_AppNotifications_TenantId_IsRead_CreatedAtUtc] ON [AppNotifications] ([TenantId], [IsRead], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_AppNotifications_TenantId_UserId_IsRead] ON [AppNotifications] ([TenantId], [UserId], [IsRead]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_EntityName_EntityId] ON [AuditLogs] ([EntityName], [EntityId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_TenantId_OccurredAtUtc] ON [AuditLogs] ([TenantId], [OccurredAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Bays_TenantId_BranchId] ON [Bays] ([TenantId], [BranchId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Bays_TenantId_BranchId_Number] ON [Bays] ([TenantId], [BranchId], [Number]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Branches_TenantId_IsActive] ON [Branches] ([TenantId], [IsActive]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Branches_TenantId_IsDefault] ON [Branches] ([TenantId], [IsDefault]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Campaigns_TenantId_ScheduledAtUtc] ON [Campaigns] ([TenantId], [ScheduledAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Campaigns_TenantId_Status] ON [Campaigns] ([TenantId], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_CronJobRuns_JobName_StartedAtUtc] ON [CronJobRuns] ([JobName], [StartedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Customers_TenantId_IsActive] ON [Customers] ([TenantId], [IsActive]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Customers_TenantId_IsActive_LastVisitAtUtc] ON [Customers] ([TenantId], [IsActive], [LastVisitAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Customers_TenantId_Phone] ON [Customers] ([TenantId], [Phone]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Customers_TenantId_Tier] ON [Customers] ([TenantId], [Tier]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_CustomerVehicles_CustomerId] ON [CustomerVehicles] ([CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_CustomerVehicles_TenantId_CustomerId] ON [CustomerVehicles] ([TenantId], [CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_CustomerVehicles_TenantId_Plate] ON [CustomerVehicles] ([TenantId], [Plate]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Expenses_TenantId_BranchId_Date] ON [Expenses] ([TenantId], [BranchId], [Date]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Expenses_TenantId_Category] ON [Expenses] ([TenantId], [Category]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_InvoiceLines_InvoiceId] ON [InvoiceLines] ([InvoiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Invoices_Number] ON [Invoices] ([Number]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Invoices_TenantId_Status] ON [Invoices] ([TenantId], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_LoyaltyTransactions_TenantId_CustomerId_OccurredAtUtc] ON [LoyaltyTransactions] ([TenantId], [CustomerId], [OccurredAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_OrderLines_OrderId] ON [OrderLines] ([OrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_OrderLines_TenantId_OrderId] ON [OrderLines] ([TenantId], [OrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_OrderLines_TenantId_WorkerId] ON [OrderLines] ([TenantId], [WorkerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_OrderPayments_OrderId] ON [OrderPayments] ([OrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_OrderPayments_TenantId_OrderId] ON [OrderPayments] ([TenantId], [OrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Orders_TenantId_BranchId_Status] ON [Orders] ([TenantId], [BranchId], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Orders_TenantId_CreatedAtUtc] ON [Orders] ([TenantId], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Orders_TenantId_CustomerId] ON [Orders] ([TenantId], [CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Orders_TenantId_Number] ON [Orders] ([TenantId], [Number]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Orders_TenantId_StartedAtUtc] ON [Orders] ([TenantId], [StartedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Orders_TenantId_Status_CreatedAtUtc] ON [Orders] ([TenantId], [Status], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_OtpCodes_Destination_Purpose] ON [OtpCodes] ([Destination], [Purpose]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_OtpCodes_ExpiresAtUtc] ON [OtpCodes] ([ExpiresAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Payments_Authority] ON [Payments] ([Authority]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Payments_InvoiceId] ON [Payments] ([InvoiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PlanFeatures_PlanId_Key] ON [PlanFeatures] ([PlanId], [Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Plans_Code] ON [Plans] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PlatformSmsTemplates_Code] ON [PlatformSmsTemplates] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RefreshTokens_Token] ON [RefreshTokens] ([Token]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_RefreshTokens_UserId] ON [RefreshTokens] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Reservations_TenantId_BranchId_ScheduledAtUtc] ON [Reservations] ([TenantId], [BranchId], [ScheduledAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Reservations_TenantId_CustomerId] ON [Reservations] ([TenantId], [CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Reservations_TenantId_ScheduledAtUtc] ON [Reservations] ([TenantId], [ScheduledAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Reservations_TenantId_Status] ON [Reservations] ([TenantId], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Reservations_TenantId_Status_ScheduledAtUtc] ON [Reservations] ([TenantId], [Status], [ScheduledAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_ReservationServices_ReservationId] ON [ReservationServices] ([ReservationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_ReservationServices_TenantId_ReservationId] ON [ReservationServices] ([TenantId], [ReservationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_ServiceReminders_TenantId_CustomerId] ON [ServiceReminders] ([TenantId], [CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_ServiceReminders_TenantId_Status_DueAtUtc] ON [ServiceReminders] ([TenantId], [Status], [DueAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Services_TenantId_IsActive_Category] ON [Services] ([TenantId], [IsActive], [Category]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Shifts_TenantId_BranchId_Status] ON [Shifts] ([TenantId], [BranchId], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Shifts_TenantId_OpenedAtUtc] ON [Shifts] ([TenantId], [OpenedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_SmsMessages_TenantId_Status_CreatedAtUtc] ON [SmsMessages] ([TenantId], [Status], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_SmsUsageRecords_TemplateId_OccurredAtUtc] ON [SmsUsageRecords] ([TemplateId], [OccurredAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_SmsUsageRecords_TenantId_Status_OccurredAtUtc] ON [SmsUsageRecords] ([TenantId], [Status], [OccurredAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_SmsUsageRecords_TenantId_SubscriptionId_Status] ON [SmsUsageRecords] ([TenantId], [SubscriptionId], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Subscriptions_TenantId] ON [Subscriptions] ([TenantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Subscriptions_TenantId_Status] ON [Subscriptions] ([TenantId], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Tenants_Slug] ON [Tenants] ([Slug]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_TenantSettings_TenantId] ON [TenantSettings] ([TenantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_TenantSmsTemplates_TenantId_TemplateId] ON [TenantSmsTemplates] ([TenantId], [TemplateId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_TicketAttachments_MessageId] ON [TicketAttachments] ([MessageId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_TicketAttachments_TicketId_CreatedAtUtc] ON [TicketAttachments] ([TicketId], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_TicketEvents_TicketId_OccurredAtUtc] ON [TicketEvents] ([TicketId], [OccurredAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_TicketMessages_TenantId_TicketId] ON [TicketMessages] ([TenantId], [TicketId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_TicketMessages_TicketId_CreatedAtUtc] ON [TicketMessages] ([TicketId], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Tickets_AssignedToUserId] ON [Tickets] ([AssignedToUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Tickets_Number] ON [Tickets] ([Number]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Tickets_Status_Priority_DueAtUtc] ON [Tickets] ([Status], [Priority], [DueAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Tickets_TenantId_Category] ON [Tickets] ([TenantId], [Category]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Tickets_TenantId_Status_LastMessageAtUtc] ON [Tickets] ([TenantId], [Status], [LastMessageAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_UsageEvents_TenantId_Invoiced] ON [UsageEvents] ([TenantId], [Invoiced]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_UsageEvents_TenantId_OrderId] ON [UsageEvents] ([TenantId], [OrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_UsageEvents_TenantId_PeriodDate] ON [UsageEvents] ([TenantId], [PeriodDate]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_UserRoles_UserId_TenantId_Role] ON [UserRoles] ([UserId], [TenantId], [Role]) WHERE [TenantId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Users_NormalizedEmail] ON [Users] ([NormalizedEmail]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Users_TenantId] ON [Users] ([TenantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_WalletTransactions_TenantId_CustomerId_OccurredAtUtc] ON [WalletTransactions] ([TenantId], [CustomerId], [OccurredAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Workers_TenantId_BranchId_IsActive] ON [Workers] ([TenantId], [BranchId], [IsActive]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    CREATE INDEX [IX_Workers_TenantId_UserId] ON [Workers] ([TenantId], [UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827145538_Initial'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260827145538_Initial', N'8.0.10');
END;

COMMIT;

