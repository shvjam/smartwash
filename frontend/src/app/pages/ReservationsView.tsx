import { IranPlateInput } from '../components/forms/IranPlateInput';
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Clock, Plus, X, Phone, Check, Car,
  ChevronRight, Sparkles, Tag, MessageSquare, Lock
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCarWash } from '../store';
import type { ReservationStatus } from '../types';
import { PageHeader, Card, StatCard } from '../components/app/PageHeader';
import { useFeature } from '../lib/features';
import { localIsoDate } from '../lib/dates';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 to 20
/** Bookable hours in the new-reservation form: the whole day, since carwashes keep late hours. */
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

const dateKey = (d: Date) => localIsoDate(d);
const fmtDay = (d: Date) => d.toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

const statusBadge: Record<ReservationStatus, { label: string; cls: string }> = {
  pending: { label: 'در انتظار تایید', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmed: { label: 'تایید شده', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  arrived: { label: 'حاضر شد', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'لغو شده', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  no_show: { label: 'عدم حضور', cls: 'bg-brand-100 text-brand-700 border-brand-200' },
};

export const ReservationsView = () => {
  const { enabled: hasReservations, loading: featureLoading } = useFeature('reservations');
  const {
    reservations, addReservation, cancelReservation, arriveReservation,
    services, customers, customerByPhone, bays
  } = useCarWash();

  const [selectedDate, setSelectedDate] = useState(() => {
    // Open on today: that is where the cars about to arrive are.
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showForm, setShowForm] = useState<{ hour: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Generate 7 day chips starting from today
  const days = useMemo(() => {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(t0); d.setDate(d.getDate() + i); return d;
    });
  }, []);

  const dayReservations = useMemo(() =>
    reservations
      .filter(r => dateKey(new Date(r.scheduledAt)) === dateKey(selectedDate))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [reservations, selectedDate]
  );

  // The usual day, widened to any hour that has a booking: a reservation at 22:00 used to fall
  // outside the grid and simply not appear anywhere on the page.
  const visibleHours = useMemo(() => {
    const hours = new Set(HOURS);
    for (const r of dayReservations) hours.add(new Date(r.scheduledAt).getHours());
    return [...hours].sort((a, b) => a - b);
  }, [dayReservations]);

  const reservationsByHour = useMemo(() => {
    const map: Record<number, typeof dayReservations> = {};
    for (const r of dayReservations) {
      const h = new Date(r.scheduledAt).getHours();
      if (!map[h]) map[h] = [];
      map[h].push(r);
    }
    return map;
  }, [dayReservations]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const handleArrive = async (id: string) => {
    try {
      const arrived = await arriveReservation(id);
      const queued = arrived?.queuePosition;
      if (!arrived) showToast('پذیرش رزرو انجام نشد.');
      else if (queued) showToast(`همه‌ی جایگاه‌ها پرند؛ خودرو نفر ${queued.toLocaleString('fa-IR')} صف شستشو شد`);
      else showToast('مشتری وارد جایگاه شد و سفارش فعال شد ✓');
    } catch {
      showToast('خطا در پذیرش رزرو');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelReservation(id);
      showToast('رزرو لغو شد');
    } catch {
      showToast('خطا در لغو رزرو');
    }
  };

  const stats = {
    total: dayReservations.length,
    pending: dayReservations.filter(r => r.status === 'pending').length,
    confirmed: dayReservations.filter(r => r.status === 'confirmed').length,
    arrived: dayReservations.filter(r => r.status === 'arrived').length,
  };

  if (!featureLoading && !hasReservations) {
    return (
      <div className="max-w-6xl mx-auto pb-10">
        <PageHeader title="رزروها" subtitle="مدیریت رزرواسیون‌های آنلاین و حضوری" />
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock size={28} className="text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-700 text-lg">سیستم رزرواسیون در پلن شما فعال نیست</h3>
            <p className="text-sm text-gray-500 max-w-sm leading-6">
              برای فعال‌سازی رزرواسیون آنلاین و حضوری، پلن اشتراک خود را ارتقا دهید.
            </p>
            <a href="/app/billing"
              className="mt-2 bg-gradient-to-br from-brand-500 to-brand-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-brand-500/30 hover:from-brand-600 hover:to-brand-800 transition-all">
              مشاهده پلن‌ها و ارتقا
            </a>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-5">
      <PageHeader
        title="صف رزروها"
        subtitle="مدیریت رزروهای پیش‌رو با انتخاب ساعت دقیق ورود"
        actions={
          <button
            onClick={() => setShowForm({ hour: 10 })}
            className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-800 shadow"
          >
            <Plus size={14} /> رزرو جدید
          </button>
        }
      />

      {/* Day strip */}
      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {days.map((d, i) => {
            const isSelected = dateKey(d) === dateKey(selectedDate);
            const isToday = i === 0;
            const count = reservations.filter(r => dateKey(new Date(r.scheduledAt)) === dateKey(d) && r.status !== 'cancelled').length;
            return (
              <button
                key={dateKey(d)}
                onClick={() => setSelectedDate(d)}
                className={clsx(
                  'relative flex-shrink-0 flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl border-2 min-w-[80px] transition-all',
                  isSelected
                    ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white border-brand-600 shadow-lg shadow-brand-500/30'
                    : 'bg-white border-gray-100 text-gray-700 hover:border-gray-300'
                )}
              >
                <span className={clsx('text-[10px]', isSelected ? 'text-brand-100' : 'text-gray-400')}>
                  {isToday ? 'امروز' : i === 1 ? 'فردا' : d.toLocaleDateString('fa-IR', { weekday: 'short' })}
                </span>
                <span className="text-lg font-extrabold mt-0.5">{d.toLocaleDateString('fa-IR', { day: 'numeric' })}</span>
                <span className={clsx('text-[10px]', isSelected ? 'text-brand-100' : 'text-gray-400')}>
                  {d.toLocaleDateString('fa-IR', { month: 'short' })}
                </span>
                {count > 0 && (
                  <span className={clsx(
                    'absolute top-1 left-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center',
                    isSelected ? 'bg-white text-brand-600' : 'bg-brand-500 text-white'
                  )}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard accent="sky" label="کل رزروها" value={stats.total} hint={fmtDay(selectedDate)} />
        <StatCard accent="sky" label="تایید شده" value={stats.confirmed} />
        <StatCard accent="amber" label="در انتظار" value={stats.pending} />
        <StatCard accent="emerald" label="حاضر شده" value={stats.arrived} />
      </div>

      {/* Title row */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-900">{fmtDay(selectedDate)}</h2>
        <button
          onClick={() => setShowForm({ hour: 10 })}
          className="hidden"
        >
          <Plus size={14} /> رزرو جدید
        </button>
      </div>

      {/* Time slots */}
      <Card>
        <div className="space-y-2">
          {visibleHours.map(hour => {
            const items = reservationsByHour[hour] ?? [];
            const isPast = (() => {
              const slot = new Date(selectedDate); slot.setHours(hour, 0, 0, 0);
              return slot.getTime() < Date.now() - 60 * 60 * 1000;
            })();
            return (
              <div key={hour} className={clsx(
                "flex items-stretch gap-3 group",
                isPast && "opacity-50"
              )}>
                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-start pt-2">
                  <div className="font-mono font-extrabold text-gray-900 text-lg">{String(hour).padStart(2, '0')}:00</div>
                  <div className="w-px flex-1 bg-gray-100 mt-2 group-hover:bg-gray-200" />
                </div>

                <div className="flex-1 min-h-[68px] py-1">
                  {items.length === 0 ? (
                    <button
                      onClick={() => setShowForm({ hour })}
                      disabled={isPast}
                      className="w-full h-full min-h-[60px] rounded-2xl border-2 border-dashed border-gray-200 hover:border-brand-400 hover:bg-brand-50/40 disabled:hover:border-gray-200 disabled:hover:bg-transparent text-gray-400 hover:text-brand-500 disabled:hover:text-gray-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Plus size={14} /> {isPast ? 'گذشته' : 'افزودن رزرو در این ساعت'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {items.map(r => (
                        <ReservationCard
                          key={r.id}
                          r={r}
                          serviceNames={r.serviceIds.map(sid => services.find(s => s.id === sid)?.name).filter(Boolean) as string[]}
                          servicePrice={r.serviceIds.reduce((s, sid) => s + (services.find(x => x.id === sid)?.price ?? 0), 0)}
                          onCancel={() => handleCancel(r.id)}
                          onArrive={() => handleArrive(r.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <AnimatePresence>
        {showForm && (
          <ReservationForm
            initialHour={showForm.hour}
            initialDate={selectedDate}
            services={services}
            bays={bays}
            customers={customers}
            customerByPhone={customerByPhone}
            onSubmit={async (payload) => {
              try {
                const id = await addReservation(payload);
                if (!id) { showToast('ثبت رزرو ناموفق بود'); return; }
                setShowForm(null);
                showToast('رزرو با موفقیت ثبت شد ✓');
              } catch {
                showToast('خطا در ثبت رزرو');
              }
            }}
            onClose={() => setShowForm(null)}
          />
        )}

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ReservationCard = ({ r, serviceNames, servicePrice, onCancel, onArrive }: any) => {
  const badge = statusBadge[r.status as ReservationStatus];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gradient-to-br from-white to-gray-50 border border-gray-100 rounded-2xl p-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-gray-900 text-sm">{r.customerName}</span>
            <span className={clsx('text-[9px] px-1.5 py-0.5 rounded-md border font-bold', badge.cls)}>{badge.label}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-3 flex-wrap font-mono">
            <span className="flex items-center gap-1"><Clock size={10} />{fmtTime(r.scheduledAt)}</span>
            <span className="flex items-center gap-1"><Phone size={10} />{r.customerPhone}</span>
            <span className="flex items-center gap-1"><Car size={10} />{r.customerPlate}</span>
          </div>
          {serviceNames.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {serviceNames.map((n: string, i: number) => (
                <span key={i} className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-md font-medium">{n}</span>
              ))}
              {servicePrice > 0 && (
                <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-mono font-bold">
                  ≈ {servicePrice.toLocaleString('fa-IR')} ت
                </span>
              )}
            </div>
          )}
        </div>
        {r.status !== 'arrived' && r.status !== 'cancelled' && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onArrive}
              title="مشتری حاضر شد"
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl p-2 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={onCancel}
              title="لغو"
              className="bg-gray-100 hover:bg-brand-100 hover:text-brand-600 text-gray-500 rounded-xl p-2 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const ReservationForm = ({
  initialHour, initialDate, services, bays, customers, customerByPhone, onSubmit, onClose
}: any) => {
  const [date, setDate] = useState(initialDate);
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(0);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [bayId, setBayId] = useState<string | undefined>();
  const [notes, setNotes] = useState('');

  const handlePhone = (val: string) => {
    setPhone(val);
    const c = customerByPhone(val);
    if (c) { setName(c.name); setPlate(c.plate); }
  };

  const totalPrice = serviceIds.reduce((s, sid) => s + (services.find((x: any) => x.id === sid)?.price ?? 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hour, minute, 0, 0);
    onSubmit({
      customerName: name, customerPhone: phone, customerPlate: plate,
      bayId, scheduledAt: scheduledAt.toISOString(), serviceIds, notes
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 250, damping: 25 }}
        dir="rtl"
        className="relative w-full md:max-w-xl bg-white rounded-t-[2rem] md:rounded-[2rem] shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 flex justify-between items-center border-b border-gray-100">
          <div>
            <h2 className="text-xl font-extrabold">رزرو جدید</h2>
            <p className="text-xs text-gray-500 mt-0.5">انتخاب زمان، مشتری و خدمات</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 bg-gray-50 rounded-full"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Time */}
          <div>
            <label className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <Clock size={13} /> زمان رزرو
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateKey(date)}
                onChange={e => setDate(new Date(e.target.value))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <div className="flex gap-1">
                <select value={hour} onChange={e => setHour(Number(e.target.value))} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2.5 text-sm font-mono focus:outline-none">
                  {ALL_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                </select>
                <select value={minute} onChange={e => setMinute(Number(e.target.value))} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2.5 text-sm font-mono focus:outline-none">
                  {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">تلفن</label>
              <input required value={phone} onChange={e => handlePhone(e.target.value)} placeholder="0912..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">نام مشتری</label>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="نام و نام خانوادگی" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">پلاک</label>
              <IranPlateInput required value={plate} onChange={setPlate} />
            </div>
          </div>

          {/* Services */}
          <div>
            <label className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <Tag size={13} /> خدمات (می‌توانید چند مورد انتخاب کنید)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {services.map((s: any) => {
                const active = serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id} type="button"
                    onClick={() => setServiceIds(prev => active ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                    className={clsx(
                      'text-right border rounded-xl px-3 py-2 transition-all',
                      active ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500/20' : 'bg-white border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="text-xs font-bold text-gray-900">{s.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{s.price.toLocaleString('fa-IR')} ت • {s.durationMinutes}د</div>
                  </button>
                );
              })}
            </div>
            {totalPrice > 0 && (
              <div className="mt-2 text-xs text-gray-600">جمع تقریبی: <span className="font-mono font-bold">{totalPrice.toLocaleString('fa-IR')} ت</span></div>
            )}
          </div>

          {/* Bay (optional) */}
          <div>
            <label className="text-xs font-bold text-gray-700 mb-2 block">جایگاه (اختیاری)</label>
            <select value={bayId ?? ''} onChange={e => setBayId(e.target.value || undefined)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
              <option value="">هر جایگاه آزادی</option>
              {bays.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <MessageSquare size={13} /> توضیحات (اختیاری)
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="درخواست خاص مشتری..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          </div>

          <button type="submit" className="w-full bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-brand-500/25">
            ثبت رزرو
          </button>
        </div>
      </motion.form>
    </div>
  );
};

export default ReservationsView;
