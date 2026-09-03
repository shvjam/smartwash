// Mirror backend DTOs from SmartWash.Application.Modules.*

export type Guid = string;
export type DateTimeIso = string;
export type DateOnlyIso = string; // YYYY-MM-DD

export type PagedList<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type ApiError = { code: string; message: string };

// Enums (string-or-number tolerant, but backend serializes as numbers by default)
// همه‌ی enumها دقیقاً منطبق با enumهای دامنه‌ی بک‌اند (SmartWash.Domain.*). سریال‌سازی عددی است.
export enum OrderStatus { InProgress = 0, Completed = 1, Cancelled = 2 }
export enum OrderSource { WalkIn = 0, Reservation = 1, Online = 2 }
export enum BayStatus { Free = 0, Occupied = 1, Maintenance = 2 }
export enum PaymentMethod { Cash = 0, Card = 1, Online = 2, Wallet = 3, Mixed = 4, Credit = 5, Tip = 6 }
export enum ReservationStatus { Pending = 0, Confirmed = 1, Arrived = 2, NoShow = 3, Cancelled = 4 }
export enum LoyaltyTier { Bronze = 0, Silver = 1, Gold = 2, Platinum = 3, Diamond = 4 }
export enum Gender { Unknown = 0, Male = 1, Female = 2 }
export enum ServiceCategory { Main = 0, Side = 1, Detailing = 2, Polish = 3, Interior = 4, Engine = 5 }
export enum ShiftStatus { Open = 0, Closed = 1 }
export enum ExpenseCategory { Salary = 0, Commission = 1, Supplies = 2, Utilities = 3, Rent = 4, Maintenance = 5, Marketing = 6, Tax = 7, Other = 99 }
export enum CampaignType { Sms = 0, Email = 1, Push = 2 }
export enum CampaignTarget { AllCustomers = 0, ActiveCustomers = 1, InactiveCustomers = 2, ByTier = 3, Birthday = 4, Custom = 99 }
export enum CampaignStatus { Draft = 0, Scheduled = 1, Sending = 2, Completed = 3, Cancelled = 4, Failed = 5 }
export enum NotificationType { Info = 0, OrderOverdue = 1, ReservationReminder = 2, LowInventory = 3, BillingDue = 4, Birthday = 5 }

// DTOs
export type BranchDto = {
  id: Guid; name: string; address?: string | null; phone?: string | null;
  latitude?: string | null; longitude?: string | null; isActive: boolean; isDefault: boolean;
};

export type BayDto = {
  id: Guid; branchId: Guid; name: string; number: number; status: BayStatus;
  isActive: boolean; currentOrderId?: Guid | null; notes?: string | null;
};

export type WorkerDto = {
  id: Guid; branchId: Guid; fullName: string; role: string; phone?: string | null;
  nationalId?: string | null; commissionRate: number; isActive: boolean; avatarUrl?: string | null;
};

export type ServiceDto = {
  id: Guid; name: string; description?: string | null; category: ServiceCategory;
  priceRials: number; durationMinutes: number; workerCommissionRate: number;
  isActive: boolean; sortOrder: number; iconKey?: string | null;
};

export type CustomerVehicleDto = {
  id: Guid; plate: string; brand: string; model: string;
  color?: string | null; year?: number | null;
};
export type CustomerDto = {
  id: Guid; fullName: string; phone: string; email?: string | null; nationalId?: string | null;
  birthDate?: DateOnlyIso | null; gender: Gender; address?: string | null; notes?: string | null;
  walletBalanceRials: number; loyaltyPoints: number; tier: LoyaltyTier;
  totalVisits: number; lifetimeSpendRials: number; lastVisitAtUtc?: DateTimeIso | null;
  isActive: boolean;
  freeServicesUsed: number;        // تعداد خدمات رایگان استفاده‌شده
  hasFreeServiceAvailable: boolean; // آیا الان می‌تواند خدمت رایگان بگیرد
  vehicles: CustomerVehicleDto[];
};

