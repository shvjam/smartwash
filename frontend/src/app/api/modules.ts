import { api, auth } from './client';
import type {
  AuthResponse, BranchDto, BayDto, WorkerDto, ServiceDto, CustomerDto, CustomerVehicleDto,
  OrderDto, ReservationDto, ExpenseDto, ShiftDto, TenantSettingsDto, NotificationDto, CampaignDto,
  DashboardDto, DailyRevenuePoint, WorkerPerformanceRow, PagedList, Guid,
  OrderStatus, OrderSource, BayStatus, PaymentMethod, ReservationStatus, LoyaltyTier, Gender,
  ServiceCategory, ExpenseCategory, CampaignType, CampaignTarget, CampaignStatus,
  PlanDto, PlanFeatureDto, PlanBillingModel, TenantAdminDto, TenantStatus, CurrentTenantDto,
  SubscriptionDto, SubscriptionStatus, SubscriptionCycle,
  TicketStatus, TicketPriority, TicketCategory, TicketListItemDto, TicketDetailDto,
  TicketSummaryDto, TicketDeskStatsDto, SupportAgentDto, TicketAttachmentUpload,
  SmsTemplateCategory, SmsUsageStatus, PlatformSmsTemplateDto, SmsUsageRecordDto,
  SmsProviderSettingsDto, SmsDeskStatsDto, TenantSmsAssignmentDto, TenantSmsQuotaDto,
  MySmsSummaryDto, MySmsTemplateDto, MySmsUsageDto,
} from './types';

// ---------- AUTH ----------
export const authApi = {
  login: (email: string, password: string, tenantSlug?: string) =>
    api.post<AuthResponse>('/auth/login', { email, password, tenantSlug }, 'public')
      .then(r => auth.setSession(r)),
  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }, 'public')
      .then(r => auth.setSession(r)),
  logout: async (refreshToken: string) => {
    try { await api.post<void>('/auth/logout', { refreshToken }, 'public'); } finally { auth.clear(); }
  },
  registerTenant: (body: {
    displayName: string; slug: string; ownerEmail: string; ownerPhone: string;
    ownerDisplayName: string; ownerPassword: string;
  }) => api.post<AuthResponse>('/auth/register-tenant', body, 'public')
        .then(r => auth.setSession(r)),
  me: () => api.get<{
    userId: Guid; email: string; tenantId: Guid | null;
    roles: string[]; permissions: string[]; isPlatformAdmin: boolean;
  }>('/me', undefined, 'tenant'),
  currentTenant: () => api.get<CurrentTenantDto>('/me/tenant', undefined, 'tenant'),
  forgotPassword: (emailOrPhone: string) =>
    api.post<void>('/auth/forgot-password', { emailOrPhone }, 'public'),
  resetPassword: (emailOrPhone: string, code: string, newPassword: string) =>
    api.post<void>('/auth/reset-password', { emailOrPhone, code, newPassword }, 'public'),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/users/me/change-password', { currentPassword, newPassword }, 'tenant'),
};

// ---------- BILLING (tenant) ----------
export interface InvoiceLineDto { id: Guid; description: string; quantity: number; unitPriceRials: number; lineTotalRials: number; }
export interface TenantInvoiceDto {
  id: Guid; tenantId: Guid; subscriptionId: Guid | null; number: string;
  kind: number; status: number;
  issuedAtUtc: string; dueAtUtc: string; paidAtUtc: string | null;
  subtotalRials: number; taxRials: number; totalRials: number;
  notes: string | null; lines: InvoiceLineDto[];
}
export interface CurrentSubscriptionDto {
  id: Guid; tenantId: Guid; planId: Guid;
  cycle: number; status: SubscriptionStatus;
  startsAtUtc: string; currentPeriodStartUtc: string; currentPeriodEndUtc: string;
  cancelledAtUtc: string | null; graceEndsAtUtc: string | null;
  priceRials: number; autoRenew: boolean;
}
export const billingApi = {
  subscription: () => api.get<CurrentSubscriptionDto | null>('/billing/subscription', undefined, 'tenant'),
  invoices: (status?: number) => api.get<TenantInvoiceDto[]>('/billing/invoices', status !== undefined ? { status } : undefined, 'tenant'),
  subscribe: (planId: Guid, cycle: number) => api.post<CurrentSubscriptionDto>('/billing/subscribe', { planId, cycle }, 'tenant'),
  requestPayment: (invoiceId: Guid, gateway: number, callbackUrl: string) =>
    api.post<{ paymentId: Guid; redirectUrl: string }>('/billing/payments/request', { invoiceId, gateway, callbackUrl }, 'tenant'),
  verifyPayment: (paymentId: Guid, authority: string) =>
    api.post<{ status: number }>('/billing/payments/verify', { paymentId, authority }, 'tenant'),
  cancel: (id: Guid) => api.post<void>(`/billing/subscription/${id}/cancel`, {}, 'tenant'),
};

