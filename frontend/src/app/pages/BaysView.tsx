import React, { useMemo, useState } from 'react';
import { useCarWash } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User as UserIcon, Tag, CreditCard, Car, Clock, Trash2, Phone,
  Receipt, Gift, Sparkles, BadgeDollarSign, Plus, Minus, Check, Ban, Wallet
} from 'lucide-react';
import { clsx } from 'clsx';
import { CarwashLayout } from '../components/CarwashLayout';
import { InvoiceModal } from '../components/InvoiceModal';
import { IranPlateInput, formatIranPlate } from '../components/forms/IranPlateInput';
import { PageHeader } from '../components/app/PageHeader';
import { PaymentMethod } from '../api/types';
import { baysApi } from '../api';

export const BaysDashboard = () => {
  const {
    bays, activeOrderForBay, createOrder, addLineItem, removeLineItem,
    assignLineWorker, setLineTip, setOrderDiscount, applyFreeService,
    finishOrder, cancelOrder, workers, services, customers,
    getOrderTotals, customerByPhone, customerForOrder, loyaltyProgress, orders,
    addReservation,
  } = useCarWash();

  const [selectedBay, setSelectedBay] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'manage' | 'maintenance'>('create');
  const [plate, setPlate] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [knownCustomer, setKnownCustomer] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(true);
  const tomorrowDefault = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
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
      };
    }
    return map;
  }, [bays, orders]);

  const stats = useMemo(() => ({
    free: bays.filter(b => b.status === 'empty').length,
    busy: bays.filter(b => b.status === 'occupied').length,
    reserved: bays.filter(b => b.status === 'reserved').length,
  }), [bays]);

  const handleSelect = (bayId: string) => {
    const b = bays.find(x => x.id === bayId);
    if (!b) return;
    setSelectedBay(bayId);
    if (b.status === 'empty') setModalMode('create');
    else if (b.status === 'maintenance') setModalMode('maintenance');
    else setModalMode('manage');
    setPlate(''); setPhone(''); setName(''); setKnownCustomer(false); setIsWalkIn(true); setActiveLine(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBay || !plate) return;
    if (isWalkIn) {
      await createOrder(selectedBay, plate, phone, true, name);
      setSelectedBay(null);
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
      setKnownCustomer(true);
    } else if (knownCustomer) {
      // The phone was edited away from a match: clear the name it filled in, so the
      // previous customer's name is not silently attached to a different person.
      setName('');
      setKnownCustomer(false);
    }
  };

  const activeOrder = selectedBay ? activeOrderForBay(selectedBay) : undefined;
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
            <StatPill label="فعال" value={stats.busy} dot="bg-red-500" />
            <StatPill label="رزرو" value={stats.reserved} dot="bg-amber-500" />
          </div>
        }
      />

      <CarwashLayout bays={bays} workers={workers} ordersByBay={ordersByBay} onSelect={handleSelect} />

      <AnimatePresence>
        {selectedBay && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setSelectedBay(null)}
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
                    <Car size={13} /> {bays.find(b => b.id === selectedBay)?.name}
                  </p>
                </div>
                <button onClick={() => setSelectedBay(null)} className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full transition-colors">
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
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono" />
                      </div>
                      {knownCustomer && (
                        <div className="mt-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                          <Check size={14} />
                          مشتری شناسایی شد: <span className="font-bold">{name}</span>
                        </div>
                      )}
                    </div>

                    {/* Asked only when the phone lookup found nobody. Without it the customer was
                        saved as «مشتری جدید» and greeted by that name in every SMS afterwards. */}
                    {!knownCustomer && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">نام مشتری</label>
                        <div className="relative">
                          <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input value={name} onChange={e => setName(e.target.value)} type="text" placeholder="نام و نام خانوادگی"
                            autoComplete="name"
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" />
                        </div>
                      </div>
                    )}

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
                              min={new Date().toISOString().slice(0, 10)}
                              onChange={e => setResDate(e.target.value)}
                              className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            />
                            <select value={resHour} onChange={e => setResHour(Number(e.target.value))} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20">
                              {Array.from({ length: 13 }, (_, i) => 8 + i).map(h => (
                                <option key={h} value={h}>{String(h).padStart(2, '0')} : ساعت</option>
                              ))}
                            </select>
                            <select value={resMinute} onChange={e => setResMinute(Number(e.target.value))} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20">
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
                                    sel ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
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

                    <button type="submit" className="w-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-red-500/25">
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
                  activeOrder && totals && (
                    <div className="space-y-5">
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
                              onClick={() => addLineItem(activeOrder.id, service.id)}
                              className="flex flex-col items-start gap-0.5 bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50/50 px-3 py-2.5 rounded-xl text-right transition-all"
                            >
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
                                expanded ? "border-red-300 shadow-sm" : "border-gray-100"
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
                                          <img src={w.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name)}&background=fee2e2&color=dc2626&bold=true`} alt={w.name} className="w-4 h-4 rounded-full object-cover"
                                            onError={e => { const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name)}&background=fee2e2&color=dc2626&bold=true`; if (e.currentTarget.src !== fb) e.currentTarget.src = fb; }} />
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
                                  <button onClick={() => removeLineItem(activeOrder.id, li.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
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
                                              li.workerId === worker.id ? "bg-red-50 border-red-500" : "bg-white border-gray-200"
                                            )}
                                          >
                                            <img src={worker.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=fee2e2&color=dc2626&bold=true`} className="w-5 h-5 rounded-full object-cover" alt=""
                                              onError={e => { const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=fee2e2&color=dc2626&bold=true`; if (e.currentTarget.src !== fb) e.currentTarget.src = fb; }} />
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
                                          value={li.tipAmount ? toToman(li.tipAmount) : ''}
                                          onChange={e => setLineTip(activeOrder.id, li.id, toRials(Number(e.target.value)))}
                                          placeholder="0"
                                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-red-500/20"
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
                          value={activeOrder.discount ? toToman(activeOrder.discount) : ''}
                          onChange={e => setOrderDiscount(activeOrder.id, toRials(Number(e.target.value)))}
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
                            onClick={() => { cancelOrder(activeOrder.id); setSelectedBay(null); }}
                            className="bg-gray-800 hover:bg-red-900 text-gray-300 hover:text-white py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors"
                          >
                            <Ban size={14} /> لغو
                          </button>
                          <button
                            onClick={() => setShowInvoice(activeOrder.id)}
                            className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors"
                          >
                            <Receipt size={14} /> پیش‌فاکتور
                          </button>
                          <button
                            onClick={() => {
                              const id = activeOrder.id;
                              finishOrder(id, paymentMethod);
                              setShowInvoice(id);
                              setSelectedBay(null);
                              setPaymentMethod(PaymentMethod.Cash); // reset
                            }}
                            disabled={activeOrder.lineItems.length === 0}
                            className="bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors"
                          >
                            <CreditCard size={14} /> تأیید پرداخت
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