export type OrderLineDto = {
  id: Guid; serviceId: Guid; serviceName: string; quantity: number;
  unitPriceRials: number; lineTotalRials: number;
  workerId?: Guid | null; workerName?: string | null; workerCommissionRials: number;
  tipRials: number; // انعام ثبت‌شده برای این خط
};
export type OrderPaymentDto = {
  id: Guid; method: PaymentMethod; amountRials: number; reference?: string | null; paidAtUtc: DateTimeIso;
};
export type OrderDto = {
  id: Guid; branchId: Guid; bayId: Guid; number: string;
  customerId?: Guid | null; vehicleId?: Guid | null; customerName: string; customerPhone?: string | null;
  vehiclePlate: string; vehicleBrand?: string | null; vehicleModel?: string | null;
  status: OrderStatus; source: OrderSource; reservationId?: Guid | null;
  subtotalRials: number; discountRials: number; walletUsedRials: number;
  loyaltyPointsUsed: number; totalRials: number; paidRials: number;
  finalPaymentMethod?: PaymentMethod | null; notes?: string | null;
  expectedDurationMinutes: number;
  startedAtUtc: DateTimeIso; completedAtUtc?: DateTimeIso | null;
  lines: OrderLineDto[]; payments: OrderPaymentDto[];
};

export type ReservationServiceDto = { serviceId: Guid; serviceName: string; priceRials: number; durationMinutes: number };
export type ReservationDto = {
  id: Guid; branchId: Guid; customerId?: Guid | null; customerName: string; customerPhone: string;
  vehiclePlate: string; vehicleBrand?: string | null; vehicleModel?: string | null;
  scheduledAtUtc: DateTimeIso; estimatedDurationMinutes: number;
  preferredBayId?: Guid | null; notes?: string | null; status: ReservationStatus;
  services: ReservationServiceDto[]; createdAtUtc: DateTimeIso;
};

export type ExpenseDto = {
  id: Guid; branchId: Guid; category: ExpenseCategory; title: string; amountRials: number;
  paymentMethod: PaymentMethod; date: DateOnlyIso; description?: string | null;
  receiptUrl?: string | null; relatedWorkerId?: Guid | null;
};

export type ShiftDto = {
  id: Guid; branchId: Guid; openedByUserId: Guid; closedByUserId?: Guid | null;
  openedAtUtc: DateTimeIso; closedAtUtc?: DateTimeIso | null;
  openingCashRials: number; closingCashRials: number; expectedCashRials: number;
  cashSalesRials: number; cardSalesRials: number; onlineSalesRials: number;
  tipsRials: number; walletSalesRials: number;
  expensesRials: number; orderCount: number; status: ShiftStatus; variance: number; notes?: string | null;
};

export type TenantSettingsDto = {
  loyaltyEnabled: boolean; loyaltyPointsPerRial: number; loyaltyPointValueRials: number; loyaltyExpiryDays: number;
  walletEnabled: boolean; smsEnabled: boolean;
  /** فقط-خواندنی — اتصال متمرکز پیامک را مدیر ارشد پلتفرم تعیین می‌کند. */
  readonly smsSenderNumber?: string | null;
  /** فقط-خواندنی — اتصال متمرکز پیامک را مدیر ارشد پلتفرم تعیین می‌کند. */
  readonly smsProvider?: string | null;
  reservationEnabled: boolean; reservationLeadMinutes: number; reservationMaxAdvanceDays: number;
  receiptHeader: string; receiptFooter?: string | null; invoicePrefix?: string | null;
  tagline?: string | null; theme: string; primaryColor?: string | null; logoUrl?: string | null;
};

export type NotificationDto = {
  id: Guid; type: NotificationType; title: string; body: string;
  entityType?: string | null; entityId?: Guid | null; isRead: boolean; createdAtUtc: DateTimeIso;
};

export type CampaignDto = {
  id: Guid; name: string; type: CampaignType; status: CampaignStatus; target: CampaignTarget;
  messageTemplate: string; scheduledAtUtc?: DateTimeIso | null;
  targetMinVisits?: number | null; targetDaysSinceLastVisit?: number | null; targetMinTier?: LoyaltyTier | null;
  recipientCount: number; successCount: number; failedCount: number;
  estimatedCostRials: number; actualCostRials: number;
  startedAtUtc?: DateTimeIso | null; completedAtUtc?: DateTimeIso | null; createdAtUtc: DateTimeIso;
};