// ---------- ONBOARDING ----------
export interface OnboardingStateDto {
  step: number;
  isComplete: boolean;
  completedAtUtc: string | null;
  hasBranch: boolean;
  hasBay: boolean;
  hasService: boolean;
}
export const onboardingApi = {
  state: () => api.get<OnboardingStateDto>('/onboarding/state', undefined, 'tenant'),
  completeStep: (step: number) => api.post<void>('/onboarding/complete-step', { step }, 'tenant'),
};

// ---------- FEATURES (Plan gating) ----------
export type FeatureMap = Record<string, string>;
export const featuresApi = {
  list: () => api.get<FeatureMap>('/me/features', undefined, 'tenant'),
};

// ---------- BRANCHES ----------
export const branchesApi = {
  list: (onlyActive = false) => api.get<BranchDto[]>('/branches', { onlyActive }),
  get: (id: Guid) => api.get<BranchDto>(`/branches/${id}`),
  create: (body: { name: string; address?: string | null; phone?: string | null; isDefault: boolean }) =>
    api.post<BranchDto>('/branches', body),
  update: (id: Guid, body: { name: string; address?: string | null; phone?: string | null; latitude?: string | null; longitude?: string | null }) =>
    api.put<BranchDto>(`/branches/${id}`, body),
  setActive: (id: Guid, isActive: boolean) => api.post<void>(`/branches/${id}/active`, { isActive }),
  setDefault: (id: Guid) => api.post<void>(`/branches/${id}/default`),
};

// ---------- BAYS ----------
export const baysApi = {
  list: (branchId?: Guid, onlyActive = false) => api.get<BayDto[]>('/bays', { branchId, onlyActive }),
  create: (body: { branchId: Guid; name: string; number: number }) => api.post<BayDto>('/bays', body),
  update: (id: Guid, body: { name: string; number: number; notes?: string | null }) => api.put<BayDto>(`/bays/${id}`, body),
  maintenance: (id: Guid, notes?: string | null) => api.post<void>(`/bays/${id}/maintenance`, { notes }),
  free: (id: Guid) => api.post<void>(`/bays/${id}/free`),
};

// ---------- WORKERS ----------
export const workersApi = {
  uploadPhoto: async (file: File) => { const data = new FormData(); data.append('file', file); return api.post<{ url: string }>('/workers/upload-photo', data); },
  list: (branchId?: Guid, onlyActive = false) => api.get<WorkerDto[]>('/workers', { branchId, onlyActive }),
  create: (body: { branchId: Guid; fullName: string; role: string; phone?: string | null; commissionRate: number }) =>
    api.post<WorkerDto>('/workers', body),
  update: (id: Guid, body: { fullName: string; role: string; phone?: string | null; nationalId?: string | null; commissionRate: number; avatarUrl?: string | null }) =>
    api.put<WorkerDto>(`/workers/${id}`, body),
  setActive: (id: Guid, isActive: boolean) => api.post<void>(`/workers/${id}/active`, { isActive }),
};

// ---------- SERVICES ----------
export const servicesApi = {
  list: (onlyActive = false, category?: ServiceCategory) => api.get<ServiceDto[]>('/services', { onlyActive, category }),
  create: (body: { name: string; description?: string | null; category: ServiceCategory; priceRials: number; durationMinutes: number; workerCommissionRate: number }) =>
    api.post<ServiceDto>('/services', body),
  update: (id: Guid, body: { name: string; description?: string | null; category: ServiceCategory; priceRials: number; durationMinutes: number; workerCommissionRate: number; sortOrder: number; iconKey?: string | null }) =>
    api.put<ServiceDto>(`/services/${id}`, body),
  setActive: (id: Guid, isActive: boolean) => api.post<void>(`/services/${id}/active`, { isActive }),
};

