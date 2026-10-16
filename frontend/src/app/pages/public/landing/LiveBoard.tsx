import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Car, Clock, Droplets, Sparkles, Wind, Check, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { fa, faNum } from '../../../components/landing/kit';

/**
 * The carwash floor, running by itself, on the first screen of the site.
 *
 * A screenshot says a product exists. This says what it does: cars arrive, take a bay, move
 * through their steps, pay and leave, and the ones that arrive with every bay busy wait in a
 * numbered line until one frees up. That is the whole operating idea of SmartWash, shown
 * rather than claimed — and it is the same board the operator uses all day, in miniature.
 *
 * It is also an invitation. The visitor can push a car to its next step or pull the first car
 * out of the queue, and the board keeps running underneath. Someone who has moved a car once
 * already knows how the product works.
 */

type Stage = 'received' | 'washing' | 'drying' | 'ready';

const STAGE: Record<Stage, { label: string; next?: Stage; action?: string; icon: React.ReactNode; ring: string; chip: string; bar: string }> = {
  received: { label: 'پذیرش', next: 'washing', action: 'شروع شستشو', icon: <Car size={13} />, ring: 'ring-slate-200', chip: 'bg-slate-100 text-slate-600', bar: 'bg-slate-300' },
  washing: { label: 'شستشو', next: 'drying', action: 'پایان شستشو', icon: <Droplets size={13} />, ring: 'ring-sky-200', chip: 'bg-sky-100 text-sky-700', bar: 'bg-sky-400' },
  drying: { label: 'خشک‌کردن', next: 'ready', action: 'آماده تحویل', icon: <Wind size={13} />, ring: 'ring-violet-200', chip: 'bg-violet-100 text-violet-700', bar: 'bg-violet-400' },
  ready: { label: 'آماده تحویل', action: 'تسویه و تحویل', icon: <Sparkles size={13} />, ring: 'ring-emerald-200', chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400' },
};

/** The journey, in order, so a progress bar knows what is behind a car and what is ahead. */
const ORDER: Stage[] = ['received', 'washing', 'drying', 'ready'];

const PLATES = ['۱۲ ب ۳۴۵ ایران ۱۱', '۴۴ د ۲۲۲ ایران ۳۳', '۵۵ ج ۵۵۵ ایران ۵۵', '۷۷ س ۱۲۳ ایران ۱۰',
  '۲۳ الف ۴۵۶ ایران ۱۱', '۶۸ ط ۹۰۱ ایران ۲۲', '۳۱ ل ۷۷۷ ایران ۴۴', '۹۰ ق ۲۴۶ ایران ۶۶'];
const NAMES = ['رضا محمدی', 'سارا کریمی', 'نگار رضوی', 'امیر شریفی', 'پریسا صبوری', 'کاوه احمدی', 'مینا تهرانی', 'حسین نوری'];
const SERVICES = [
  { name: 'شستشوی معمولی', toman: 50_000 },
  { name: 'شستشوی کامل', toman: 90_000 },
  { name: 'نظافت داخل خودرو', toman: 70_000 },
];

type BoardCar = { id: number; plate: string; owner: string; service: typeof SERVICES[number]; stage: Stage; since: number };
type Bay = { id: number; name: string; car: BoardCar | null };

const freshCar = (id: number): BoardCar => ({
  id,
  plate: PLATES[id % PLATES.length],
  owner: NAMES[id % NAMES.length],
  service: SERVICES[id % SERVICES.length],
  stage: 'received',
  since: Date.now(),
});

export const LiveBoard = ({ compact = false }: { compact?: boolean }) => {
  const still = useReducedMotion();
  const seed = useRef(4);
  const [bays, setBays] = useState<Bay[]>(() => [
    { id: 1, name: 'شستشو ۱', car: { ...freshCar(1), stage: 'washing' } },
    { id: 2, name: 'شستشو ۲', car: { ...freshCar(2), stage: 'drying' } },
    { id: 3, name: 'شستشو ۳', car: null },
  ]);
  const [queue, setQueue] = useState<BoardCar[]>(() => [freshCar(3)]);
  const [served, setServed] = useState(38);
  const [earned, setEarned] = useState(2_140_000);
  const [touched, setTouched] = useState(false);

  /** Takes the first car in line into a free bay — the move the real board offers. */
  const admit = useCallback(() => {
    setQueue(q => {
      if (q.length === 0) return q;
      let moved = false;
      setBays(bs => bs.map(b => {
        if (moved || b.car) return b;
        moved = true;
        return { ...b, car: { ...q[0], stage: 'washing', since: Date.now() } };
      }));
      return moved ? q.slice(1) : q;
    });
  }, []);

  /** One step forward for the car in a bay; from "ready" it is paid for and driven away. */
  const advance = useCallback((bayId: number) => {
    setBays(bs => bs.map(b => {
      if (b.id !== bayId || !b.car) return b;
      const next = STAGE[b.car.stage].next;
      if (next) return { ...b, car: { ...b.car, stage: next, since: Date.now() } };
      setServed(s => s + 1);
      setEarned(e => e + b.car!.service.toman * 10);
      return { ...b, car: null };
    }));
    window.setTimeout(admit, 420);
  }, [admit]);

  // The floor keeps working whether or not anyone touches it: cars arrive, steps complete.
  useEffect(() => {
    if (still) return;
    const tick = window.setInterval(() => {
      setBays(bs => {
        const busy = bs.filter(b => b.car);
        if (busy.length === 0) return bs;
        const oldest = busy.reduce((a, b) => (a.car!.since < b.car!.since ? a : b));
        if (Date.now() - oldest.car!.since < 3400) return bs;
        return bs.map(b => {
          if (b.id !== oldest.id || !b.car) return b;
          const next = STAGE[b.car.stage].next;
          if (next) return { ...b, car: { ...b.car, stage: next, since: Date.now() } };
          setServed(s => s + 1);
          setEarned(e => e + b.car!.service.toman * 10);
          return { ...b, car: null };
        });
      });
      admit();
      setQueue(q => (q.length < 3 && Math.random() > 0.55 ? [...q, freshCar((seed.current += 1))] : q));
    }, 1700);
    return () => window.clearInterval(tick);
  }, [admit, still]);

  const free = bays.filter(b => !b.car).length;
  const stats = useMemo(() => ([
    { label: 'خودروی امروز', value: faNum(served) },
    { label: 'جایگاه آزاد', value: fa(free) },
    { label: 'در صف', value: fa(queue.length) },
    { label: 'فروش امروز', value: `${faNum(Math.round(earned / 10))} ت` },
  ]), [served, free, queue.length, earned]);

  return (
    <div className={clsx('sw-board', compact && 'sw-board-compact')} dir="rtl">
      <div className="sw-board-bar">
        <span className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <span className="sw-live-dot" />
          <span>تابلوی زنده‌ی کارواش</span>
        </span>
        <span className="hidden gap-1.5 sm:flex">
          {stats.map(s => (
            <span key={s.label} className="rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/70">
              <span className="text-slate-400">{s.label} </span>{s.value}
            </span>
          ))}
        </span>
      </div>

      <div className="sw-board-grid">
        {bays.map(bay => (
          <div key={bay.id} className={clsx('sw-bay', bay.car ? `ring-2 ${STAGE[bay.car.stage].ring}` : 'sw-bay-free')}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-700">{bay.name}</span>
              {bay.car ? (
                <span className={clsx('flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold', STAGE[bay.car.stage].chip)}>
                  {STAGE[bay.car.stage].icon}<span>{STAGE[bay.car.stage].label}</span>
                </span>
              ) : (
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">آزاد</span>
              )}
            </div>

            <div className="sw-bay-body">
              <AnimatePresence mode="popLayout">
                {bay.car ? (
                  <motion.div
                    key={bay.car.id}
                    layout
                    initial={still ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={still ? { opacity: 0 } : { opacity: 0, x: -40, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                    className="flex h-full flex-col justify-between"
                  >
                    <div>
                      <div className="font-mono text-[13px] font-extrabold tracking-tight text-slate-900">{bay.car.plate}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{bay.car.owner} · {bay.car.service.name}</div>
                    </div>

                    <div className="mt-2">
                      <div className="sw-bay-track">
                        {ORDER.map((s, i) => {
                          const at = ORDER.indexOf(bay.car!.stage);
                          return (
                            <span key={s} className={clsx('sw-bay-seg',
                              i === at ? STAGE[s].bar : i < at ? 'bg-slate-200' : 'bg-slate-100')} />
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setTouched(true); advance(bay.id); }}
                        className="sw-bay-action"
                      >
                        <ArrowLeft size={11} />
                        <span>{STAGE[bay.car.stage].action}</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex h-full flex-col items-center justify-center gap-1 text-slate-300"
                  >
                    <Car size={20} />
                    <span className="text-[10px] font-bold">آماده‌ی خودروی بعدی</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      <div className="sw-queue">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600">
            <Clock size={12} className="text-amber-500" />
            <span>صف رزروها</span>
          </span>
          <span className="text-[10px] text-slate-400">
            {queue.length > 0 ? `${fa(queue.length)} خودرو منتظر جایگاه` : 'کسی منتظر نیست'}
          </span>
        </div>
        <div className="flex min-h-[46px] flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {queue.map((car, i) => (
              <motion.button
                key={car.id}
                layout
                type="button"
                onClick={() => { setTouched(true); admit(); }}
                disabled={free === 0 || i > 0}
                initial={still ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={still ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                className={clsx('sw-queue-car', i === 0 && free > 0 && 'sw-queue-car-ready')}
                title={i === 0 && free > 0 ? 'ورود به جایگاه آزاد' : 'منتظر آزاد شدن جایگاه'}
              >
                <span className="sw-queue-num">{fa(i + 1)}</span>
                <span className="font-mono text-[11px] font-bold">{car.plate}</span>
                {i === 0 && free > 0 && <Check size={11} className="text-emerald-600" />}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <p className={clsx('sw-board-hint', touched && 'opacity-0')}>
        روی دکمه‌ی هر خودرو بزنید تا مرحله‌اش جلو برود — همان کاری که اپراتور انجام می‌دهد.
      </p>
    </div>
  );
};