export type DashboardDto = {
  todayRevenueRials: number; todayOrders: number; todayCustomers: number;
  activeBays: number; freeBays: number; occupiedBays: number; pendingReservations: number;
  monthRevenueRials: number; monthOrders: number; monthExpensesRials: number; monthNetRials: number;
};
export type DailyRevenuePoint = { date: DateOnlyIso; revenueRials: number; orderCount: number };
export type WorkerPerformanceRow = {
  workerId: Guid; fullName: string; orderCount: number; revenueRials: number;
  /** The tenant's share-of-service payment to the worker. */
  commissionRials: number;
  /** What customers added on top; not revenue, so reported separately. */
  tipsRials: number;
  /** commission + tips — what the worker is owed for the period. */
  earningsRials: number;
};

// Platform: Plans / Tenants / Subscriptions
export enum PlanBillingModel { Subscription = 0, UsageBased = 1, Hybrid = 2 }
// دقیقاً منطبق با SmartWash.Domain.Tenancy.TenantStatus
export enum TenantStatus { Trial = 0, Active = 1, Grace = 2, Suspended = 3, Cancelled = 4, Expired = 5, Archived = 6 }
// دقیقاً منطبق با SmartWash.Domain.Billing.SubscriptionStatus
export enum SubscriptionStatus { PendingPayment = 0, Active = 1, PastDue = 2, Cancelled = 3, Expired = 4 }
export enum SubscriptionCycle { Monthly = 0, Yearly = 1 }

export type PlanFeatureDto = { key: string; value: string };
export type PlanDto = {
  id: Guid; code: string; displayName: string; description?: string | null;
  billingModel: PlanBillingModel;
  setupFeeRials: number; monthlyPriceRials: number; yearlyPriceRials: number; perCarPriceRials: number;
  includedCarsPerMonth?: number | null;
  sortOrder: number; isActive: boolean; isPublic: boolean;
  features: PlanFeatureDto[];
};

// خروجی GET /me/tenant (منبعِ معتبرِ وضعیت مستاجرِ جاری برای فرانت — شاملِ Grace)
export type CurrentTenantDto = {
  id: Guid; slug: string; displayName: string; ownerEmail: string;
  ownerPhone?: string | null; logoUrl?: string | null; primaryColor?: string | null;
  status: TenantStatus; trialEndsAtUtc?: DateTimeIso | null;
  activeSubscriptionId?: Guid | null; createdAtUtc: DateTimeIso;
};

// دقیقاً منطبق با TenantSummaryDto (خروجی لیستِ /platform/tenants)
export type TenantAdminDto = {
  id: Guid; slug: string; displayName: string; status: TenantStatus;
  trialEndsAtUtc?: DateTimeIso | null; createdAtUtc: DateTimeIso;
  ownerEmail: string;
  subscriptionStatus?: SubscriptionStatus | null;
  planCode?: string | null; activeUntilUtc?: DateTimeIso | null;
};

// دقیقاً منطبق با AdminSubscriptionDto در SubscriptionsAdminModule بک‌اند
export type SubscriptionDto = {
  id: Guid; tenantId: Guid; tenantSlug: string; tenantName: string;
  planId: Guid; planName: string;
  cycle: SubscriptionCycle; status: SubscriptionStatus;
  startsAtUtc: DateTimeIso; currentPeriodStartUtc: DateTimeIso; currentPeriodEndUtc: DateTimeIso;
  cancelledAtUtc?: DateTimeIso | null; graceEndsAtUtc?: DateTimeIso | null;
  priceRials: number; autoRenew: boolean;
};

// Auth — RAW response shape as returned by the backend (nested user object)
export type AuthUserDto = {
  id: Guid; email: string; displayName: string;
  tenantId?: Guid | null; tenantSlug?: string | null;
  roles: string[]; permissions: string[];
};
export type AuthResponse = {
  accessToken: string; accessTokenExpiresAtUtc: DateTimeIso;
  refreshToken: string; refreshTokenExpiresAtUtc: DateTimeIso;
  user: AuthUserDto;
};

// Flat, normalized session shape consumed by the app (derived from AuthResponse)
export type AuthSession = {
  accessToken: string; refreshToken: string;
  userId: Guid; email: string; displayName: string;
  tenantId: Guid | null; tenantSlug: string | null;
  roles: string[]; permissions: string[]; isPlatformAdmin: boolean;
};

// ---------- SMS PLATFORM SERVICE ----------
// 0=Transactional 1=Reminder 2=Campaign 3=Billing
export type SmsTemplateCategory = 0 | 1 | 2 | 3;
// 0=Queued 1=Sent 2=Failed 3=Invoiced
export type SmsUsageStatus = 0 | 1 | 2 | 3;