// ---------- CUSTOMERS ----------
export const customersApi = {
  search: (params: { search?: string; tier?: LoyaltyTier; page?: number; pageSize?: number } = {}) =>
    api.get<PagedList<CustomerDto>>('/customers', { search: params.search, tier: params.tier, page: params.page ?? 1, pageSize: params.pageSize ?? 20 }),
  get: (id: Guid) => api.get<CustomerDto>(`/customers/${id}`),
  create: (body: { fullName: string; phone: string; email?: string | null }) => api.post<CustomerDto>('/customers', body),
  update: (id: Guid, body: { fullName: string; phone: string; email?: string | null; nationalId?: string | null; birthDate?: string | null; gender: Gender; address?: string | null; notes?: string | null }) =>
    api.put<CustomerDto>(`/customers/${id}`, body),
  addVehicle: (id: Guid, body: { plate: string; brand: string; model: string; color?: string | null; year?: number | null }) =>
    api.post<CustomerVehicleDto>(`/customers/${id}/vehicles`, body),
  removeVehicle: (id: Guid, vehicleId: Guid) => api.delete<void>(`/customers/${id}/vehicles/${vehicleId}`),
  adjustWallet: (id: Guid, amountRials: number, description?: string | null) =>
    api.post<number>(`/customers/${id}/wallet/adjust`, { amountRials, description }),
  adjustLoyalty: (id: Guid, points: number, description?: string | null) =>
    api.post<number>(`/customers/${id}/loyalty/adjust`, { points, description }),
  walletTransactions: (id: Guid, page = 1, pageSize = 30) =>
    api.get<PagedList<WalletTxDto>>(`/customers/${id}/wallet/transactions`, { page, pageSize }),
  loyaltyTransactions: (id: Guid, page = 1, pageSize = 30) =>
    api.get<PagedList<LoyaltyTxDto>>(`/customers/${id}/loyalty/transactions`, { page, pageSize }),
  orders: (id: Guid, page = 1, pageSize = 30) =>
    api.get<PagedList<CustomerOrderSummary>>(`/customers/${id}/orders`, { page, pageSize }),
};

export interface WalletTxDto {
  id: Guid; type: number; amountRials: number; balanceAfterRials: number;
  description?: string | null; relatedOrderId?: Guid | null; occurredAtUtc: string;
}
export interface LoyaltyTxDto {
  id: Guid; type: number; points: number; balanceAfter: number;
  description?: string | null; relatedOrderId?: Guid | null; occurredAtUtc: string;
}
export interface CustomerOrderSummary {
  id: Guid; number: string; status: number; totalRials: number;
  createdAtUtc: string; completedAtUtc?: string | null; vehiclePlate: string;
}

// ---------- ORDERS ----------
export type CreateOrderLineInput = { serviceId: Guid; quantity: number; workerId?: Guid | null };
export const ordersApi = {
  search: (params: { branchId?: Guid; status?: OrderStatus; fromUtc?: string; toUtc?: string; search?: string; page?: number; pageSize?: number } = {}) =>
    api.get<PagedList<OrderDto>>('/orders', { ...params, page: params.page ?? 1, pageSize: params.pageSize ?? 20 }),
  get: (id: Guid) => api.get<OrderDto>(`/orders/${id}`),
  create: (body: {
    branchId: Guid; bayId: Guid; customerId?: Guid | null; vehicleId?: Guid | null;
    customerName: string; customerPhone?: string | null; vehiclePlate: string;
    vehicleBrand?: string | null; vehicleModel?: string | null;
    source: OrderSource; reservationId?: Guid | null; lines: CreateOrderLineInput[];
  }) => api.post<OrderDto>('/orders', body),
  addLine: (id: Guid, body: { serviceId: Guid; quantity: number; workerId?: Guid | null }) =>
    api.post<OrderDto>(`/orders/${id}/lines`, body),
  removeLine: (id: Guid, lineId: Guid) => api.delete<OrderDto>(`/orders/${id}/lines/${lineId}`),
  applyDiscount: (id: Guid, discountRials: number) => api.post<OrderDto>(`/orders/${id}/discount`, { discountRials }),
  addPayment: (id: Guid, body: { method: PaymentMethod; amountRials: number; reference?: string | null }) =>
    api.post<OrderDto>(`/orders/${id}/payments`, body),
  complete: (id: Guid, finalMethod: PaymentMethod) => api.post<OrderDto>(`/orders/${id}/complete`, { finalMethod }),
  cancel: (id: Guid, reason?: string | null) => api.post<OrderDto>(`/orders/${id}/cancel`, { reason }),
  // انعام هر لاین به‌صورت مستقل (ذخیره در backend)
  setLineTip: (id: Guid, lineId: Guid, tipRials: number) =>
    api.patch<OrderDto>(`/orders/${id}/lines/${lineId}/tip`, { tipRials }),
  // تخصیص کارگر بدون حذف+بازاضافه (atomic)
  assignLineWorker: (id: Guid, lineId: Guid, workerId: Guid) =>
    api.patch<OrderDto>(`/orders/${id}/lines/${lineId}/worker`, { workerId }),
  // خدمت رایگان وفاداری
  applyLoyaltyFree: (id: Guid) =>
    api.post<OrderDto>(`/orders/${id}/loyalty-free`),
};

