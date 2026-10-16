import type { OrderStage as ApiOrderStage } from './api/types';
export type Role = 'admin' | 'user';

export type Worker = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  /** The list already tried to show this; it was never carried across from the API. */
  phone?: string;
  /** Fraction, not percent: 0.1 is a ten percent share. */
  commissionRate: number;
};

export type Service = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  category?: 'wash' | 'wax' | 'detail' | 'extra';
};

export type OrderLineItem = {
  id: string;
  serviceId: string;
  serviceName: string;
  price: number;
  workerId?: string;
  tipAmount: number;
  isFree?: boolean;
};

export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type Order = {
  id: string;
  /** The bay it was last in; empty for a reservation still waiting in the wash queue. */
  bayId?: string;
  customerId?: string;
  customerPlate: string;
  customerPhone?: string;
  lineItems: OrderLineItem[];
  status: OrderStatus;
  /** جایگاه خودرو در چرخه — مستقل از باز یا بسته بودن سفارش. */
  stage: ApiOrderStage;
  /** مانده‌ی پرداخت‌نشده؛ تا صفر نشود تحویل ممکن نیست. */
  outstanding: number;
  /** نوبت خودرو در صف، یا undefined وقتی در صف نیست. */
  queuePosition?: number;
  /** جایگاهی که خودرو همین حالا در آن است؛ خالی یعنی در صف یا منتظر تحویل. */
  currentBayId?: string;
  createdAt: string;
  completedAt?: string;
  isWalkIn: boolean;
  discount: number;
  freeServiceApplied: boolean;
};

export type BayStatus = 'empty' | 'occupied' | 'reserved' | 'maintenance';

export type Bay = {
  id: string;
  name: string;
  status: BayStatus;
  type: 'standard' | 'vip';
  /** What the bay is for (wash, dry, …), as the server records it. */
  kind?: number;
  currentOrderId?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  plate: string;
  totalVisits: number;
  lastVisitDate: string;
  isLoyal: boolean;
  totalSpent: number;
  freeServicesEarned: number;
  freeServicesUsed: number;
};

export type ReservationStatus = 'pending' | 'confirmed' | 'arrived' | 'cancelled';

export type Reservation = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerPlate: string;
  scheduledAt: string;
  serviceIds: string[];
  notes?: string;
  bayId?: string;
  status: ReservationStatus;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  type: 'overdue' | 'reminder' | 'info';
  title: string;
  message: string;
  orderId?: string;
  bayId?: string;
  createdAt: string;
  read: boolean;
};