export type PlatformSmsTemplateDto = {
  id: Guid; code: string; displayName: string; providerTemplateId: number;
  category: SmsTemplateCategory; parameters: string[]; isTenantAvailable: boolean; isActive: boolean;
  assignedTenantCount: number; sentUnitsThisMonth: number;
};

export type SmsUsageRecordDto = {
  id: Guid; tenantId: Guid; tenantName?: string | null; tenantSlug?: string | null;
  templateCode?: string | null; purpose: string; recipient: string; units: number;
  status: SmsUsageStatus; overageUnitPriceRials: number; billableAmountRials: number;
  providerMessageId?: string | null; error?: string | null; occurredAtUtc: DateTimeIso;
};

/** کلید API هرگز از API برنمی‌گردد؛ فقط نقاب و وجود آن. */
export type SmsProviderSettingsDto = {
  provider: string; baseUrl: string; lineNumber?: string | null; isEnabled: boolean;
  hasApiKey: boolean; apiKeyMask?: string | null; lastTestedAtUtc?: DateTimeIso | null;
  lastTestSucceeded?: boolean | null; lastTestMessage?: string | null;
  updatedAtUtc?: DateTimeIso | null;
};

export type SmsDeskStatsDto = {
  activeTemplates: number; tenantAvailableTemplates: number; sentUnits: number; failedUnits: number;
  queuedUnits: number; invoicedUnits: number; billableAmountRials: number; activeTenants: number;
  fromUtc: DateTimeIso; toUtc: DateTimeIso;
};

export type TenantSmsAssignmentDto = {
  templateId: Guid; code: string; displayName: string; category: SmsTemplateCategory;
  isTenantAvailable: boolean; isEnabled: boolean; sentUnitsThisPeriod: number;
};

export type TenantSmsQuotaDto = {
  tenantId: Guid; tenantName: string; tenantSlug: string;
  periodStartUtc: DateTimeIso; periodEndUtc: DateTimeIso;
  includedUnits: number; usedUnits: number; overageUnits: number;
  overageUnitPriceRials: number; overageAmountRials: number;
  templateLimit: number; activeTemplateCount: number;
};

export type MySmsSummaryDto = {
  periodStartUtc: DateTimeIso; periodEndUtc: DateTimeIso; includedUnits: number; usedUnits: number;
  overageUnits: number; overageUnitPriceRials: number; overageAmountRials: number;
  activeTemplateCount: number; templateLimit: number; canSend: boolean;
  blockReason?: string | null; failedUnitsThisPeriod: number;
};

export type MySmsTemplateDto = {
  id: Guid; code: string; displayName: string; category: SmsTemplateCategory;
  parameters: string[]; isEnabled: boolean; sentUnitsThisPeriod: number;
};

export type MySmsUsageDto = {
  id: Guid; templateCode?: string | null; purpose: string; recipient: string; units: number;
  status: SmsUsageStatus; billableAmountRials: number; error?: string | null; occurredAtUtc: DateTimeIso;
};