// ---------- RESERVATIONS ----------
export const reservationsApi = {
  search: (params: { branchId?: Guid; status?: ReservationStatus; fromUtc?: string; toUtc?: string; page?: number; pageSize?: number } = {}) =>
    api.get<PagedList<ReservationDto>>('/reservations', { ...params, page: params.page ?? 1, pageSize: params.pageSize ?? 20 }),
  get: (id: Guid) => api.get<ReservationDto>(`/reservations/${id}`),
  create: (body: {
    branchId: Guid; customerId?: Guid | null; customerName: string; customerPhone: string;
    vehiclePlate: string; vehicleBrand?: string | null; vehicleModel?: string | null;
    scheduledAtUtc: string; preferredBayId?: Guid | null; notes?: string | null;
    services: { serviceId: Guid }[];
  }) => api.post<ReservationDto>('/reservations', body),
  confirm: (id: Guid) => api.post<void>(`/reservations/${id}/confirm`),
  cancel: (id: Guid, reason?: string | null) => api.post<void>(`/reservations/${id}/cancel`, { reason }),
  noShow: (id: Guid) => api.post<void>(`/reservations/${id}/no-show`),
};

// ---------- EXPENSES ----------
export const expensesApi = {
  search: (params: { branchId?: Guid; category?: ExpenseCategory; fromDate?: string; toDate?: string; page?: number; pageSize?: number } = {}) =>
    api.get<PagedList<ExpenseDto>>('/expenses', { ...params, page: params.page ?? 1, pageSize: params.pageSize ?? 20 }),
  create: (body: { branchId: Guid; category: ExpenseCategory; title: string; amountRials: number; paymentMethod: PaymentMethod; date: string; description?: string | null; relatedWorkerId?: Guid | null }) =>
    api.post<ExpenseDto>('/expenses', body),
  update: (id: Guid, body: { category: ExpenseCategory; title: string; amountRials: number; paymentMethod: PaymentMethod; date: string; description?: string | null }) =>
    api.put<ExpenseDto>(`/expenses/${id}`, body),
  delete: (id: Guid) => api.delete<void>(`/expenses/${id}`),
};

// ---------- SHIFTS ----------
export const shiftsApi = {
  getOpen: (branchId: Guid) => api.get<ShiftDto | null>('/shifts/open', { branchId }),
  open: (branchId: Guid, openingCashRials: number) => api.post<ShiftDto>('/shifts/open', { branchId, openingCashRials }),
  close: (id: Guid, closingCashRials: number, notes?: string | null) =>
    api.post<ShiftDto>(`/shifts/${id}/close`, { closingCashRials, notes }),
};

// ---------- SETTINGS ----------
export const settingsApi = {
  get: () => api.get<TenantSettingsDto>('/settings'),
  branding: (body: { logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null; theme: string }) =>
    api.put<void>('/settings/branding', body),
  loyalty: (body: { enabled: boolean; pointsPerRial: number; pointValue: number; expiryDays: number }) =>
    api.put<void>('/settings/loyalty', body),
  receipt: (body: { header: string; footer?: string | null; invoicePrefix?: string | null }) =>
    api.put<void>('/settings/receipt', body),
  // اتصال پیامک متمرکز است: مستاجر فقط می‌تواند سرویس را روشن/خاموش کند.
  // خط ارسال و سامانه‌ی ارسال را فقط مدیر ارشد پلتفرم تعیین می‌کند.
  sms: (body: { enabled: boolean }) => api.put<void>('/settings/sms', body),
  reservation: (body: { enabled: boolean; leadMinutes: number; maxAdvanceDays: number }) =>
    api.put<void>('/settings/reservation', body),
};

