import React, { useEffect, useMemo, useState } from 'react';
import { useCarWash } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User as UserIcon, Tag, CreditCard, Car, Clock, Trash2, Phone,
  Receipt, Gift, Sparkles, BadgeDollarSign, Plus, Minus, Check, Ban, Wallet, Loader2, ArrowLeft
} from 'lucide-react';
import { clsx } from 'clsx';
import { CarwashLayout } from '../components/CarwashLayout';
import { InvoiceModal } from '../components/InvoiceModal';
import { IranPlateInput, formatIranPlate } from '../components/forms/IranPlateInput';
import { PageHeader } from '../components/app/PageHeader';
import { BayType, OrderStage, PaymentMethod } from '../api/types';
import { baysApi, customersApi } from '../api';
import type { BayDto } from '../api/types';
import { WorkerAvatar } from '../components/WorkerAvatar';
import { OrderStageControl } from '../components/OrderStageControl';
import { WaitingCars } from '../components/WaitingCars';
import { STAGE_META } from '../lib/orderStages';
import { ordersApi } from '../api';
import { localIsoDate, localIsoDateIn } from '../lib/dates';

export const BaysDashboard = () => {
  const {
    bays, activeOrderForBay, orderById, waitingOrders, advanceOrderStage, createOrder, addLineItem, removeLineItem,
    assignLineWorker, setLineTip, setOrderDiscount, applyFreeService,
    finishOrder, cancelOrder, workers, services, customers,
    getOrderTotals, customerByPhone, customerForOrder, loyaltyProgress, orders,
    addReservation, reloadAll,
  } = useCarWash();

  const [selectedBay, setSelectedBay] = useState<string | null>(null);
  // The panel follows the order, not the bay. A car that leaves its bay for a queue is still
  // the car being worked on, and a panel tied to the bay went blank the moment it moved.
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [addingService, setAddingService] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [discountDraft, setDiscountDraft] = useState<string | null>(null);
  const [tipDrafts, setTipDrafts] = useState<Record<string, string>>({});
  // Only while a panel is open: the board refreshes itself every half minute and there is
  // no reason to fetch the detailed records alongside it when nobody is looking at them.
  useEffect(() => {
    if (selectedBay === null && selectedOrderId === null) return;
    baysApi.list(undefined, true).then(setApiBays).catch(() => { });
  }, [bays, selectedBay, selectedOrderId]);
  const [modalMode, setModalMode] = useState<'create' | 'manage' | 'maintenance'>('create');
  const [plate, setPlate] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  // The store's bays are the board's simplified view; the stage picker needs the real
  // records, because it filters on bay type and capacity which the board never shows.
  const [apiBays, setApiBays] = useState<BayDto[]>([]);

  const [knownCustomer, setKnownCustomer] = useState(false);
  /** True while the name box holds a value the lookup put there rather than one that was typed. */
  const [nameFromLookup, setNameFromLookup] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(true);
  const tomorrowDefault = () => localIsoDateIn(1);
  const [resDate, setResDate] = useState<string>(tomorrowDefault());
  const [resHour, setResHour] = useState<number>(10);
  const [resMinute, setResMinute] = useState<number>(0);
  const [resServices, setResServices] = useState<string[]>([]);
  const [resToast, setResToast] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [, forceTick] = useState(0);

  // Tick every 30s for elapsed time
  React.useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const ordersByBay = useMemo(() => {
    const map: Record<string, any> = {};
    for (const b of bays) {
      const o = activeOrderForBay(b.id);
      if (!o) { map[b.id] = undefined; continue; }
      const totals = getOrderTotals(o);
      const minutesElapsed = Math.max(0, Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000));
      map[b.id] = {
        // پلاک با قالب یکنواخت پلتفرم روی کارت جایگاه نمایش داده می‌شود، نه رشته‌ی خام.
        plate: formatIranPlate(o.customerPlate) || o.customerPlate,
        workerIds: Array.from(new Set(o.lineItems.map(l => l.workerId).filter(Boolean) as string[])),
        total: totals.total,
        itemsCount: o.lineItems.length,
        minutesElapsed,
        stageLabel: STAGE_META[o.stage]?.label,
      };
    }
    return map;
  }, [bays, orders]);

  const stats = useMemo(() => ({
    free: bays.filter(b => b.status === 'empty').length,
    busy: bays.filter(b => b.status === 'occupied').length,
    reserved: bays.filter(b => b.status === 'reserved').length,
  }), [bays]);

  const resetPanel = () => {
    setPlate(''); setPhone(''); setName(''); setKnownCustomer(false); setIsWalkIn(true); setActiveLine(null);
    setConfirmCancel(false); setDiscountDraft(null); setTipDrafts({}); setAddingService(null);
  };

  const handleSelect = (bayId: string) => {
    const b = bays.find(x => x.id === bayId);
    if (!b) return;
    resetPanel();
    setSelectedBay(bayId);
    if (b.status === 'empty') { setModalMode('create'); setSelectedOrderId(null); }
    else if (b.status === 'maintenance') { setModalMode('maintenance'); setSelectedOrderId(null); }
    else { setModalMode('manage'); setSelectedOrderId(b.currentOrderId ?? null); }
  };

  const openOrder = (orderId: string) => {
    resetPanel();
    setSelectedBay(null);
    setSelectedOrderId(orderId);
    setModalMode('manage');
  };

  const closePanel = () => { setSelectedBay(null); setSelectedOrderId(null); };

  // Reservations that arrived while every wash bay was full, first in line first. A free wash
  // bay is where they go next, so choosing one offers them before a new booking.
  const washQueue = useMemo(
    () => waitingOrders
      .filter(o => o.stage === OrderStage.QueuedForWash)
      .sort((a, b) => (a.queuePosition ?? 99) - (b.queuePosition ?? 99)),
    [waitingOrders]);
  const selectedIsWashBay = (() => {
    const kind = bays.find(b => b.id === selectedBay)?.kind;
    return kind === undefined || [BayType.Wash, BayType.EngineWash, BayType.Special].includes(kind);
  })();
  const [pulling, setPulling] = useState<string | null>(null);
  const pullFromQueue = async (orderId: string) => {
    if (!selectedBay || pulling) return;
    setPulling(orderId);
    try {
      if (await advanceOrderStage(orderId, OrderStage.Washing, selectedBay)) openOrder(orderId);
    } finally {
      setPulling(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBay || !plate) return;
    if (isWalkIn) {
      const created = await createOrder(selectedBay, plate, phone, true, name);
      // Go straight on to the new order: adding its services is always the next thing done.
      if (created) openOrder(created);
      else setSelectedBay(null);
    } else {
      const [y, m, d] = resDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d, resHour, resMinute, 0, 0);
      addReservation({
        customerName: name || 'مشتری',
        customerPhone: phone,
        customerPlate: plate,
        bayId: selectedBay,
        scheduledAt: dt.toISOString(),
        serviceIds: resServices,
      });
      setSelectedBay(null);
      setResToast(`رزرو برای ${dt.toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long' })} ثبت شد ✓`);
      setTimeout(() => setResToast(null), 2500);
      setResServices([]);
    }
  };

  const handlePhoneLookup = (val: string) => {
    setPhone(val);
    const c = customerByPhone(val);
    if (c) {
      setPlate(c.plate);
      setName(c.name);
      setNameFromLookup(true);
      setKnownCustomer(true);
      return;
    }
    // Only the first couple of hundred customers are held in the browser. A full number that
    // is not among them is looked up on the server, so a regular from last year is still
    // recognised rather than being booked in again as a stranger.
    if (/^09\d{9}$/.test(val)) {
      customersApi.search({ search: val, pageSize: 1 }).then(res => {
        const hit = res.items.find(x => x.phone === val);
        if (!hit) return;
        setName(hit.fullName);
        setNameFromLookup(true);
        setKnownCustomer(true);
        if (hit.vehicles[0]?.plate) setPlate(hit.vehicles[0].plate);
      }).catch(() => { });
    }
    // The phone no longer matches anyone. Only a name this lookup filled in is cleared —
    // a name the operator typed stays, because the phone box is not where they typed it.
    if (nameFromLookup) {
      setName('');
      setNameFromLookup(false);
    }
    setKnownCustomer(false);
  };

  const activeOrder = selectedOrderId ? orderById(selectedOrderId) : undefined;
  const panelOpen = selectedBay !== null || selectedOrderId !== null;
  const orderLocation = activeOrder?.currentBayId
    ? bays.find(b => b.id === activeOrder.currentBayId)?.name
    : activeOrder ? STAGE_META[activeOrder.stage]?.label : undefined;
  const orderCustomer = activeOrder ? customerForOrder(activeOrder) : undefined;
  const loyalty = orderCustomer ? loyaltyProgress(orderCustomer) : null;
  const totals = activeOrder ? getOrderTotals(activeOrder) : null;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="جایگاه‌های شستشو"
        subtitle="نمای زنده از فضای کارواش — برای ثبت یا مدیریت روی جایگاه کلیک کنید"
        actions={
          <div className="flex gap-2">
            <StatPill label="آزاد" value={stats.free} dot="bg-emerald-500" />
            <StatPill label="فعال" value={stats.busy} dot="bg-brand-500" />
            <StatPill label="رزرو" value={stats.reserved} dot="bg-amber-500" />
          </div>
        }
      />

      <CarwashLayout bays={bays} workers={workers} ordersByBay={ordersByBay} onSelect={handleSelect} />

      <WaitingCars orders={waitingOrders} onOpen={openOrder} />

      <AnimatePresence>
        {panelOpen && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={closePanel}
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 250, damping: 25 }}
              className="relative w-full md:max-w-2xl bg-white rounded-t-[2rem] md:rounded-[2rem] shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
              dir="rtl"
            >
              <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-3 flex justify-between items-center border-b border-gray-100">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">
                    {modalMode === 'create' ? 'ثبت سفارش جدید' : 'مدیریت سفارش'}
                  </h2>
                  <p className="text-gray-500 text-xs mt-1 flex items-center gap-1.5">
                    <Car size={13} /> {modalMode === 'manage' ? (orderLocation ?? '') : bays.find(b => b.id === selectedBay)?.name}
                  </p>
                </div>
                <button onClick={closePanel} className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="px-4 sm:px-6 md:px-8 py-5">
                {modalMode === 'maintenance' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <span className="text-2xl">🔧</span>
                      <div>
                        <div className="font-bold text-amber-900">جایگاه در حال تعمیر</div>
                        <div className="text-xs text-amber-700 mt-0.5">برای آزاد کردن جایگاه روی دکمه کلیک کنید.</div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!selectedBay) return;
                        await baysApi.free(selectedBay);
                        setSelectedBay(null);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 text-sm"
                    >
                      <Check size={16} /> آزاد کردن جایگاه
                    </button>
                  </div>
                ) : modalMode === 'create' ? (
                  <form onSubmit={handleCreateSubmit} className="space-y-5">
                    {selectedIsWashBay && washQueue.length > 0 && (
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3" translate="no">
                        <div className="mb-2 text-xs font-bold text-sky-800">
                          <span>{washQueue.length.toLocaleString('fa-IR')} خودرو در صف شستشو منتظر جایگاه است</span>
                        </div>
                        <div className="space-y-1.5">
                          {washQueue.slice(0, 4).map(o => (
                            <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                              <span className="flex min-w-0 items-center gap-2 text-xs">
                                <span className="rounded-md bg-sky-100 px-1.5 py-0.5 font-bold text-sky-700">{(o.queuePosition ?? 0).toLocaleString('fa-IR')}</span>
                                <span className="truncate font-mono text-gray-700">{formatIranPlate(o.customerPlate) || o.customerPlate}</span>
                              </span>
                              <button type="button" onClick={() => pullFromQueue(o.id)} disabled={pulling !== null}
                                className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700 disabled:opacity-60">
                                {pulling === o.id ? <Loader2 key="spin" size={12} className="animate-spin" /> : <ArrowLeft key="go" size={12} />}
                                <span>{pulling === o.id ? 'در حال ثبت…' : 'ورود به این جایگاه'}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[10px] text-sky-700/80">یا برای مشتری تازه‌وارد، سفارش جدید را پایین ثبت کنید.</div>
                      </div>
                    )}
                    <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl">
                      <button type="button" onClick={() => setIsWalkIn(true)} className={clsx("flex-1 py-2.5 text-sm font-medium rounded-xl transition-all", isWalkIn ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}>
                        <Car size={14} className="inline ml-1.5" /> حضوری
                      </button>
                      <button type="button" onClick={() => setIsWalkIn(false)} className={clsx("flex-1 py-2.5 text-sm font-medium rounded-xl transition-all", !isWalkIn ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}>
                        <Clock size={14} className="inline ml-1.5" /> رزرو آینده
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">شماره تلفن مشتری</label>
                      <div className="relative">
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input value={phone} onChange={e => handlePhoneLookup(e.target.value)} type="tel" placeholder="09123456789"
                          dir="ltr" inputMode="tel" autoComplete="tel"
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono" />
                      </div>
                      {knownCustomer && (
                        <div className="mt-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                          <Check size={14} />
                          مشتری شناسایی شد: <span className="font-bold">{name}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">نام مشتری</label>
                      <div className="relative">
                        <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input value={name} onChange={e => { setName(e.target.value); setNameFromLookup(false); }}
                          type="text" placeholder="نام و نام خانوادگی" autoComplete="name"
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
                      </div>
                      {knownCustomer && (
                        <p className="mt-1.5 text-[11px] text-gray-400">از پرونده‌ی همین شماره پر شد — در صورت نیاز می‌توانید تغییرش دهید.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">شماره پلاک</label>
                      <IranPlateInput required value={plate} onChange={setPlate} />
                    </div>

                    {!isWalkIn && (
                      <div className="space-y-4 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5"><Clock size={13} /> تاریخ و ساعت رزرو</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="date"
                              required
                              value={resDate}
                              min={localIsoDate()}
                              onChange={e => setResDate(e.target.value)}
                              className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            />
                            <select value={resHour} onChange={e => setResHour(Number(e.target.value))} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                              {Array.from({ length: 13 }, (_, i) => 8 + i).map(h => (
                                <option key={h} value={h}>{String(h).padStart(2, '0')} : ساعت</option>
                              ))}
                            </select>
                            <select value={resMinute} onChange={e => setResMinute(Number(e.target.value))} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                              {[0, 15, 30, 45].map(m => (
                                <option key={m} value={m}>{String(m).padStart(2, '0')} : دقیقه</option>
                              ))}
                            </select>
                          </div>
                          <div className="mt-2 text-[11px] text-amber-700 font-bold">
                            زمان انتخاب شده: {String(resHour).padStart(2, '0')}:{String(resMinute).padStart(2, '0')} — {new Date(resDate).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">خدمات رزرو شده (اختیاری)</label>
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {services.map(s => {
                              const sel = resServices.includes(s.id);
                              return (
                                <button
                                  type="button"
                                  key={s.id}
                                  onClick={() => setResServices(prev => sel ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                                  className={clsx(
                                    'p-2.5 rounded-xl border text-right transition-all text-xs',
                                    sel ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                  )}
                                >
                                  <div className="font-bold">{s.name}</div>
                                  <div className="text-[10px] opacity-70 font-mono">{fmtToman(s.price)} تومان</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    <button type="submit" className="w-full bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-brand-500/25">
                      {isWalkIn ? 'تخصیص جایگاه و شروع' : 'ثبت رزرو'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedBay) return;
                        const notes = window.prompt('دلیل تعمیر (اختیاری)') ?? null;
                        await baysApi.maintenance(selectedBay, notes);
                        setSelectedBay(null);
                      }}
                      className="w-full border border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-bold py-2.5 rounded-2xl transition-all flex items-center justify-center gap-2 mt-1"
                    >
                      🔧 قراردادن در وضعیت تعمیر
                    </button>
                  </form>
                ) : (
                  activeOrder && activeOrder.status !== 'in_progress' ? (
                    <div className="py-10 text-center text-sm text-gray-500">
                      این سفارش {activeOrder.status === 'completed' ? 'تحویل و بسته' : 'لغو'} شده است.
                    </div>
                  ) : !activeOrder ? (
                    <div className="py-10 text-center text-sm text-gray-400">در حال بارگذاری سفارش…</div>
                  ) : totals && (
                    <div className="space-y-5">
                      {/* Where the car is. Shown before the money, because the person standing
                          at the bay is deciding what to do with the car, not with the invoice. */}
                      <OrderStageControl
                        stage={activeOrder.stage}
                        outstandingRials={activeOrder.outstanding}
                        queuePosition={activeOrder.queuePosition}
                        currentBayId={activeOrder.currentBayId}
                        bays={apiBays}
                        onAdvance={(next, bayId) => advanceOrderStage(activeOrder.id, next, bayId)}
                        lineCount={activeOrder.lineItems.length}
                      />

                      {/* Plate + customer */}
                      <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white p-5 rounded-2xl">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-[10px] text-gray-400 mb-1">پلاک خودرو</div>
                            <div className="font-mono text-2xl font-extrabold tracking-widest">{activeOrder.customerPlate}</div>
                            {activeOrder.customerPhone && (
                              <div className="text-xs text-gray-300 mt-2 font-mono">{activeOrder.customerPhone}</div>
                            )}
                            {orderCustomer && (
                              <div className="text-xs text-gray-200 mt-1 font-bold">{orderCustomer.name}</div>
                            )}
                          </div>
                          {orderCustomer && loyalty && (
                            <div className="text-left">
                              <div className="text-[10px] text-gray-400 mb-1">پیشرفت وفاداری</div>
                              <div className="flex gap-1 mb-1.5 justify-end">
                                {[0, 1, 2].map(i => (
                                  <div key={i} className={clsx('w-3 h-3 rounded-full',
                                    i < loyalty.progress ? 'bg-yellow-400' : 'bg-gray-600'
                                  )} />
                                ))}
                              </div>
                              {loyalty.available && !activeOrder.freeServiceApplied && (
                                <button
                                  onClick={() => applyFreeService(activeOrder.id)}
                                  disabled={activeOrder.lineItems.length === 0}
                                  className="text-[10px] bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-gray-900 px-2 py-1 rounded-md font-bold flex items-center gap-1"
                                >
                                  <Gift size={11} /> اعمال جایزه
                                </button>
                              )}
                              {activeOrder.freeServiceApplied && (
                                <span className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded-md font-bold flex items-center gap-1">
                                  <Check size={11} /> رایگان اعمال شد
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Add Services */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <Tag size={15} className="text-gray-400" /> افزودن خدمات
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {services.map(service => (
                            <button
                              key={service.id}
                              disabled={addingService !== null}
                              onClick={async () => {
                                setAddingService(service.id);
                                await addLineItem(activeOrder.id, service.id);
                                setAddingService(null);
                              }}
                              className="relative flex flex-col items-start gap-0.5 bg-white border border-gray-200 hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-60 px-3 py-2.5 rounded-xl text-right transition-all"
                            >
                              {addingService === service.id && <Loader2 size={13} className="absolute left-2 top-2 animate-spin text-brand-500" />}
                              <span className="text-xs font-bold text-gray-900">{service.name}</span>
                              <span className="text-[10px] text-gray-500 font-mono">{fmtToman(service.price)} تومان</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Line items list with per-line worker + tip */}
                      {activeOrder.lineItems.length > 0 && (
                        <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
                          <div className="text-[10px] text-gray-500 mb-1 px-1 font-bold">آیتم‌های سفارش (هر سرویس به یک کارگر اختصاص می‌یابد)</div>
                          {activeOrder.lineItems.map(li => {
                            const w = workers.find(x => x.id === li.workerId);
                            const expanded = activeLine === li.id;
                            return (
                              <div key={li.id} className={clsx(
                                "bg-white rounded-xl border transition-all",
                                expanded ? "border-brand-300 shadow-sm" : "border-gray-100"
                              )}>
                                <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-gray-900">{li.serviceName}</span>
                                      {li.isFree && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center gap-1">
                                          <Gift size={9} /> رایگان
                                        </span>
                                      )}
                                      {li.tipAmount > 0 && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                                          +{fmtToman(li.tipAmount)} انعام
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      {w ? (
                                        <div className="flex items-center gap-1.5">
                                          <WorkerAvatar src={w.avatar} name={w.name} size={16} />
                                          <span className="text-[10px] text-gray-600">{w.name}</span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-amber-600 font-bold">⚠ کارگر تعیین نشده</span>
                                      )}
                                    </div>
                                  </div>
                                  <span className={clsx("text-xs font-mono font-bold", li.isFree ? "line-through text-gray-400" : "text-gray-800")}>
                                    {fmtToman(li.price)}
                                  </span>
                                  <button
                                    onClick={() => setActiveLine(expanded ? null : li.id)}
                                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                                  >
                                    <UserIcon size={13} />
                                  </button>
                                  <button onClick={() => removeLineItem(activeOrder.id, li.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                {expanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="border-t border-gray-100 p-3 space-y-3"
                                  >
                                    <div>
                                      <div className="text-[10px] text-gray-500 mb-1.5">کارگر مسئول</div>
                                      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                                        {workers.map(worker => (
                                          <button
                                            key={worker.id}
                                            onClick={() => assignLineWorker(activeOrder.id, li.id, worker.id)}
                                            className={clsx(
                                              "flex-shrink-0 flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-xl border-2 transition-all",
                                              li.workerId === worker.id ? "bg-brand-50 border-brand-500" : "bg-white border-gray-200"
                                            )}
                                          >
                                            <WorkerAvatar src={worker.avatar} name={worker.name} size={20} />
                                            <span className="text-[10px] font-medium whitespace-nowrap">{worker.name}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                                        <BadgeDollarSign size={11} /> انعام (تومان)
                                      </div>
                                      <div className="flex gap-1.5 items-center">
                                        <button onClick={() => setLineTip(activeOrder.id, li.id, Math.max(0, li.tipAmount - toRials(5_000)))} className="p-1.5 rounded-lg bg-gray-100">
                                          <Minus size={12} />
                                        </button>
                                        <input
                                          type="number"
                                          value={tipDrafts[li.id] ?? (li.tipAmount ? String(toToman(li.tipAmount)) : '')}
                                          onChange={e => setTipDrafts(d => ({ ...d, [li.id]: e.target.value }))}
                                          onBlur={async () => {
                                            const draft = tipDrafts[li.id];
                                            if (draft === undefined) return;
                                            setTipDrafts(d => { const n = { ...d }; delete n[li.id]; return n; });
                                            const value = toRials(Number(draft) || 0);
                                            if (value !== li.tipAmount) await setLineTip(activeOrder.id, li.id, value);
                                          }}
                                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                          placeholder="0"
                                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                        />
                                        <button onClick={() => setLineTip(activeOrder.id, li.id, li.tipAmount + toRials(5_000))} className="p-1.5 rounded-lg bg-gray-100">
                                          <Plus size={12} />
                                        </button>
                                        <div className="flex gap-1 mr-1">
                                          {[5_000, 10_000, 20_000].map(toman => (
                                            <button key={toman} onClick={() => setLineTip(activeOrder.id, li.id, toRials(toman))}
                                              className="text-[10px] px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100">
                                              {toman / 1000}ک
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Discount */}
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                        <div className="text-xs text-amber-800 font-bold">تخفیف دستی (تومان)</div>
                        <input
                          type="number"
                          value={discountDraft ?? (activeOrder.discount ? String(toToman(activeOrder.discount)) : '')}
                          onChange={e => setDiscountDraft(e.target.value)}
                          onBlur={async () => {
                            if (discountDraft === null) return;
                            const value = toRials(Number(discountDraft) || 0);
                            setDiscountDraft(null);
                            if (value !== activeOrder.discount) await setOrderDiscount(activeOrder.id, value);
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          placeholder="0"
                          className="w-28 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>

                      {/* Totals */}
                      <div className="bg-gray-900 text-white p-5 rounded-2xl shadow-xl space-y-2">
                        <Row label="جمع خدمات" value={totals.subtotal} />
                        {totals.freeDiscount > 0 && <Row label="جایزه وفاداری" value={-totals.freeDiscount} accent="text-emerald-400" />}
                        {totals.discount > 0 && <Row label="تخفیف" value={-totals.discount} accent="text-amber-400" />}
                        {totals.tips > 0 && <Row label="انعام پرسنل" value={totals.tips} accent="text-blue-400" />}
                        <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                          <span className="text-gray-300 font-bold">جمع کل</span>
                          <span className="text-2xl font-extrabold font-mono">
                            {fmtToman(totals.total)} <span className="text-xs font-normal text-gray-400">تومان</span>
                          </span>
                        </div>

                        {/* روش پرداخت */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          {([
                            [PaymentMethod.Cash,   'نقد',    'bg-emerald-600'],
                            [PaymentMethod.Card,   'کارت',   'bg-blue-600'],
                            [PaymentMethod.Wallet, 'کیف پول','bg-violet-600'],
                          ] as [PaymentMethod, string, string][]).map(([m, label, col]) => (
                            <button
                              key={m}
                              onClick={() => setPaymentMethod(m)}
                              className={clsx(
                                'py-2 rounded-xl text-[11px] font-bold transition-all',
                                paymentMethod === m
                                  ? `${col} text-white scale-[1.03] shadow-lg`
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                          <button
                            onClick={async () => {
                              // One tap on a dark button next to "pay" was enough to cancel a car's
                              // order outright. The first tap now only arms it.
                              if (!confirmCancel) {
                                setConfirmCancel(true);
                                setTimeout(() => setConfirmCancel(false), 4000);
                                return;
                              }
                              setConfirmCancel(false);
                              if (await cancelOrder(activeOrder.id)) closePanel();
                            }}
                            className={clsx('py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors',
                              confirmCancel ? 'bg-red-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white')}
                          >
                            <Ban size={14} /> {confirmCancel ? 'برای لغو دوباره بزنید' : 'لغو'}
                          </button>
                          <button
                            onClick={() => setShowInvoice(activeOrder.id)}
                            className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors"
                          >
                            <Receipt size={14} /> پیش‌فاکتور
                          </button>
                          <button
                            onClick={async () => {
                              const id = activeOrder.id;
                              setFinishing(true);
                              const ok = await finishOrder(id, paymentMethod);
                              setFinishing(false);
                              // Only a settled order gets an invoice; on failure the panel stays open
                              // with the reason shown, instead of printing a receipt for money not taken.
                              if (!ok) return;
                              setShowInvoice(id);
                              closePanel();
                              setPaymentMethod(PaymentMethod.Cash);
                            }}
                            disabled={activeOrder.lineItems.length === 0 || finishing}
                            className="bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors"
                          >
                            {finishing ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                            {finishing ? 'در حال ثبت…' : 'تأیید پرداخت و تحویل'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <InvoiceModal id={showInvoice} onClose={() => setShowInvoice(null)} />

      <AnimatePresence>
        {resToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold"
          >
            {resToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// قاعده‌ی پلتفرم: state و API ریال‌اند، اما هر نمایش و ورودیِ مالی تومان است.
const RIAL_PER_TOMAN = 10;
const toToman = (rials: number) => Math.round(rials / RIAL_PER_TOMAN);
const toRials = (toman: number) => Math.round(toman) * RIAL_PER_TOMAN;
const fmtToman = (rials: number) => toToman(rials).toLocaleString('fa-IR');

const Row = ({ label, value, accent = 'text-white' }: { label: string; value: number; accent?: string }) => (
  <div className="flex justify-between items-center text-xs">
    <span className="text-gray-400">{label}</span>
    <span className={clsx('font-mono font-bold', accent)}>
      {value < 0 ? '−' : ''}{fmtToman(Math.abs(value))}
    </span>
  </div>
);

const StatPill = ({ label, value, dot }: { label: string; value: number; dot: string }) => (
  <div className="flex items-center gap-2 bg-white px-3 md:px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
    <span className={clsx('w-2 h-2 rounded-full', dot)} />
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm font-bold text-gray-900 mr-auto">{value}</span>
  </div>
);