// ---------- SUPPORT TICKETING ----------
// 0=New 1=InProgress 2=AwaitingCustomer 3=Resolved 4=Closed 5=Cancelled
export type TicketStatus = 0 | 1 | 2 | 3 | 4 | 5;
// 0=Low 1=Normal 2=High 3=Urgent
export type TicketPriority = 0 | 1 | 2 | 3;
// 0=Technical 1=Billing 2=Sms 3=FeatureRequest 4=Training 5=Bug 99=Other
export type TicketCategory = 0 | 1 | 2 | 3 | 4 | 5 | 99;
// 0=Tenant 1=Platform
export type TicketActorSide = 0 | 1;
// 0=Created 1=Message 2=StatusChanged 3=PriorityChanged 4=CategoryChanged
// 5=Assigned 6=Resolved 7=Closed 8=Reopened 9=Rated 10=AttachmentAdded
export type TicketEventType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type TicketAttachmentDto = {
  id: Guid; messageId: Guid | null; fileName: string; path: string; url: string;
  contentType: string; sizeBytes: number; createdAtUtc: DateTimeIso;
};
export type TicketMessageDto = {
  id: Guid; authorUserId: Guid | null; authorName: string; authorSide: TicketActorSide;
  body: string; isInternalNote: boolean; createdAtUtc: DateTimeIso; attachments: TicketAttachmentDto[];
};
export type TicketEventDto = {
  id: Guid; type: TicketEventType; fromValue: string | null; toValue: string | null; note: string | null;
  actorUserId: Guid | null; actorName: string; actorSide: TicketActorSide; occurredAtUtc: DateTimeIso;
};
export type TicketListItemDto = {
  id: Guid; tenantId: Guid; tenantSlug: string | null; tenantName: string | null;
  number: string; subject: string;
  category: TicketCategory; priority: TicketPriority; status: TicketStatus;
  requesterName: string; requesterPhone: string | null;
  assignedToUserId: Guid | null; assignedToName: string | null;
  dueAtUtc: DateTimeIso; isSlaBreached: boolean;
  firstResponseAtUtc: DateTimeIso | null; resolvedAtUtc: DateTimeIso | null; closedAtUtc: DateTimeIso | null;
  lastMessageAtUtc: DateTimeIso; lastMessageSide: TicketActorSide; messageCount: number;
  unreadForTenant: number; unreadForPlatform: number; reopenCount: number;
  satisfactionRating: number | null; createdAtUtc: DateTimeIso;
};
export type TicketDetailDto = {
  ticket: TicketListItemDto;
  relatedEntityType: string | null; relatedEntityId: Guid | null; branchId: Guid | null;
  satisfactionComment: string | null;
  messages: TicketMessageDto[]; events: TicketEventDto[]; attachments: TicketAttachmentDto[];
};
export type TicketSummaryDto = {
  total: number; open: number; awaitingCustomer: number; resolved: number; closed: number;
  unreadForTenant: number; slaBreached: number;
};
export type TicketDeskStatsDto = {
  total: number; new: number; inProgress: number; awaitingCustomer: number; resolved: number; closed: number;
  unassigned: number; slaBreached: number; unansweredByPlatform: number;
  avgFirstResponseHours: number | null; avgResolutionHours: number | null;
  avgSatisfaction: number | null; ratedCount: number;
  byCategory: { category: TicketCategory; count: number }[];
  agentLoad: { userId: Guid; displayName: string; openTickets: number }[];
};
export type SupportAgentDto = { id: Guid; displayName: string; email: string; openTickets: number };
export type TicketAttachmentUpload = {
  fileName: string; path: string; url: string; contentType: string; sizeBytes: number;
};

/** One service's estimate against how long it actually takes. */
export type ServicePunctualityRow = {
  serviceId: Guid; serviceName: string; timesPerformed: number;
  estimatedMinutes: number; averageActualMinutes: number;
  onTimeCount: number; lateCount: number; onTimePercent: number;
  averageOverrunMinutes: number;
};

export type WorkerPunctualityRow = {
  workerId: Guid; fullName: string; orderCount: number;
  onTimeCount: number; onTimePercent: number;
  averageActualMinutes: number; averageOverrunMinutes: number;
};

export type PunctualityReport = {
  completedOrders: number; onTimeOrders: number; onTimePercent: number;
  averageEstimatedMinutes: number; averageActualMinutes: number;
  services: ServicePunctualityRow[];
  workers: WorkerPunctualityRow[];
};

export type WorkerServiceMixRow = { serviceId: Guid; serviceName: string; count: number; totalMinutes: number };

export type WorkerScorecardRow = {
  workerId: Guid; fullName: string; role: string;
  ordersCompleted: number; servicesPerformed: number;
  /** Days the worker closed at least one order — the stand-in for attendance. */
  activeDays: number;
  /** Scaled by ten so one integer keeps a decimal place. */
  ordersPerActiveDayX10: number;
  revenueRials: number; commissionRials: number; tipsRials: number; earningsRials: number;
  averageServiceValueRials: number;
  averageOrderMinutes: number; onTimePercent: number; averageOverrunMinutes: number;
  serviceMix: WorkerServiceMixRow[];
};

export type TeamAverages = {
  ordersCompleted: number; servicesPerformed: number; activeDays: number;
  ordersPerActiveDayX10: number; revenueRials: number; earningsRials: number;
  averageOrderMinutes: number; onTimePercent: number;
};

export type WorkerScorecardReport = {
  workerCount: number; totalOrders: number;
  team: TeamAverages; workers: WorkerScorecardRow[];
};