// ---------- NOTIFICATIONS ----------
export const notificationsApi = {
  list: (params: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) =>
    api.get<PagedList<NotificationDto>>('/notifications', { unreadOnly: params.unreadOnly, page: params.page ?? 1, pageSize: params.pageSize ?? 20 }),
  markRead: (id: Guid) => api.post<void>(`/notifications/${id}/read`),
  markAllRead: () => api.post<void>('/notifications/read-all'),
};

// ---------- CAMPAIGNS ----------
export const campaignsApi = {
  list: (status?: CampaignStatus) => api.get<CampaignDto[]>('/campaigns', { status }),
  create: (body: {
    name: string; type: CampaignType; target: CampaignTarget; messageTemplate: string;
    scheduledAtUtc?: string | null; minVisits?: number | null; daysSinceLastVisit?: number | null; minTier?: LoyaltyTier | null;
  }) => api.post<CampaignDto>('/campaigns', body),
  schedule: (id: Guid, scheduledAtUtc: string) => api.post<void>(`/campaigns/${id}/schedule`, { scheduledAtUtc }),
  cancel: (id: Guid) => api.post<void>(`/campaigns/${id}/cancel`),
};

// ---------- PUBLIC PLANS (marketing pricing page) ----------
export const publicPlansApi = {
  list: () => api.get<PlanDto[]>('/plans', undefined, 'public'),
};

// ---------- PLATFORM: PLANS ----------
export const platformPlansApi = {
  list: (params: { onlyActive?: boolean; onlyPublic?: boolean } = {}) =>
    api.get<PlanDto[]>('/plans', params, 'platform'),
  get: (id: Guid) => api.get<PlanDto>(`/plans/${id}`, undefined, 'platform'),
  create: (body: {
    code: string; displayName: string; description?: string | null;
    billingModel: PlanBillingModel; setupFeeRials: number; monthlyPriceRials: number;
    yearlyPriceRials: number; perCarPriceRials: number; sortOrder: number;
    isPublic: boolean; features?: PlanFeatureDto[];
  }) => api.post<PlanDto>('/plans', body, 'platform'),
  update: (id: Guid, body: {
    displayName: string; description?: string | null; setupFeeRials: number;
    monthlyPriceRials: number; yearlyPriceRials: number; perCarPriceRials: number;
    sortOrder: number; isPublic: boolean; features?: PlanFeatureDto[];
  }) => api.put<PlanDto>(`/plans/${id}`, body, 'platform'),
  setActive: (id: Guid, isActive: boolean) =>
    api.post<void>(`/plans/${id}/active`, { isActive }, 'platform'),
};

// ---------- PLATFORM: TENANTS ----------
export type TenantStatsDto = {
  branches: number; bays: number; workers: number; services: number;
  customers: number; orders: number; users: number;
};
export type TenantSubscriptionHistoryDto = {
  id: Guid; planId: Guid; planName: string; cycle: SubscriptionCycle; status: SubscriptionStatus;
  startsAtUtc: string; currentPeriodStartUtc: string; currentPeriodEndUtc: string;
  cancelledAtUtc: string | null; graceEndsAtUtc: string | null;
  priceRials: number; autoRenew: boolean; createdAtUtc: string;
};
export type TenantInvoiceDto = {
  id: Guid; number: string; kind: number; status: number;
  issuedAtUtc: string; dueAtUtc: string; paidAtUtc: string | null;
  subtotalRials: number; taxRials: number; totalRials: number;
};
export type TenantDetailDto = {
  id: Guid; slug: string; displayName: string; ownerEmail: string; ownerPhone: string | null;
  logoUrl: string | null; primaryColor: string | null; status: TenantStatus;
  trialEndsAtUtc: string | null; suspendedAtUtc: string | null; suspendReason: string | null;
  activeSubscriptionId: Guid | null; createdAtUtc: string;
  activePlanId: Guid | null; activePlanName: string | null;
  stats: TenantStatsDto;
  subscriptions: TenantSubscriptionHistoryDto[];
  recentInvoices: TenantInvoiceDto[];
};

