export type Role = 'admin' | 'user';

export type Worker = {
  id: string;
  name: string;
  avatar: string;
  role: string;
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
  bayId: string;
  customerId?: string;
  customerPlate: string;
  customerPhone?: string;
  lineItems: OrderLineItem[];
  status: OrderStatus;
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
