import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { Bay, Order, Worker, Service, Customer, Role, Reservation, AppNotification } from './types';
import {
  auth, authApi, branchesApi, baysApi, workersApi, servicesApi, customersApi,
  ordersApi, reservationsApi, notificationsApi, remindersApi,
  ApiException, tenantSlug, type Guid,
} from './api';
import { OrderSource, PaymentMethod, BayStatus as ApiBayStatus, NotificationType, ReservationStatus as ApiResvStatus } from './api/types';
import { fromBay, fromWorker, fromService, fromCustomer, fromOrder, fromReservation } from './api/adapters';
import { toast } from 'sonner';

type AuthUser = {
  username: string; role: Role; name: string;
  userId: string; tenantId: string | null; permissions: string[]; isPlatformAdmin: boolean;
} | null;

type CarWashContextType = {
  user: AuthUser;
  login: (email: string, password: string, tenantSlug: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  role: Role;
  setRole: (role: Role) => void;
  ready: boolean;
  reloadAll: () => Promise<void>;
  branches: { id: string; name: string; isDefault: boolean }[];
  switchBranch: (id: string) => Promise<void>;

  branchId: Guid | null;
  bays: Bay[];
  workers: Worker[];
  services: Service[];
  orders: Order[];
  customers: Customer[];
  reservations: Reservation[];
  notifications: AppNotification[];
  unreadCount: number;

  addWorker: (w: { fullName: string; role: string; phone?: string; commissionRate?: number; avatarUrl?: string }) => Promise<void>;
  removeWorker: (id: string) => Promise<void>;
  addService: (s: { name: string; price: number; durationMinutes: number; category?: Service['category'] }) => Promise<void>;
  removeService: (id: string) => Promise<void>;
  addCustomer: (c: { name: string; phone: string; plate?: string }) => Promise<Customer>;
  sendCustomerMessage: (customerId: string, message: string) => Promise<void>;

  createOrder: (bayId: string, plate: string, phone: string, isWalkIn: boolean, customerName?: string) => Promise<string | undefined>;
  addLineItem: (orderId: string, serviceId: string) => Promise<void>;
  removeLineItem: (orderId: string, lineId: string) => Promise<void>;
  assignLineWorker: (orderId: string, lineId: string, workerId: string) => Promise<void>;
  setLineTip: (orderId: string, lineId: string, tip: number) => Promise<void>;
  setOrderDiscount: (orderId: string, discount: number) => Promise<void>;
  applyFreeService: (orderId: string) => Promise<void>;
  finishOrder: (orderId: string, method?: PaymentMethod) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  activeOrderForBay: (bayId: string) => Order | undefined;
  getOrderTotals: (order: Order) => { subtotal: number; tips: number; discount: number; freeDiscount: number; total: number };
  customerByPhone: (phone: string) => Customer | undefined;
  customerForOrder: (order: Order) => Customer | undefined;
  loyaltyProgress: (c: Customer) => { progress: number; available: boolean };

  addReservation: (r: { customerName: string; customerPhone: string; customerPlate: string; scheduledAt: string; serviceIds: string[]; notes?: string; bayId?: string }) => Promise<string | undefined>;
  cancelReservation: (id: string) => Promise<void>;
  arriveReservation: (id: string) => Promise<string | undefined>;

  markAllRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  expectedDurationFor: (order: Order) => number;
};

const CarWashContext = createContext<CarWashContextType | undefined>(undefined);

const rolesToRole = (roles: string[], isPlatformAdmin: boolean): Role => {
  if (isPlatformAdmin) return 'admin';
  if (roles.some(r => r === 'tenant:owner' || r === 'tenant:manager' || r === 'tenant:accountant')) return 'admin';
  return 'user';
};

export const CarWashProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser>(() => {
    const u = auth.getUser();
    if (!u) return null;
    return {
      username: u.email, role: rolesToRole(u.roles || [], u.isPlatformAdmin),
      name: u.displayName || u.email, userId: u.userId,
      tenantId: u.tenantId, permissions: u.permissions || [], isPlatformAdmin: !!u.isPlatformAdmin,
    };
  });
  const [role, setRoleState] = useState<Role>(user?.role ?? 'admin');
  const [ready, setReady] = useState(false);

  const [branchId, setBranchId] = useState<Guid | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // ephemeral UI-only state (tips & free service) kept in client memory keyed by orderId/lineId
  const tipsRef = useRef<Record<string, Record<string, number>>>({});
  const freeAppliedRef = useRef<Record<string, string>>({}); // orderId -> lineId

  // Per-order write queue: every mutation on a given order runs strictly after the previous one
  // finishes. Firing them in parallel (rapid service clicks, per-keystroke tip/discount) races on
  // the order's optimistic-concurrency RowVersion and throws DbUpdateConcurrencyException. Serializing
  // per order removes the race entirely at the source.
  const orderOps = useRef<Record<string, Promise<unknown>>>({});
  const enqueueOrderOp = <T,>(orderId: string, op: () => Promise<T>): Promise<T> => {
    const prev = orderOps.current[orderId] ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(op);
    // Keep the tail resolved even on failure so one error doesn't stall the queue forever.
    orderOps.current[orderId] = run.catch(() => undefined);
    return run;
  };

  const loadAll = useCallback(async () => {
    if (!auth.access()) { setReady(true); return; }
    try {
      const branchList = await branchesApi.list(true);
      setBranches(branchList.map(b => ({ id: b.id, name: b.name, isDefault: b.isDefault })));
      const defaultBranch = branchList.find(b => b.isDefault) || branchList[0];
      const bId = defaultBranch?.id ?? null;
      setBranchId(bId);

      const [bs, ws, ss, cs, os, rs, ns] = await Promise.all([
        baysApi.list(bId ?? undefined, false),
        workersApi.list(bId ?? undefined, true),
        servicesApi.list(true),
        customersApi.search({ pageSize: 200 }),
        ordersApi.search({ branchId: bId ?? undefined, pageSize: 200 }),
        reservationsApi.search({ branchId: bId ?? undefined, pageSize: 200 }),
        notificationsApi.list({ pageSize: 50 }),
      ]);
      setBays(bs.map(fromBay));
      setWorkers(ws.map(fromWorker));
      setServices(ss.map(fromService));
      setCustomers(cs.items.map(fromCustomer));
      setOrders(os.items.map(fromOrder));
      setReservations(rs.items.map(fromReservation));
      setNotifications(ns.items.map(n => ({
        id: n.id,
        type: n.type === NotificationType.ReservationReminder ? 'reminder'
            : (n.type === NotificationType.OrderOverdue || n.type === NotificationType.BillingDue) ? 'overdue'
            : 'info',
        title: n.title, message: n.body,
        orderId: n.entityType === 'Order' ? (n.entityId ?? undefined) : undefined,
        bayId: undefined,
        createdAt: n.createdAtUtc, read: n.isRead,
      })));
    } catch (e) {
      if (e instanceof ApiException && (e.status === 401 || e.status === 403)) auth.clear();
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll, user?.userId]);

  // مجوزها در توکن ورود ثبت می‌شوند؛ اگر پلتفرم مجوز تازه‌ای به نقش کاربر بدهد
  // (مثل پشتیبانی یا سرویس پیامک) بدون این تازه‌سازی تا ورود بعدی دیده نمی‌شود.
  useEffect(() => {
    if (!auth.access() || !user?.userId) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await authApi.me();
        if (cancelled) return;
        const next = (me.permissions ?? []).join(',');
        if (next === (user.permissions ?? []).join(',')) return;
        auth.mergeUser({
          roles: me.roles ?? [], permissions: me.permissions ?? [],
          isPlatformAdmin: !!me.isPlatformAdmin, tenantId: me.tenantId ?? null,
        });
        setUser(u => (u ? { ...u, permissions: me.permissions ?? [], isPlatformAdmin: !!me.isPlatformAdmin } : u));
      } catch { /* تازه‌سازی مجوزها اختیاری است و نباید بارگذاری برنامه را متوقف کند */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  // Polling هر ۳۰ ثانیه — فقط جایگاه‌ها، سفارش‌های فعال و اعلان‌ها refresh می‌شن
  useEffect(() => {
    if (!user || user.isPlatformAdmin) return;
    const POLL_MS = 30_000;
    const id = setInterval(async () => {
      if (!auth.access()) return;
      try {
        const [bs, os, ns] = await Promise.all([
          baysApi.list(branchId ?? undefined, false),
          ordersApi.search({ branchId: branchId ?? undefined, pageSize: 200 }),
          notificationsApi.list({ pageSize: 50 }),
        ]);
        setBays(bs.map(fromBay));
        setOrders(os.items.map(fromOrder));
        setNotifications(ns.items.map(n => ({
          id: n.id,
          type: n.type === NotificationType.ReservationReminder ? 'reminder'
            : (n.type === NotificationType.OrderOverdue || n.type === NotificationType.BillingDue) ? 'overdue'
            : 'info',
          title: n.title, message: n.body,
          orderId: n.entityType === 'Order' ? (n.entityId ?? undefined) : undefined,
          bayId: undefined,
          createdAt: n.createdAtUtc, read: n.isRead,
        })));
      } catch { /* اگر شبکه قطع بود، نادیده بگیر */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [user, branchId]);

  const login: CarWashContextType['login'] = async (email, password, slug) => {
    try {
      // A platform login must clear any prior tenant context; keeping an old
      // slug here sends later tenant requests to the wrong path.
      if (slug) tenantSlug.set(slug);
      else tenantSlug.clear();
      const r = await authApi.login(email, password, slug || undefined);
      const role = rolesToRole(r.roles, r.isPlatformAdmin);
      setUser({
        username: r.email, role, name: r.displayName || r.email,
        userId: r.userId, tenantId: r.tenantId ?? null,
        permissions: r.permissions, isPlatformAdmin: r.isPlatformAdmin,
      });
      setRoleState(role);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : 'خطا در ارتباط با سرور';
      return { ok: false, error: msg };
    }
  };

  const logout = async () => {
    const rt = auth.refresh();
    try { if (rt) await authApi.logout(rt); } catch { /* ignore */ }
    auth.clear();
    setUser(null);
    setBays([]); setWorkers([]); setServices([]); setOrders([]); setCustomers([]); setReservations([]); setNotifications([]);
  };

  const setRole = (r: Role) => { setRoleState(r); if (user) setUser({ ...user, role: r }); };

  const switchBranch = async (id: string) => {
    setBranchId(id);
    // reload data for new branch
    try {
      const [bs, ws, os, rs] = await Promise.all([
        baysApi.list(id, false),
        workersApi.list(id, true),
        ordersApi.search({ branchId: id, pageSize: 200 }),
        reservationsApi.search({ branchId: id, pageSize: 200 }),
      ]);
      setBays(bs.map(fromBay));
      setWorkers(ws.map(fromWorker));
      setOrders(os.items.map(fromOrder));
      setReservations(rs.items.map(fromReservation));
    } catch { /* ignore */ }
  };

  // ----- Workers -----
  const addWorker: CarWashContextType['addWorker'] = async (w) => {
    if (!branchId) return;
    const created = await workersApi.create({
      branchId, fullName: w.fullName, role: w.role,
      phone: w.phone, commissionRate: w.commissionRate ?? 0.1,
    });
    // The photo is attached with a follow-up update; use its result (which carries avatarUrl)
    // so the new worker renders with the uploaded avatar instead of the pre-upload record.
    const saved = w.avatarUrl
      ? await workersApi.update(created.id, { fullName: created.fullName, role: created.role, phone: created.phone, commissionRate: created.commissionRate, avatarUrl: w.avatarUrl })
      : created;
    setWorkers(prev => [...prev, fromWorker(saved)]);
  };
  const removeWorker = async (id: string) => {
    await workersApi.setActive(id, false);
    setWorkers(prev => prev.filter(w => w.id !== id));
  };

  // ----- Services -----
  const addService: CarWashContextType['addService'] = async (s) => {
    const created = await servicesApi.create({
      name: s.name, priceRials: s.price, durationMinutes: s.durationMinutes,
      category: 0, workerCommissionRate: 0.1,
    });
    setServices(prev => [...prev, fromService(created)]);
  };
  const removeService = async (id: string) => {
    await servicesApi.setActive(id, false);
    setServices(prev => prev.filter(s => s.id !== id));
  };

  // ----- Customers -----
  const addCustomer: CarWashContextType['addCustomer'] = async (c) => {
    const created = await customersApi.create({ fullName: c.name, phone: c.phone });
    const mapped: Customer = fromCustomer(created);
    if (c.plate) mapped.plate = c.plate;
    setCustomers(prev => [...prev, mapped]);
    return mapped;
  };
  // ارسال پیام دلخواه به مشتری: یک یادآورِ «سفارشی» با متنِ پیام می‌سازد و بلافاصله ارسال می‌کند.
  const sendCustomerMessage = async (customerId: string, message: string) => {
    const reminder = await remindersApi.create({
      customerId, title: message.trim(), dueAtUtc: new Date().toISOString(), type: 99,
    });
    await remindersApi.sendNow(reminder.id);
  };

  const customerByPhone = (phone: string) => customers.find(c => c.phone === phone);
  const customerForOrder = (o: Order) =>
    o.customerId ? customers.find(c => c.id === o.customerId)
      : (o.customerPhone ? customers.find(c => c.phone === o.customerPhone) : undefined);

  const loyaltyProgress = (c: Customer) => {
    const earnedNow = Math.floor(c.totalVisits / 3);
    const progress = c.totalVisits % 3;
    const available = earnedNow > c.freeServicesUsed;
    return { progress, available };
  };

  // ----- Orders -----
  const createOrder: CarWashContextType['createOrder'] = async (bayId, plate, phone, isWalkIn, customerName) => {
    if (!branchId) return undefined;
    // اول از state محلی جستجو می‌کنیم (سریع‌تر)
    let customer = phone ? customerByPhone(phone) : undefined;
    // اگر پیدا نشد، از API جستجو می‌کنیم — از محدودیت 200 مشتری جلوگیری می‌شه
    if (!customer && phone) {
      try {
        const result = await customersApi.search({ search: phone, pageSize: 1 });
        if (result.items.length > 0) {
          customer = fromCustomer(result.items[0]);
          // مشتری پیداشده رو به state محلی اضافه می‌کنیم
          setCustomers(prev => prev.find(c => c.id === customer!.id) ? prev : [...prev, customer!]);
        }
      } catch { /* اگر جستجو fail شد، ادامه می‌دیم */ }
    }
    // The name the operator typed is what gets stored. Falling back to a constant here is
    // what put "مشتری جدید" on every new record and into the SMS that greets them.
    const typedName = customerName?.trim();
    if (!customer && phone) customer = await addCustomer({ name: typedName || 'مشتری', phone, plate });
    // An existing customer who was saved under the placeholder gets their real name now.
    else if (customer && typedName && customer.name !== typedName && customer.name === 'مشتری جدید') {
      try {
        await customersApi.update(customer.id, { fullName: typedName, phone: customer.phone });
        customer = { ...customer, name: typedName };
        setCustomers(prev => prev.map(c => (c.id === customer!.id ? customer! : c)));
      } catch { /* naming is a convenience; never block the order on it */ }
    }
    const created = await ordersApi.create({
      branchId, bayId, customerId: customer?.id ?? null,
      customerName: typedName || customer?.name || 'مشتری',
      customerPhone: phone || null,
      vehiclePlate: plate, source: isWalkIn ? OrderSource.WalkIn : OrderSource.Reservation,
      lines: [],
    });
    setOrders(prev => [fromOrder(created), ...prev]);
    setBays(prev => prev.map(b => b.id === bayId
      ? { ...b, status: isWalkIn ? 'occupied' : 'reserved', currentOrderId: created.id }
      : b));
    return created.id;
  };

  const addLineItem = async (orderId: string, serviceId: string) => {
    try {
      await enqueueOrderOp(orderId, async () => {
        const updated = await ordersApi.addLine(orderId, { serviceId, quantity: 1 });
        setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));
      });
    } catch (error) {
      // This action originates from a plain button click. Without handling the rejected
      // promise here, a backend error (notably a 409 caused by an invalid Orders.RowVersion
      // column) leaves the modal visually unchanged and looks like a dead button.
      const message = error instanceof ApiException
        ? error.message
        : 'افزودن خدمت انجام نشد. اتصال به سرور را بررسی کنید.';
      toast.error(message);
    }
  };
  const removeLineItem = (orderId: string, lineId: string) => enqueueOrderOp(orderId, async () => {
    const updated = await ordersApi.removeLine(orderId, lineId);
    setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));
  });
  const assignLineWorker = (orderId: string, lineId: string, workerId: string) => enqueueOrderOp(orderId, async () => {
    // از endpoint اختصاصی PATCH استفاده می‌کنیم — بدون حذف و بازاضافه
    const updated = await ordersApi.assignLineWorker(orderId, lineId, workerId);
    setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));
  });
  const setLineTip = async (orderId: string, lineId: string, tip: number) => {
    const normalizedTip = Math.max(0, tip);
    // ذخیره optimistic در UI
    setOrders(prev => prev.map(o => o.id === orderId
      ? { ...o, lineItems: o.lineItems.map(l => l.id === lineId ? { ...l, tipAmount: normalizedTip } : l) }
      : o));
    // ارسال به backend (سریالی، تا با سایر تغییرات همان سفارش تداخل نکند)
    try {
      const updated = await enqueueOrderOp(orderId, () => ordersApi.setLineTip(orderId, lineId, normalizedTip));
      setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));
    } catch {
      // اگر backend خطا داد، state رو revert می‌کنیم
      setOrders(prev => prev.map(o => o.id === orderId
        ? { ...o, lineItems: o.lineItems.map(l => l.id === lineId ? { ...l, tipAmount: 0 } : l) }
        : o));
    }
  };
  const setOrderDiscount = (orderId: string, discount: number) => enqueueOrderOp(orderId, async () => {
    const updated = await ordersApi.applyDiscount(orderId, Math.max(0, discount));
    setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));
  });
  const applyFreeService = (orderId: string) => enqueueOrderOp(orderId, async () => {
    // ارسال به backend — backend بررسی واجد شرط بودن مشتری رو هم انجام می‌ده
    const updated = await ordersApi.applyLoyaltyFree(orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));
  });

  const getOrderTotals = (o: Order) => {
    const subtotal = o.lineItems.reduce((s, l) => s + l.price, 0);
    const freeDiscount = o.lineItems.filter(l => l.isFree).reduce((s, l) => s + l.price, 0);
    const tips = o.lineItems.reduce((s, l) => s + l.tipAmount, 0);
    const discount = o.discount;
    const total = Math.max(0, subtotal - freeDiscount - discount) + tips;
    return { subtotal, tips, discount, freeDiscount, total };
  };

  const finishOrder = (orderId: string, method: PaymentMethod = PaymentMethod.Cash) => enqueueOrderOp(orderId, async () => {
    // method: Cash=0, Card=1, Online=2, Wallet=3 — پیش‌فرض نقد. صف تضمین می‌کند تسویه بعد از آخرین تغییر انجام شود.
    const updated = await ordersApi.complete(orderId, method);
    setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));
    setBays(prev => prev.map(b => b.currentOrderId === orderId ? { ...b, status: 'empty', currentOrderId: undefined } : b));
  });
  const cancelOrder = (orderId: string) => enqueueOrderOp(orderId, async () => {
    const updated = await ordersApi.cancel(orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));
    setBays(prev => prev.map(b => b.currentOrderId === orderId ? { ...b, status: 'empty', currentOrderId: undefined } : b));
  });

  const expectedDurationFor = (order: Order) =>
    order.lineItems.reduce((sum, l) => {
      const s = services.find(x => x.id === l.serviceId);
      return sum + (s?.durationMinutes ?? 30);
    }, 0);

  const activeOrderForBay = (bayId: string) => {
    const bay = bays.find(b => b.id === bayId);
    if (!bay || !bay.currentOrderId) return undefined;
    return orders.find(o => o.id === bay.currentOrderId);
  };

  // ----- Reservations -----
  const addReservation: CarWashContextType['addReservation'] = async (r) => {
    if (!branchId) return undefined;
    const created = await reservationsApi.create({
      branchId, customerName: r.customerName, customerPhone: r.customerPhone,
      vehiclePlate: r.customerPlate, scheduledAtUtc: new Date(r.scheduledAt).toISOString(),
      preferredBayId: r.bayId ?? null, notes: r.notes ?? null,
      services: r.serviceIds.map(serviceId => ({ serviceId })),
    });
    setReservations(prev => [...prev, fromReservation(created)]);
    return created.id;
  };
  const cancelReservation = async (id: string) => {
    await reservationsApi.cancel(id);
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
  };
  const arriveReservation = async (id: string) => {
    const r = reservations.find(x => x.id === id);
    if (!r) return undefined;

    // رزرو باید حداقل confirmed باشد — اگر هنوز pending است، اول confirm می‌کنیم
    if (r.status === 'pending') {
      await reservationsApi.confirm(id);
      setReservations(prev => prev.map(x => x.id === id ? { ...x, status: 'confirmed' } : x));
    }

    const targetBay = (r.bayId && bays.find(b => b.id === r.bayId && b.status === 'empty')) || bays.find(b => b.status === 'empty');
    if (!targetBay || !branchId) return undefined;
    let customer = customerByPhone(r.customerPhone);
    if (!customer) customer = await addCustomer({ name: r.customerName, phone: r.customerPhone, plate: r.customerPlate });
    const created = await ordersApi.create({
      branchId, bayId: targetBay.id, customerId: customer.id,
      customerName: customer.name, customerPhone: customer.phone,
      vehiclePlate: r.customerPlate, source: OrderSource.Reservation, reservationId: r.id,
      lines: r.serviceIds.map(serviceId => ({ serviceId, quantity: 1 })),
    });
    setOrders(prev => [fromOrder(created), ...prev]);
    setBays(prev => prev.map(b => b.id === targetBay.id ? { ...b, status: 'occupied', currentOrderId: created.id } : b));
    setReservations(prev => prev.map(x => x.id === id ? { ...x, status: 'arrived', bayId: targetBay.id } : x));
    return created.id;
  };

  // ----- Notifications -----
  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  const dismissNotification = async (id: string) => {
    try { await notificationsApi.markRead(id); } catch { /* ignore */ }
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <CarWashContext.Provider value={{
      user, login, logout, role, setRole, ready, reloadAll: loadAll,
      branchId, branches, switchBranch,
      bays, workers, services, orders, customers, reservations, notifications, unreadCount,
      addWorker, removeWorker, addService, removeService, addCustomer, sendCustomerMessage,
      createOrder, addLineItem, removeLineItem, assignLineWorker, setLineTip,
      setOrderDiscount, applyFreeService, finishOrder, cancelOrder,
      activeOrderForBay, getOrderTotals, customerByPhone, customerForOrder, loyaltyProgress,
      addReservation, cancelReservation, arriveReservation,
      markAllRead, dismissNotification, expectedDurationFor,
    }}>
      {children}
    </CarWashContext.Provider>
  );
};

export const useCarWash = () => {
  const ctx = useContext(CarWashContext);
  if (!ctx) throw new Error('useCarWash must be used within CarWashProvider');
  return ctx;
};