export const platformTenantsApi = {
  list: (params: { page?: number; pageSize?: number; search?: string; status?: TenantStatus } = {}) =>
    api.get<PagedList<TenantAdminDto>>('/tenants', {
      page: params.page ?? 1, pageSize: params.pageSize ?? 20,
      search: params.search, status: params.status,
    }, 'platform'),
  get: (id: Guid) => api.get<TenantDetailDto>(`/tenants/${id}`, undefined, 'platform'),
  assignPlan: (id: Guid, body: { planId: Guid; cycle: SubscriptionCycle; activateImmediately: boolean }) =>
    api.post<{ value: Guid } | Guid>(`/tenants/${id}/assign-plan`, body, 'platform'),
};

// ---------- PLATFORM: SUBSCRIPTIONS ----------
export const platformSubscriptionsApi = {
  list: (params: { status?: SubscriptionStatus; tenantId?: Guid; page?: number; pageSize?: number } = {}) =>
    api.get<PagedList<SubscriptionDto>>('/subscriptions', {
      status: params.status, tenantId: params.tenantId,
      page: params.page ?? 1, pageSize: params.pageSize ?? 50,
    }, 'platform'),
  extend: (id: Guid, days: number) => api.post<void>(`/subscriptions/${id}/extend`, { days }, 'platform'),
  cancel: (id: Guid) => api.post<void>(`/subscriptions/${id}/cancel`, undefined, 'platform'),
  suspendTenant: (tenantId: Guid, reason: string) =>
    api.post<void>('/subscriptions/suspend-tenant', { tenantId, reason }, 'platform'),
  reactivateTenant: (tenantId: Guid) =>
    api.post<void>('/subscriptions/reactivate-tenant', { tenantId }, 'platform'),
};

// ---------- PLATFORM: AUDIT LOGS ----------
export type AuditLogDto = {
  id: Guid;
  tenantId: Guid | null;
  tenantSlug: string | null;
  userId: Guid | null;
  userDisplayName: string | null;
  action: string;
  entityName: string;
  entityId: string;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  occurredAtUtc: string;
};

export const platformAuditApi = {
  list: (params: {
    tenantId?: Guid; userId?: Guid; entityName?: string; action?: string;
    fromUtc?: string; toUtc?: string; page?: number; pageSize?: number;
  } = {}) =>
    api.get<PagedList<AuditLogDto>>('/audit-logs', {
      tenantId: params.tenantId, userId: params.userId,
      entityName: params.entityName, action: params.action,
      fromUtc: params.fromUtc, toUtc: params.toUtc,
      page: params.page ?? 1, pageSize: params.pageSize ?? 50,
    }, 'platform'),
};

// ---------- REMINDERS ----------
export type ReminderType = 0 | 1 | 2 | 99;
export type ReminderStatus = 0 | 1 | 2;
export type ReminderDto = {
  id: Guid;
  customerId: Guid;
  customerName: string;
  customerPhone: string;
  vehicleId: Guid | null;
  vehiclePlate: string | null;
  title: string;
  dueAtUtc: string;
  type: ReminderType;
  status: ReminderStatus;
  sentAtUtc: string | null;
  createdAtUtc: string;
};

export const remindersApi = {
  list: (params: { status?: ReminderStatus; customerId?: Guid; page?: number; pageSize?: number } = {}) =>
    api.get<PagedList<ReminderDto>>('/reminders', {
      status: params.status, customerId: params.customerId,
      page: params.page ?? 1, pageSize: params.pageSize ?? 20,
    }),
  create: (body: { customerId: Guid; vehicleId?: Guid | null; title: string; dueAtUtc: string; type: ReminderType }) =>
    api.post<ReminderDto>('/reminders', body),
  cancel: (id: Guid) => api.post<void>(`/reminders/${id}/cancel`, {}),
  // ارسال فوری پیامک یادآور به مشتری
  sendNow: (id: Guid) => api.post<void>(`/reminders/${id}/send`, {}),
};

