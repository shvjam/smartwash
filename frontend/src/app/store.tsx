import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bay, Order, Worker, Service, Customer, Role, Reservation, AppNotification } from './types';
import {
  auth, authApi, branchesApi, baysApi, workersApi, servicesApi, customersApi,
  ordersApi, reservationsApi, notificationsApi, remindersApi,
  ApiException, tenantSlug, type Guid,
} from './api';
import { OrderSource, PaymentMethod, BayStatus as ApiBayStatus, NotificationType, ReservationStatus as ApiResvStatus } from './api/types';
import { fromBay, fromWorker, fromService, fromCustomer, fromOrder, fromReservation } from './api/adapters';
import { toast } from 'sonner';
import { normalizePlate, ensureCustomerAndVehicle } from './lib/customerRecords';

/** Bays a wash can start in; matches the server's rule for the washing step. */
const WASH_BAY_TYPES: number[] = [BayType.Wash, BayType.EngineWash, BayType.Special];
import { OrderStage, Gender, BayType, type OrderDto } from './api/types';

const STAGE_DONE: Record<OrderStage, string> = {
  [OrderStage.Received]: 'خودرو پذیرش شد',
  [OrderStage.QueuedForWash]: 'خودرو به صف شستشو رفت',
  [OrderStage.Washing]: 'شستشو شروع شد',
  [OrderStage.QueuedForDry]: 'شستشو تمام شد؛ خودرو در صف خشک است',
  [OrderStage.Drying]: 'خشک‌کردن شروع شد',
  [OrderStage.OptionServices]: 'خدمات آپشن شروع شد',
  [OrderStage.ReadyForPickup]: 'خودرو آماده‌ی تحویل است',
  [OrderStage.Delivered]: 'خودرو تحویل داده شد',
};

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
  addLineItem: (orderId: string, serviceId: string) => Promise<boolean>;
  removeLineItem: (orderId: string, lineId: string) => Promise<boolean>;
  assignLineWorker: (orderId: string, lineId: string, workerId: string) => Promise<boolean>;
  setLineTip: (orderId: string, lineId: string, tip: number) => Promise<boolean>;
  setOrderDiscount: (orderId: string, discount: number) => Promise<boolean>;
  applyFreeService: (orderId: string) => Promise<boolean>;
  finishOrder: (orderId: string, method?: PaymentMethod) => Promise<boolean>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  advanceOrderStage: (orderId: string, stage: OrderStage, bayId?: string | null) => Promise<boolean>;
  activeOrderForBay: (bayId: string) => Order | undefined;
  orderById: (orderId: string) => Order | undefined;
  /** Cars in progress that are not in any bay: waiting in a line, or ready to be collected. */
  waitingOrders: Order[];
  getOrderTotals: (order: Order) => { subtotal: number; tips: number; discount: number; freeDiscount: number; total: number };
  customerByPhone: (phone: string) => Customer | undefined;
  customerForOrder: (order: Order) => Customer | undefined;
  loyaltyProgress: (c: Customer) => { progress: number; available: boolean };

  addReservation: (r: { customerName: string; customerPhone: string; customerPlate: string; scheduledAt: string; serviceIds: string[]; notes?: string; bayId?: string }) => Promise<string | undefined>;
  cancelReservation: (id: string) => Promise<void>;
  /** Checks a reservation in: into a free wash bay, or into the wash queue when none is free. */
  arriveReservation: (id: string) => Promise<{ orderId: string; queuePosition?: number } | undefined>;

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
    // A failed booking used to throw straight out of the form handler, which looked like a
    // submit button that did nothing. It now says why and leaves the form as it was.
    try {
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
          await customersApi.update(customer.id, { fullName: typedName, phone: customer.phone, gender: Gender.Unknown });
          customer = { ...customer, name: typedName };
          setCustomers(prev => prev.map(c => (c.id === customer!.id ? customer! : c)));
        } catch { /* naming is a convenience; never block the order on it */ }
      }
      // Save the car on the customer and tie the order to it. The plate used to live only in
      // browser memory, so the next visit started with an empty plate and the car never built
      // up a history of its own.
      let vehicleId: string | null = null;
      if (customer && plate) {
        try {
          const found = await customersApi.get(customer.id);
          const same = found.vehicles.find(v => normalizePlate(v.plate) === normalizePlate(plate));
          vehicleId = same?.id
            ?? (await customersApi.addVehicle(customer.id, { plate, brand: '', model: '' })).id;
          const known = customer;
          setCustomers(prev => prev.map(c => (c.id === known.id ? { ...c, plate } : c)));
        } catch { /* the order still goes through; the car can be attached later */ }
      }
      const created = await ordersApi.create({
        branchId, bayId, customerId: customer?.id ?? null, vehicleId,
        customerName: typedName || customer?.name || 'مشتری',
        customerPhone: phone || null,
        vehiclePlate: plate, source: isWalkIn ? OrderSource.WalkIn : OrderSource.Reservation,
        lines: [],
      });
      setOrders(prev => [fromOrder(created), ...prev]);
      setBays(prev => prev.map(b => b.id === bayId
        ? { ...b, status: isWalkIn ? 'occupied' : 'reserved', currentOrderId: created.id }
        : b));
      toast.success('سفارش ثبت شد؛ خدمات را اضافه کنید');
      return created.id;
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'ثبت سفارش انجام نشد.');
      return undefined;
    }
  };

  /**
   * Runs one change to an order and tells the person what happened.
   *
   * Every order action used to be wired straight to a button with nothing catching a failure,
   * so a refused request left the screen exactly as it was and looked like a dead button —
   * only adding a service reported its errors. All of them now go through here: a failure is
   * always shown, and the caller learns whether it worked so a dialog can stay open on error.
   */
  const orderAction = async <T,>(
    orderId: string,
    op: () => Promise<T>,
    options: { success?: string; failure: string },
  ): Promise<boolean> => {
    try {
      await enqueueOrderOp(orderId, op);
      if (options.success) toast.success(options.success);
      return true;
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : options.failure);
      // A refusal usually means the order changed elsewhere. Show it as it now is, and the
      // bays with it, instead of leaving the board on a step the server has moved past.
      if (error instanceof ApiException && error.status >= 400 && error.status < 500) {
        ordersApi.get(orderId).then(o => applyUpdated(orderId, o)).catch(() => { });
        refreshBays();
      }
      return false;
    }
  };

  const applyUpdated = (orderId: string, updated: OrderDto) =>
    setOrders(prev => prev.map(o => o.id === orderId ? fromOrder(updated) : o));

  /** Bays change hands when a car moves, so the board reads them again after any move. */
  const refreshBays = async () => {
    try {
      const list = await baysApi.list(branchId ?? undefined, false);
      setBays(list.map(fromBay));
    } catch { /* the next full reload will catch up */ }
  };

  const addLineItem = (orderId: string, serviceId: string) => orderAction(orderId, async () => {
    applyUpdated(orderId, await ordersApi.addLine(orderId, { serviceId, quantity: 1 }));
  }, { failure: 'افزودن خدمت انجام نشد.' });

  const removeLineItem = (orderId: string, lineId: string) => orderAction(orderId, async () => {
    applyUpdated(orderId, await ordersApi.removeLine(orderId, lineId));
  }, { failure: 'حذف خدمت انجام نشد.' });

  const assignLineWorker = (orderId: string, lineId: string, workerId: string) => orderAction(orderId, async () => {
    applyUpdated(orderId, await ordersApi.assignLineWorker(orderId, lineId, workerId));
  }, { failure: 'تعیین پرسنل انجام نشد.' });

  const setLineTip = async (orderId: string, lineId: string, tip: number) => {
    const normalizedTip = Math.max(0, tip);
    const previous = orders.find(o => o.id === orderId)?.lineItems.find(l => l.id === lineId)?.tipAmount ?? 0;
    setOrders(prev => prev.map(o => o.id === orderId
      ? { ...o, lineItems: o.lineItems.map(l => l.id === lineId ? { ...l, tipAmount: normalizedTip } : l) }
      : o));
    const ok = await orderAction(orderId, async () => {
      applyUpdated(orderId, await ordersApi.setLineTip(orderId, lineId, normalizedTip));
    }, { failure: 'ثبت انعام انجام نشد.' });
    // Put back what was there before, not zero: a failed edit must not erase a recorded tip.
    if (!ok) setOrders(prev => prev.map(o => o.id === orderId
      ? { ...o, lineItems: o.lineItems.map(l => l.id === lineId ? { ...l, tipAmount: previous } : l) }
      : o));
    return ok;
  };

  const setOrderDiscount = (orderId: string, discount: number) => orderAction(orderId, async () => {
    applyUpdated(orderId, await ordersApi.applyDiscount(orderId, Math.max(0, discount)));
  }, { failure: 'ثبت تخفیف انجام نشد.' });

  const applyFreeService = (orderId: string) => orderAction(orderId, async () => {
    applyUpdated(orderId, await ordersApi.applyLoyaltyFree(orderId));
  }, { success: 'جایزه‌ی وفاداری اعمال شد', failure: 'اعمال جایزه انجام نشد.' });

  const advanceOrderStage = (orderId: string, stage: OrderStage, bayId?: string | null) => orderAction(orderId, async () => {
    applyUpdated(orderId, await ordersApi.advanceStage(orderId, stage, bayId ?? null));
    await refreshBays();
  }, { success: STAGE_DONE[stage], failure: 'تغییر مرحله انجام نشد.' });

  const getOrderTotals = (o: Order) => {
    const subtotal = o.lineItems.reduce((s, l) => s + l.price, 0);
    const freeDiscount = o.lineItems.filter(l => l.isFree).reduce((s, l) => s + l.price, 0);
    const tips = o.lineItems.reduce((s, l) => s + l.tipAmount, 0);
    const discount = o.discount;
    const total = Math.max(0, subtotal - freeDiscount - discount) + tips;
    return { subtotal, tips, discount, freeDiscount, total };
  };

  const finishOrder = (orderId: string, method: PaymentMethod = PaymentMethod.Cash) => orderAction(orderId, async () => {
    // The queue makes sure settling happens after every change already made to this order.
    applyUpdated(orderId, await ordersApi.complete(orderId, method));
    await refreshBays();
  }, { success: 'پرداخت ثبت و سفارش تحویل شد', failure: 'ثبت پرداخت انجام نشد.' });

  const cancelOrder = (orderId: string) => orderAction(orderId, async () => {
    applyUpdated(orderId, await ordersApi.cancel(orderId));
    await refreshBays();
  }, { success: 'سفارش لغو شد', failure: 'لغو سفارش انجام نشد.' });

  const expectedDurationFor = (order: Order) =>
    order.lineItems.reduce((sum, l) => {
      const s = services.find(x => x.id === l.serviceId);
      return sum + (s?.durationMinutes ?? 30);
    }, 0);

  const orderById = (orderId: string) => orders.find(o => o.id === orderId);

  const waitingOrders = useMemo(
    () => orders
      .filter(o => o.status === 'in_progress' && !o.currentBayId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [orders]);

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

    // The bay the booking asked for if it is free, otherwise a free bay a wash can start in.
    // "Any free bay" used to put an arriving car into a drying bay, from which its first step
    // — washing — could not happen without moving it again.
    const washable = (b: Bay) => b.kind === undefined || WASH_BAY_TYPES.includes(b.kind);
    const targetBay = (r.bayId && bays.find(b => b.id === r.bayId && b.status === 'empty'))
      || bays.find(b => b.status === 'empty' && washable(b));
    if (!branchId) return undefined;
    // No wash bay free: the car still checks in, and waits in the wash queue with its place in
    // line. Reservations are the cars that queue; a car booked onto a bay never does.
    // Same customer-and-car record as booking at a bay or through the new-order form.
    let ensured: Awaited<ReturnType<typeof ensureCustomerAndVehicle>> = { customer: null, vehicleId: null };
    try {
      ensured = await ensureCustomerAndVehicle({ phone: r.customerPhone, name: r.customerName, plate: r.customerPlate });
    } catch { /* the order still goes through; the car can be attached later */ }
    const created = await ordersApi.create({
      branchId, bayId: targetBay?.id ?? null, customerId: ensured.customer?.id ?? null, vehicleId: ensured.vehicleId,
      customerName: ensured.customer?.fullName ?? r.customerName, customerPhone: r.customerPhone,
      vehiclePlate: r.customerPlate, source: OrderSource.Reservation, reservationId: r.id,
      lines: r.serviceIds.map(serviceId => ({ serviceId, quantity: 1 })),
    });
    setOrders(prev => [fromOrder(created), ...prev]);
    if (targetBay) setBays(prev => prev.map(b => b.id === targetBay.id ? { ...b, status: 'occupied', currentOrderId: created.id } : b));
    setReservations(prev => prev.map(x => x.id === id ? { ...x, status: 'arrived', bayId: targetBay?.id } : x));
    return { orderId: created.id, queuePosition: created.queuePosition ?? undefined };
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
      activeOrderForBay, orderById, waitingOrders, advanceOrderStage, getOrderTotals, customerByPhone, customerForOrder, loyaltyProgress,
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
