// Adapters: backend DTOs → existing frontend types (so legacy pages keep working).
import type {
  BayDto, WorkerDto, ServiceDto, CustomerDto, OrderDto, ReservationDto,
} from './types';
import { BayStatus, OrderStatus, ReservationStatus, ServiceCategory } from './types';
import { API_CONFIG } from './config';
import type { Bay, Worker, Service, Customer, Order, OrderLineItem, Reservation } from '../types';

// Uploaded files (e.g. worker photos) come back as API-relative paths like "/uploads/workers/x".
// A bare relative path would resolve against the *frontend* origin and 404, so anchor it to the
// API host. Absolute URLs and data URIs are passed through untouched.
export const resolveUploadUrl = (url?: string | null): string => {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_CONFIG.baseUrl}/${url.replace(/^\/+/, '')}`;
};

const bayStatusMap: Record<BayStatus, Bay['status']> = {
  [BayStatus.Free]: 'empty',
  [BayStatus.Occupied]: 'occupied',
  [BayStatus.Maintenance]: 'maintenance',
};

const serviceCategoryMap: Record<ServiceCategory, Service['category']> = {
  [ServiceCategory.Main]: 'wash',
  [ServiceCategory.Side]: 'extra',
  [ServiceCategory.Detailing]: 'detail',
  [ServiceCategory.Polish]: 'wax',
  [ServiceCategory.Interior]: 'detail',
  [ServiceCategory.Engine]: 'extra',
};

export const fromBay = (b: BayDto): Bay => ({
  id: b.id, name: b.name,
  status: bayStatusMap[b.status] ?? 'empty',
  type: 'standard',
  kind: b.type,
  currentOrderId: b.currentOrderId ?? undefined,
});

export const fromWorker = (w: WorkerDto): Worker => ({
  id: w.id, name: w.fullName, role: w.role, avatar: resolveUploadUrl(w.avatarUrl),
  phone: w.phone ?? undefined, commissionRate: w.commissionRate,
});

export const fromService = (s: ServiceDto): Service => ({
  id: s.id, name: s.name, price: s.priceRials,
  durationMinutes: s.durationMinutes,
  category: serviceCategoryMap[s.category] ?? 'wash',
});

export const fromCustomer = (c: CustomerDto): Customer => ({
  id: c.id, name: c.fullName, phone: c.phone,
  plate: c.vehicles[0]?.plate ?? '',
  totalVisits: c.totalVisits,
  lastVisitDate: c.lastVisitAtUtc ?? new Date().toISOString(),
  isLoyal: c.totalVisits >= 10,
  totalSpent: c.lifetimeSpendRials,
  freeServicesEarned: Math.floor(c.totalVisits / 3),
  freeServicesUsed: c.freeServicesUsed ?? 0,
});

const orderStatusMap: Record<OrderStatus, Order['status']> = {
  [OrderStatus.InProgress]: 'in_progress',
  [OrderStatus.Completed]: 'completed',
  [OrderStatus.Cancelled]: 'cancelled',
};

export const fromOrder = (o: OrderDto): Order => ({
  id: o.id, bayId: o.bayId ?? undefined,
  customerId: o.customerId ?? undefined,
  customerPlate: o.vehiclePlate,
  customerPhone: o.customerPhone ?? undefined,
  lineItems: o.lines.map<OrderLineItem>(l => ({
    id: l.id, serviceId: l.serviceId, serviceName: l.serviceName,
    // price = مبلغ کل این خط (قیمت واحد × تعداد) تا جمع سفارش با تعداد درست محاسبه شود
    price: l.lineTotalRials ?? (l.unitPriceRials * (l.quantity ?? 1)), tipAmount: l.tipRials ?? 0,
    workerId: l.workerId ?? undefined,
  })),
  status: orderStatusMap[o.status] ?? 'in_progress',
  stage: o.stage,
  queuePosition: o.queuePosition ?? undefined,
  currentBayId: o.currentBayId ?? undefined,
  outstanding: o.outstandingRials ?? Math.max(0, (o.totalRials ?? 0) - (o.paidRials ?? 0)),
  createdAt: o.startedAtUtc,
  completedAt: o.completedAtUtc ?? undefined,
  isWalkIn: o.reservationId == null,
  discount: o.discountRials,
  freeServiceApplied: (o.loyaltyPointsUsed ?? 0) > 0,
});

export const fromReservation = (r: ReservationDto): Reservation => ({
  id: r.id,
  customerName: r.customerName,
  customerPhone: r.customerPhone,
  customerPlate: r.vehiclePlate,
  scheduledAt: r.scheduledAtUtc,
  serviceIds: r.services.map(s => s.serviceId),
  notes: r.notes ?? undefined,
  bayId: r.preferredBayId ?? undefined,
  status: r.status === ReservationStatus.Confirmed ? 'confirmed'
        : r.status === ReservationStatus.Cancelled ? 'cancelled'
        // A customer who never arrived is not a booking we cancelled. Collapsing the two hid
        // exactly the number an owner wants: how often people book and do not turn up.
        : r.status === ReservationStatus.NoShow ? 'no_show'
        : r.status === ReservationStatus.Arrived ? 'arrived'
        : 'pending',
  createdAt: r.createdAtUtc,
});