// ---------- USERS (tenant user management) ----------
export interface TenantUserDto {
  id: Guid; email: string; displayName: string; phone?: string | null;
  isActive: boolean; emailConfirmed: boolean; lastLoginAtUtc?: string | null;
  roles: string[]; createdAtUtc: string;
}
export const usersApi = {
  list: () => api.get<TenantUserDto[]>('/users'),
  invite: (body: { email: string; displayName: string; phone?: string | null; password: string; role: string }) =>
    api.post<TenantUserDto>('/users', body),
  assignRole: (id: Guid, role: string) => api.post<void>(`/users/${id}/roles`, { role }),
  removeRole: (id: Guid, role: string) => api.delete<void>(`/users/${id}/roles/${encodeURIComponent(role)}`),
  setActive: (id: Guid, isActive: boolean) => api.post<void>(`/users/${id}/active`, { isActive }),
  resetPassword: (id: Guid, newPassword: string) => api.post<void>(`/users/${id}/reset-password`, { newPassword }),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/users/me/change-password', { currentPassword, newPassword }),
};

// ---------- REPORTS ----------
export const reportsApi = {
  dashboard: (branchId?: Guid) => api.get<DashboardDto>('/reports/dashboard', { branchId }),
  revenueSeries: (fromDate: string, toDate: string, branchId?: Guid) =>
    api.get<DailyRevenuePoint[]>('/reports/revenue-series', { fromDate, toDate, branchId }),
  workerPerformance: (fromDate: string, toDate: string) =>
    api.get<WorkerPerformanceRow[]>('/reports/worker-performance', { fromDate, toDate }),
};

// ---------- PLATFORM SMS SERVICE ----------
// اتصال تامین‌کننده (settings/*) تنها با مجوز platform.sms.provider در دسترس است.
export const platformSmsApi = {
  templates: (params: { onlyActive?: boolean; onlyTenantAvailable?: boolean } = {}) =>
    api.get<PlatformSmsTemplateDto[]>('/sms/templates', params, 'platform'),
  createTemplate: (body: {
    code: string; displayName: string; providerTemplateId: number;
    category: SmsTemplateCategory; parameters: string[]; isTenantAvailable: boolean;
  }) => api.post<PlatformSmsTemplateDto>('/sms/templates', body, 'platform'),
  updateTemplate: (id: Guid, body: {
    displayName: string; providerTemplateId: number; category: SmsTemplateCategory;
    parameters: string[]; isTenantAvailable: boolean; isActive: boolean;
  }) => api.put<PlatformSmsTemplateDto>(`/sms/templates/${id}`, body, 'platform'),

  tenantTemplates: (tenantId: Guid) =>
    api.get<TenantSmsAssignmentDto[]>(`/sms/tenants/${tenantId}/templates`, undefined, 'platform'),
  setTenantTemplate: (tenantId: Guid, templateId: Guid, enabled: boolean) =>
    api.put<void>(`/sms/tenants/${tenantId}/templates/${templateId}`, { enabled }, 'platform'),
  quotas: () => api.get<TenantSmsQuotaDto[]>('/sms/quotas', undefined, 'platform'),

  usage: (params: {
    tenantId?: Guid; status?: SmsUsageStatus; templateId?: Guid;
    fromUtc?: string; toUtc?: string; search?: string; page?: number; pageSize?: number;
  } = {}) => api.get<PagedList<SmsUsageRecordDto>>('/sms/usage', {
    ...params, page: params.page ?? 1, pageSize: params.pageSize ?? 50,
  }, 'platform'),
  stats: (params: { fromUtc?: string; toUtc?: string } = {}) =>
    api.get<SmsDeskStatsDto>('/sms/stats', params, 'platform'),

  settings: () => api.get<SmsProviderSettingsDto>('/sms/settings', undefined, 'platform'),
  updateSettings: (body: {
    provider: string; baseUrl: string; apiKey?: string | null; lineNumber?: string | null; isEnabled: boolean;
  }) => api.put<SmsProviderSettingsDto>('/sms/settings', body, 'platform'),
  clearApiKey: () => api.delete<SmsProviderSettingsDto>('/sms/settings/api-key', 'platform'),
  sendTest: (recipient: string, body?: string) =>
    api.post<SmsProviderSettingsDto>('/sms/settings/test', { recipient, body }, 'platform'),
};

// ---------- SMS (tenant) ----------
export const tenantSmsApi = {
  summary: () => api.get<MySmsSummaryDto>('/sms/summary'),
  templates: () => api.get<MySmsTemplateDto[]>('/sms/templates'),
  setTemplate: (templateId: Guid, enabled: boolean) => api.put<void>(`/sms/templates/${templateId}`, { enabled }),
  usage: (params: { status?: SmsUsageStatus; page?: number; pageSize?: number } = {}) =>
    api.get<PagedList<MySmsUsageDto>>('/sms/usage', {
      status: params.status, page: params.page ?? 1, pageSize: params.pageSize ?? 25,
    }),
};

// ---------- SUPPORT TICKETS (tenant) ----------
export const ticketsApi = {
  list: (params: {
    status?: TicketStatus; category?: TicketCategory; priority?: TicketPriority;
    openOnly?: boolean; search?: string; page?: number; pageSize?: number;
  } = {}) => api.get<PagedList<TicketListItemDto>>('/tickets', {
    status: params.status, category: params.category, priority: params.priority,
    openOnly: params.openOnly, search: params.search,
    page: params.page ?? 1, pageSize: params.pageSize ?? 20,
  }),
  summary: () => api.get<TicketSummaryDto>('/tickets/summary'),
  get: (id: Guid) => api.get<TicketDetailDto>(`/tickets/${id}`),
  create: (body: {
    subject: string; description: string; category: TicketCategory; priority: TicketPriority;
    branchId?: Guid | null; relatedEntityType?: string | null; relatedEntityId?: Guid | null;
    attachments?: TicketAttachmentUpload[];
  }) => api.post<TicketDetailDto>('/tickets', body),
  addMessage: (id: Guid, body: string, attachments?: TicketAttachmentUpload[]) =>
    api.post<TicketDetailDto>(`/tickets/${id}/messages`, { body, attachments }),
  close: (id: Guid, reason?: string | null) => api.post<void>(`/tickets/${id}/close`, { reason }),
  reopen: (id: Guid, reason?: string | null) => api.post<void>(`/tickets/${id}/reopen`, { reason }),
  rate: (id: Guid, rating: number, comment?: string | null) =>
    api.post<void>(`/tickets/${id}/rate`, { rating, comment }),
  uploadAttachment: async (file: File) => {
    const data = new FormData();
    data.append('file', file);
    return api.post<TicketAttachmentUpload>('/tickets/attachments', data);
  },
};

// ---------- PLATFORM: SUPPORT DESK ----------
export const platformTicketsApi = {
  list: (params: {
    tenantId?: Guid; status?: TicketStatus; category?: TicketCategory; priority?: TicketPriority;
    assignedToUserId?: Guid; unassignedOnly?: boolean; openOnly?: boolean;
    slaBreachedOnly?: boolean; unansweredOnly?: boolean;
    search?: string; page?: number; pageSize?: number;
  } = {}) => api.get<PagedList<TicketListItemDto>>('/tickets', {
    tenantId: params.tenantId, status: params.status, category: params.category, priority: params.priority,
    assignedToUserId: params.assignedToUserId, unassignedOnly: params.unassignedOnly,
    openOnly: params.openOnly, slaBreachedOnly: params.slaBreachedOnly, unansweredOnly: params.unansweredOnly,
    search: params.search, page: params.page ?? 1, pageSize: params.pageSize ?? 25,
  }, 'platform'),
  stats: (params: { tenantId?: Guid; fromUtc?: string; toUtc?: string } = {}) =>
    api.get<TicketDeskStatsDto>('/tickets/stats', params, 'platform'),
  agents: () => api.get<SupportAgentDto[]>('/tickets/agents', undefined, 'platform'),
  get: (id: Guid) => api.get<TicketDetailDto>(`/tickets/${id}`, undefined, 'platform'),
  reply: (id: Guid, body: string, isInternalNote = false, attachments?: TicketAttachmentUpload[]) =>
    api.post<TicketDetailDto>(`/tickets/${id}/reply`, { body, isInternalNote, attachments }, 'platform'),
  setStatus: (id: Guid, status: TicketStatus, note?: string | null) =>
    api.post<void>(`/tickets/${id}/status`, { status, note }, 'platform'),
  setPriority: (id: Guid, priority: TicketPriority) =>
    api.post<void>(`/tickets/${id}/priority`, { priority }, 'platform'),
  setCategory: (id: Guid, category: TicketCategory) =>
    api.post<void>(`/tickets/${id}/category`, { category }, 'platform'),
  assign: (id: Guid, assignedToUserId: Guid | null) =>
    api.post<void>(`/tickets/${id}/assign`, { assignedToUserId }, 'platform'),
};
