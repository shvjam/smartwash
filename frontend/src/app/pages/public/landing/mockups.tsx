import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import {
  BarChart3, BatteryFull, Bell, Building2, CalendarClock, Car, Check, CheckCheck, ChevronLeft, Gift,
  LayoutGrid, Lock, LockOpen, MessageSquare, Plus, Signal, Sparkles, Users, Wallet, Wifi,
} from 'lucide-react';

/*
 * Product mockups, drawn in HTML so they stay sharp, weigh nothing and show the real panel:
 * the same stage names, colours and rules the bay board uses. Every size is in em, so a
 * mockup is scaled by setting one font-size on it.
 */

const fa = (n: number) => n.toLocaleString('fa-IR');
const fa2 = (n: number) => n.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });
const clock = (sec: number) => `${fa2(Math.floor(sec / 60) % 60)}:${fa2(sec % 60)}`;

/** A counter that advances while the mockup is on screen (frozen for reduced motion). */
const useTick = (ms = 1000) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '120px' });
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = window.setInterval(() => setN(x => x + 1), ms);
    return () => window.clearInterval(id);
  }, [inView, reduced, ms]);
  return [ref, n] as const;
};

/* ── the stages, as the bay board colours them ────────────────────────────── */

const STAGE = {
  received: { label: 'پذیرش', dot: '#9ca3af' },
  washing: { label: 'در حال شستشو', dot: '#3b82f6' },
  queuedDry: { label: 'صف خشک', dot: '#f59e0b' },
  drying: { label: 'خشک‌کردن', dot: '#f97316' },
  options: { label: 'خدمات آپشن', dot: '#8b5cf6' },
  ready: { label: 'آماده تحویل', dot: '#14b8a6' },
  delivered: { label: 'تحویل شد', dot: '#10b981' },
} as const;
type StageKey = keyof typeof STAGE;

const StageChip = ({ stage, className }: { stage: StageKey; className?: string }) => (
  <span className={`inline-flex items-center gap-[.4em] rounded-full bg-white/[.07] px-[.6em] py-[.22em] text-[.68em] font-medium text-white/85 ${className ?? ''}`}>
    <span className="size-[.5em] rounded-full" style={{ background: STAGE[stage].dot, boxShadow: `0 0 .6em ${STAGE[stage].dot}` }} />
    {STAGE[stage].label}
  </span>
);

/* ── Iranian number plate ─────────────────────────────────────────────────── */

export const Plate = ({ two, letter, three, region, className }: {
  two: string; letter: string; three: string; region: string; className?: string;
}) => (
  <span dir="ltr" className={`inline-flex h-[1.9em] items-stretch overflow-hidden rounded-[.32em] bg-white text-[#111] shadow-[0_0_0_1px_rgba(0,0,0,.6)] ${className ?? ''}`}>
    <span className="flex w-[1.05em] flex-col items-center justify-end bg-[#1f4fb8] pb-[.15em]">
      <span className="mb-auto mt-[.18em] flex h-[.5em] w-[.62em] flex-col overflow-hidden rounded-[.05em]">
        <span className="flex-1 bg-[#239f40]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-[#da0000]" />
      </span>
      <span className="text-[.26em] font-bold leading-none text-white">I.R.</span>
      <span className="text-[.26em] font-bold leading-none text-white">IRAN</span>
    </span>
    <span className="flex items-center gap-[.22em] px-[.4em] text-[1.02em] font-bold leading-none">
      <span>{two}</span><span className="text-[.9em]">{letter}</span><span>{three}</span>
    </span>
    <span className="flex w-[1.7em] flex-col items-center justify-center border-l border-black/70 leading-none">
      <span className="text-[.34em] font-medium">ایران</span>
      <span className="text-[.86em] font-bold">{region}</span>
    </span>
  </span>
);

/* ── device frames ────────────────────────────────────────────────────────── */

const StatusBar = () => (
  <div className="relative z-10 flex items-center justify-between px-[1.7em] pt-[.95em] text-[.72em] font-semibold text-white">
    <span dir="ltr">{fa(9)}:{fa2(41)}</span>
    <span className="flex items-center gap-[.35em]" dir="ltr">
      <Signal className="size-[1.1em]" /><Wifi className="size-[1.1em]" /><BatteryFull className="size-[1.35em]" />
    </span>
  </div>
);

export const PhoneFrame = ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`relative w-[20em] ${className ?? ''}`} style={style}>
    <div className="relative aspect-[9/19.2] rounded-[3.1em] bg-gradient-to-b from-[#4a3c40] via-[#2b2427] to-[#1c1719] p-[.5em] shadow-[0_3em_6em_-1em_rgba(0,0,0,.85),inset_0_0_0_.12em_rgba(255,255,255,.12)]">
      <span className="absolute -left-[.2em] top-[7em] h-[2.2em] w-[.25em] rounded-l bg-[#3a3034]" />
      <span className="absolute -left-[.2em] top-[10.2em] h-[3.6em] w-[.25em] rounded-l bg-[#3a3034]" />
      <span className="absolute -right-[.2em] top-[9em] h-[4.6em] w-[.25em] rounded-r bg-[#3a3034]" />
      <div dir="rtl" className="relative h-full overflow-hidden rounded-[2.65em] bg-[#0d0b0c] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_70%_0%,rgba(220,38,38,.42),transparent_60%),radial-gradient(90%_50%_at_10%_100%,rgba(120,20,20,.35),transparent_70%)]" />
        <span className="absolute left-1/2 top-[.62em] z-20 h-[1.75em] w-[6.2em] -translate-x-1/2 rounded-full bg-black" />
        <StatusBar />
        <div className="relative z-10 h-full">{children}</div>
      </div>
    </div>
  </div>
);

export const TabletFrame = ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`relative w-[43em] ${className ?? ''}`} style={style}>
    <div className="relative aspect-[4/2.85] rounded-[2.2em] bg-gradient-to-b from-[#3d3437] to-[#1b1719] p-[.75em] shadow-[0_3em_6em_-1em_rgba(0,0,0,.85),inset_0_0_0_.12em_rgba(255,255,255,.1)]">
      <div dir="rtl" className="relative h-full overflow-hidden rounded-[1.55em] bg-[#0f0d0e] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_85%_0%,rgba(220,38,38,.3),transparent_60%)]" />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  </div>
);

/* ── screens ──────────────────────────────────────────────────────────────── */

const Avatar = ({ label, className }: { label: string; className?: string }) => (
  <span className={`grid size-[2.6em] place-items-center rounded-full bg-gradient-to-br from-[#ef4444] to-[#7f1d1d] text-[.8em] font-bold shadow-[0_0_0_.18em_rgba(255,255,255,.08)] ${className ?? ''}`}>{label}</span>
);

type Bay = { name: string; kind: string; stage: StageKey | null; plate?: [string, string, string, string]; start: number; total: number };

/** The operator's bay board, on the phone at the reception desk. */
export const BoardScreen = () => {
  const [ref, t] = useTick(1000);
  const phase = Math.floor(t / 5) % 4;
  const bay2: StageKey = (['drying', 'options', 'ready', 'ready'] as const)[phase];
  const bays: Bay[] = [
    { name: 'جایگاه ۱', kind: 'شستشو', stage: 'washing', plate: ['۲۴', 'ج', '۵۱۷', '۱۱'], start: 372, total: 900 },
    { name: 'جایگاه ۲', kind: 'خشک', stage: bay2, plate: ['۶۸', 'ب', '۳۴۲', '۲۲'], start: 188, total: 600 },
    { name: 'جایگاه ۳', kind: 'شستشو', stage: 'received', plate: ['۱۵', 'د', '۹۰۸', '۷۷'], start: 41, total: 900 },
    { name: 'جایگاه ۴', kind: 'شستشو', stage: phase >= 2 ? 'received' : null, plate: ['۳۳', 'س', '۱۲۶', '۴۴'], start: 0, total: 900 },
  ];
  return (
    <div ref={ref} className="flex h-full flex-col px-[1.15em] pb-[1.4em] pt-[1.5em]">
      <div className="flex items-center gap-[.7em]">
        <Avatar label="ر" />
        <div className="leading-tight">
          <div className="text-[.92em] text-white/55">سلام،</div>
          <div className="text-[1em] font-semibold">رضا · شیفت عصر</div>
        </div>
        <span className="ms-auto grid size-[2.5em] place-items-center rounded-full border border-white/15 bg-white/[.04]">
          <Bell className="size-[1.05em]" />
        </span>
      </div>
      <div className="mt-[1.3em] flex items-end justify-between border-t border-white/10 pt-[1em]">
        <div>
          <div className="text-[1.75em] font-bold leading-[1.15]">تابلوی<br />جایگاه‌ها</div>
        </div>
        <div className="text-left">
          <div className="flex items-center justify-end gap-[.3em] text-[.62em] text-white/55">
            <span className="size-[.55em] animate-pulse rounded-full bg-[#ef4444]" /> زنده
          </div>
          <div className="text-[2.35em] font-bold leading-none">{fa(47 + Math.floor(t / 9))}</div>
          <div className="text-[.62em] text-white/55">خودرو امروز</div>
        </div>
      </div>
      <div className="mt-[1em] grid grid-cols-2 gap-[.55em]">
        {bays.map(b => {
          const elapsed = b.start + t;
          if (!b.stage) {
            return (
              <div key={b.name} className="flex min-h-[7.2em] flex-col items-center justify-center gap-[.35em] rounded-[1.1em] border border-dashed border-white/20 text-white/55">
                <span className="grid size-[2em] place-items-center rounded-full bg-white/[.06]"><Plus className="size-[1em]" /></span>
                <span className="text-[.7em]">{b.name} · ثبت سفارش</span>
              </div>
            );
          }
          const pct = Math.min(100, (elapsed / b.total) * 100);
          return (
            <div key={b.name} className="flex min-h-[7.2em] flex-col gap-[.45em] rounded-[1.1em] bg-white/[.06] p-[.7em] shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
              <div className="flex items-center justify-between text-[.66em] text-white/60">
                <span className="font-semibold text-white/90">{b.name}</span><span>{b.kind}</span>
              </div>
              {b.plate && <Plate two={b.plate[0]} letter={b.plate[1]} three={b.plate[2]} region={b.plate[3]} className="self-start text-[.72em]" />}
              <StageChip stage={b.stage} className="self-start" />
              <div className="mt-auto flex items-center gap-[.4em]">
                <span className="h-[.25em] flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%`, background: STAGE[b.stage].dot }} />
                </span>
                <span dir="ltr" className="text-[.6em] tabular-nums text-white/60">{clock(elapsed)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-[.75em] flex items-center gap-[.5em] rounded-[1em] bg-[#f59e0b]/[.1] px-[.8em] py-[.6em] text-[.68em] text-[#fcd34d]">
        <CalendarClock className="size-[1.25em]" />
        <span>صف رزرو: نوبت {fa(1)} · ساعت {fa(17)}:{fa2(30)}</span>
        <span className="ms-auto rounded-full bg-[#f59e0b]/20 px-[.55em] py-[.1em]">در انتظار جایگاه</span>
      </div>
    </div>
  );
};

const toman = (n: number) => `${fa(n)} تومان`;

/** One order: the journey, the bill, and the delivery button that waits for the money. */
export const OrderScreen = () => {
  const [ref, t] = useTick(140);
  const cycle = t % 70;
  const paid = Math.min(550_000, 300_000 + Math.max(0, cycle - 18) * 12_500);
  const due = 550_000 - paid;
  const settled = due === 0;
  const steps: { k: StageKey; time: string; done: boolean }[] = [
    { k: 'received', time: '۱۰:۰۲', done: true },
    { k: 'washing', time: '۱۰:۰۵', done: true },
    { k: 'drying', time: '۱۰:۲۱', done: true },
    { k: 'options', time: '۱۰:۳۰', done: true },
    { k: 'ready', time: '۱۰:۴۴', done: true },
    { k: 'delivered', time: settled ? '۱۰:۵۱' : '—', done: settled },
  ];
  return (
    <div ref={ref} className="flex h-full flex-col px-[1.15em] pb-[1.4em] pt-[1.6em]">
      <div className="flex items-center justify-between">
        <span className="grid size-[2.3em] place-items-center rounded-full bg-white/[.06]"><ChevronLeft className="size-[1.1em] rotate-180" /></span>
        <span className="text-[.8em] text-white/60">سفارش {fa(1248)}</span>
      </div>
      <div className="mt-[1em] flex items-center justify-between">
        <div>
          <div className="text-[1.15em] font-semibold">پژو ۲۰۶ · سفید</div>
          <div className="text-[.68em] text-white/55">علی محمدی · مشتری باشگاه</div>
        </div>
        <Plate two="۶۸" letter="ب" three="۳۴۲" region="۲۲" className="text-[.8em]" />
      </div>
      <div className="mt-[1.1em] space-y-[.5em] rounded-[1.1em] bg-white/[.05] p-[.85em]">
        {steps.map((s, i) => (
          <div key={s.k} className="flex items-center gap-[.6em] text-[.72em]">
            <span className="relative grid size-[1.35em] place-items-center rounded-full" style={{ background: s.done ? STAGE[s.k].dot : 'rgba(255,255,255,.1)' }}>
              {s.done ? <Check className="size-[.8em]" strokeWidth={3} /> : <Lock className="size-[.7em] text-white/50" />}
              {i < steps.length - 1 && <span className="absolute top-full h-[.5em] w-px bg-white/15" />}
            </span>
            <span className={s.done ? 'text-white' : 'text-white/45'}>{STAGE[s.k].label}</span>
            {s.k === 'ready' && <span className="rounded-full bg-[#14b8a6]/15 px-[.5em] text-[.85em] text-[#5eead4]">جایگاه ۲ آزاد شد</span>}
            <span dir="ltr" className="ms-auto text-white/45">{s.time}</span>
          </div>
        ))}
      </div>
      <div className="mt-[.8em] space-y-[.35em] text-[.72em]">
        <div className="flex justify-between text-white/70"><span>شستشوی کامل</span><span>{toman(350_000)}</span></div>
        <div className="flex justify-between text-white/70"><span>واکس بدنه</span><span>{toman(200_000)}</span></div>
        <div className="flex justify-between border-t border-white/10 pt-[.4em] font-semibold"><span>مانده</span>
          <span className={settled ? 'text-[#34d399]' : 'text-[#fca5a5]'}>{toman(due)}</span></div>
      </div>
      <div className="mt-auto space-y-[.5em] pt-[.8em]">
        <div className="h-[.3em] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#10b981] transition-[width] duration-150" style={{ width: `${(paid / 550_000) * 100}%` }} />
        </div>
        <div className={`flex items-center justify-center gap-[.45em] rounded-[1em] py-[.85em] text-[.8em] font-semibold transition-colors duration-500 ${settled ? 'bg-[#10b981] text-white' : 'bg-white/[.07] text-white/50'}`}>
          {settled ? <LockOpen className="size-[1.1em]" /> : <Lock className="size-[1.1em]" />}
          {settled ? 'تحویل خودرو' : 'تحویل پس از تسویه'}
        </div>
      </div>
    </div>
  );
};

/** A customer's club card: visits toward the free wash, wallet, and the next reminder. */
export const LoyaltyScreen = () => {
  const [ref, t] = useTick(2400);
  const stamps = (t % 3) + 1;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div ref={ref} className="flex h-full flex-col px-[1.15em] pb-[1.4em] pt-[1.6em]">
      <div className="flex items-center gap-[.7em]">
        <Avatar label="م" />
        <div className="leading-tight">
          <div className="text-[1em] font-semibold">مریم کریمی</div>
          <div className="text-[.66em] text-white/55">{fa(18)} مراجعه · دو خودرو</div>
        </div>
        <span className="ms-auto grid size-[2.5em] place-items-center rounded-full border border-white/15 bg-white/[.04]"><Bell className="size-[1.05em]" /></span>
      </div>
      <div className="relative mx-auto mt-[1.3em] grid size-[13em] place-items-center">
        <div className="absolute inset-[8%] rounded-full bg-[#dc2626]/25 blur-[1.6em]" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="url(#swl-loy)" strokeWidth="3.4" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - stamps / 3)} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.19,1,.22,1)' }} />
          <defs><linearGradient id="swl-loy"><stop offset="0" stopColor="#fecaca" /><stop offset="1" stopColor="#ef4444" /></linearGradient></defs>
        </svg>
        <div className="relative text-center">
          <div className="text-[.7em] text-white/60">باشگاه مشتریان</div>
          <div className="text-[2.6em] font-bold leading-[1.15]">{fa(stamps)}<span className="text-[.45em] text-white/50"> از {fa(3)}</span></div>
          <div className="mx-auto mt-[.35em] w-fit rounded-full border border-[#fca5a5]/50 bg-[#dc2626]/20 px-[.85em] py-[.25em] text-[.66em]">
            {stamps === 3 ? 'شستشوی بعدی رایگان' : `${fa(3 - stamps)} مراجعه تا رایگان`}
          </div>
        </div>
      </div>
      <div className="mt-[1.1em] grid grid-cols-2 gap-[.55em] text-[.7em]">
        <div className="rounded-[1.1em] bg-white/[.06] p-[.9em]">
          <Wallet className="mb-[.5em] size-[1.3em] text-[#fca5a5]" />
          <div className="text-white/55">کیف پول</div>
          <div className="text-[1.2em] font-semibold">{toman(120_000)}</div>
        </div>
        <div className="rounded-[1.1em] bg-white/[.06] p-[.9em]">
          <MessageSquare className="mb-[.5em] size-[1.3em] text-[#fca5a5]" />
          <div className="text-white/55">یادآور بعدی</div>
          <div className="text-[1.2em] font-semibold">{fa(21)} مهر</div>
        </div>
      </div>
      <div className="mt-[.6em] rounded-[1.1em] bg-white/[.06] p-[.9em] text-[.7em]">
        <div className="mb-[.5em] text-white/55">خودروها</div>
        <div className="flex gap-[.5em]">
          <Plate two="۲۴" letter="ج" three="۵۱۷" region="۱۱" className="text-[.95em]" />
          <Plate two="۸۱" letter="ه" three="۶۰۳" region="۱۰" className="text-[.95em]" />
        </div>
      </div>
    </div>
  );
};

/** The owner's view across branches: one report, every site. */
export const BranchesScreen = () => {
  const [ref, t] = useTick(2600);
  const branches = [
    { name: 'ونک', bays: 4, cars: 58, sales: 9.4, bars: [52, 64, 48, 72, 80, 66, 90] },
    { name: 'سعادت‌آباد', bays: 3, cars: 41, sales: 7.1, bars: [40, 46, 58, 50, 62, 70, 64] },
    { name: 'پاسداران', bays: 2, cars: 33, sales: 5.6, bars: [30, 38, 34, 44, 40, 52, 48] },
  ];
  const colors = ['#ef4444', '#fca5a5', '#7f1d1d'];
  const wobble = (v: number, i: number) => Math.max(18, Math.min(100, v + Math.sin(t * 1.3 + i) * 8));
  return (
    <div ref={ref} className="flex h-full">
      <aside className="flex w-[4.2em] flex-col items-center gap-[1.1em] border-l border-white/[.07] py-[1.3em] text-white/45">
        <span className="grid size-[2.3em] place-items-center rounded-[.8em] bg-[#dc2626] text-white"><BarChart3 className="size-[1.1em]" /></span>
        <LayoutGrid className="size-[1.15em]" /><CalendarClock className="size-[1.15em]" /><Users className="size-[1.15em]" /><Wallet className="size-[1.15em]" /><Building2 className="size-[1.15em]" />
      </aside>
      <div className="flex-1 p-[1.4em]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[.7em] text-white/50">گزارش یک‌جا · همه‌ی شعبه‌ها</div>
            <div className="text-[1.3em] font-semibold">امروز، سه شعبه</div>
          </div>
          <div className="flex gap-[.35em] text-[.66em]">
            {['امروز', 'هفته', 'ماه'].map((l, i) => (
              <span key={l} className={`rounded-full px-[.8em] py-[.3em] ${i === 0 ? 'bg-white text-black' : 'bg-white/[.07] text-white/60'}`}>{l}</span>
            ))}
          </div>
        </div>
        <div className="mt-[1em] grid grid-cols-3 gap-[.7em]">
          {[
            { l: 'فروش', v: `${fa(22.1)} میلیون`, d: '+۱۲٪' },
            { l: 'خودرو', v: fa(132), d: '+۸٪' },
            { l: 'میانگین زمان هر خودرو', v: `${fa(38)} دقیقه`, d: '−۴ دقیقه' },
          ].map(k => (
            <div key={k.l} className="rounded-[1em] bg-white/[.05] p-[.8em] shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]">
              <div className="text-[.62em] text-white/50">{k.l}</div>
              <div className="mt-[.2em] text-[1.05em] font-semibold">{k.v}</div>
              <div className="text-[.6em] text-[#34d399]">{k.d}</div>
            </div>
          ))}
        </div>
        <div className="mt-[.8em] grid grid-cols-[1.5fr_1fr] gap-[.7em]">
          <div className="rounded-[1em] bg-white/[.04] p-[.9em]">
            <div className="mb-[.6em] flex items-center justify-between text-[.64em] text-white/55">
              <span>فروش هفت روز گذشته</span>
              <span className="flex gap-[.6em]">{branches.map((b, i) => (
                <span key={b.name} className="flex items-center gap-[.25em]"><span className="size-[.55em] rounded-full" style={{ background: colors[i] }} />{b.name}</span>
              ))}</span>
            </div>
            <div className="flex h-[8.2em] items-end gap-[.55em]">
              {Array.from({ length: 7 }, (_, d) => (
                <div key={d} className="flex flex-1 items-end gap-[.12em]">
                  {branches.map((b, i) => (
                    <span key={b.name} className="flex-1 rounded-t-[.25em] transition-[height] duration-[1.2s] ease-[cubic-bezier(.19,1,.22,1)]"
                      style={{ height: `${wobble(b.bars[d], d + i)}%`, background: colors[i] }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-[.45em]">
            {branches.map((b, i) => (
              <div key={b.name} className="flex items-center gap-[.6em] rounded-[.9em] bg-white/[.05] p-[.6em] text-[.64em]">
                <span className="grid size-[2.1em] place-items-center rounded-[.6em]" style={{ background: `${colors[i]}33`, color: colors[i] === '#7f1d1d' ? '#fca5a5' : colors[i] }}>
                  <Building2 className="size-[1.1em]" />
                </span>
                <div className="leading-snug">
                  <div className="font-semibold text-white">{b.name}</div>
                  <div className="text-white/50">{fa(b.bays)} جایگاه · {fa(b.cars)} خودرو</div>
                </div>
                <span className="ms-auto font-semibold">{fa(b.sales)} م</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── floating widgets ─────────────────────────────────────────────────────── */

const Widget = ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`swl-widget ${className ?? ''}`} style={style}><div className="swl-widget-in">{children}</div></div>
);

export const IntakeWidget = () => {
  const [ref, t] = useTick(1800);
  const done = t % 2 === 1;
  return (
    <Widget>
      <div ref={ref} className="space-y-[.8em]">
        <div className="flex items-center justify-between"><span className="swl-widget-label">پذیرش جدید</span><Car className="size-[1.1em] text-white/50" /></div>
        <Plate two="۱۲" letter="ب" three="۳۴۵" region="۶۶" className="text-[1.05em]" />
        <div className="flex items-center gap-[.5em] text-[.78em]">
          <span className={`grid size-[1.5em] place-items-center rounded-full transition-all duration-500 ${done ? 'bg-[#10b981] scale-100' : 'bg-white/10 scale-90'}`}>
            <Check className="size-[.9em]" strokeWidth={3} />
          </span>
          <span>{done ? 'روی جایگاه ۳ ثبت شد' : 'انتخاب جایگاه…'}</span>
        </div>
      </div>
    </Widget>
  );
};

export const TimerWidget = () => {
  const [ref, t] = useTick(1000);
  const sec = 492 + t;
  const r = 40, c = 2 * Math.PI * r;
  const pct = (sec % 900) / 900;
  return (
    <Widget>
      <div ref={ref} className="flex flex-col items-center gap-[.6em]">
        <span className="swl-widget-label self-start">جایگاه ۱ · شستشو</span>
        <div className="relative grid size-[7.5em] place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
            <circle cx="50" cy="50" r={r} fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 4px #3b82f6)' }} />
          </svg>
          <div className="text-center">
            <div dir="ltr" className="text-[1.45em] font-bold tabular-nums">{clock(sec)}</div>
            <div className="text-[.65em] text-white/55">در حال شستشو</div>
          </div>
        </div>
      </div>
    </Widget>
  );
};

export const QueueWidget = () => {
  const [ref, t] = useTick(2200);
  const n = (t % 3) + 1;
  return (
    <Widget>
      <div ref={ref} className="space-y-[.7em]">
        <span className="swl-widget-label">صف رزرو</span>
        <div className="flex items-end gap-[.6em]">
          <span key={n} className="text-[3.4em] font-bold leading-none text-[#fcd34d]" style={{ animation: 'swl-pop-in .7s cubic-bezier(.19,1,.22,1)' }}>{fa(n)}</span>
          <span className="pb-[.4em] text-[.75em] leading-snug text-white/70">نوبت شما<br />رزرو ساعت {fa(17)}:{fa2(30)}</span>
        </div>
        <div className="rounded-[.8em] bg-[#f59e0b]/10 px-[.7em] py-[.45em] text-[.66em] text-[#fcd34d]">همه‌ی جایگاه‌ها پرند؛ با آزاد شدن اولین جایگاه، نوبت شما می‌رسد</div>
      </div>
    </Widget>
  );
};

export const SettleWidget = ({ wide }: { wide?: boolean }) => {
  const [ref, t] = useTick(120);
  const cycle = t % 60;
  const due = Math.max(0, 250_000 - Math.max(0, cycle - 10) * 10_000);
  const ok = due === 0;
  return (
    <Widget className={wide ? '!w-full' : ''}>
      <div ref={ref} className="space-y-[.7em]">
        <div className="flex items-center justify-between">
          <span className="swl-widget-label">مانده حساب</span>
          <span className={`grid size-[1.9em] place-items-center rounded-full transition-colors duration-500 ${ok ? 'bg-[#10b981]' : 'bg-white/10'}`}>
            {ok ? <LockOpen className="size-[1em]" /> : <Lock className="size-[1em]" />}
          </span>
        </div>
        <div className={`text-[1.5em] font-bold tabular-nums transition-colors ${ok ? 'text-[#34d399]' : 'text-white'}`}>{toman(due)}</div>
        <div className="h-[.32em] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#10b981]" style={{ width: `${(1 - due / 250_000) * 100}%` }} />
        </div>
        <div className="text-[.68em] text-white/60">{ok ? 'تسویه شد؛ دکمه‌ی تحویل باز است' : 'تا مانده صفر نشود، تحویل قفل است'}</div>
      </div>
    </Widget>
  );
};

export const ReadySmsWidget = () => {
  const [ref, t] = useTick(2600);
  const sent = t % 2 === 1;
  return (
    <Widget>
      <div ref={ref} className="space-y-[.7em]">
        <div className="flex items-center gap-[.45em]"><MessageSquare className="size-[1.05em] text-[#fca5a5]" /><span className="swl-widget-label">پیامک به مشتری</span></div>
        <div className="rounded-[1em] rounded-tr-[.3em] bg-white/[.08] p-[.75em] text-[.74em] leading-relaxed">
          کارواش ونک: خودروی ۲۴ج۵۱۷ آماده‌ی تحویل است.
        </div>
        <div className="flex items-center justify-end gap-[.3em] text-[.62em] text-white/55">
          {sent ? <><CheckCheck className="size-[1.2em] text-[#34d399]" /> تحویل داده شد</> : <span className="flex gap-[.25em]">{[0, 1, 2].map(i => <span key={i} className="size-[.45em] animate-bounce rounded-full bg-white/60" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
        </div>
      </div>
    </Widget>
  );
};

export const LoyaltyWidget = () => {
  const [ref, t] = useTick(1600);
  const filled = (t % 4);
  return (
    <Widget className="!w-full">
      <div ref={ref} className="space-y-[.9em]">
        <div className="flex items-center justify-between"><span className="swl-widget-label">کارت باشگاه · مریم کریمی</span><Gift className="size-[1.1em] text-[#fca5a5]" /></div>
        <div className="flex items-center justify-center gap-[.7em]">
          {[0, 1, 2].map(i => (
            <span key={i} className={`grid size-[3em] place-items-center rounded-full border transition-all duration-700 ${i < filled ? 'border-transparent bg-gradient-to-br from-[#ef4444] to-[#991b1b] shadow-[0_0_1.2em_rgba(239,68,68,.55)]' : 'border-white/20 bg-white/[.03]'}`}>
              {i === 2 ? <Gift className="size-[1.2em]" /> : <Car className="size-[1.2em]" />}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-[.8em] bg-white/[.06] px-[.8em] py-[.55em] text-[.72em]">
          <span className="text-white/60">کیف پول</span><span className="font-semibold">{toman(120_000)}</span>
        </div>
      </div>
    </Widget>
  );
};

export const StaffWidget = () => {
  const [ref, t] = useTick(2400);
  const people = [
    { n: 'حسین', cars: 14, share: 0.82 },
    { n: 'مهدی', cars: 11, share: 0.64 },
    { n: 'امیر', cars: 9, share: 0.52 },
  ];
  return (
    <Widget className="!w-full">
      <div ref={ref} className="space-y-[.75em]">
        <div className="flex items-center justify-between"><span className="swl-widget-label">سهم امروز پرسنل</span><Users className="size-[1.1em] text-white/50" /></div>
        {people.map((p, i) => (
          <div key={p.n} className="flex items-center gap-[.55em] text-[.72em]">
            <span className="grid size-[2em] place-items-center rounded-full bg-white/10 font-semibold">{p.n[0]}</span>
            <div className="flex-1">
              <div className="flex justify-between"><span>{p.n}</span><span className="text-white/55">{fa(p.cars + (i === t % 3 ? 1 : 0))} خودرو</span></div>
              <div className="mt-[.3em] h-[.3em] overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-l from-[#ef4444] to-[#fca5a5] transition-[width] duration-700" style={{ width: `${(p.share + (i === t % 3 ? 0.06 : 0)) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-center gap-[.4em] rounded-[.8em] bg-[#10b981]/15 py-[.5em] text-[.7em] text-[#6ee7b7]"><Check className="size-[1.1em]" /> تسویه‌ی انعام با یک دکمه</div>
      </div>
    </Widget>
  );
};

export const BusyHoursWidget = () => {
  const [ref, t] = useTick(1500);
  const hours = ['۹', '۱۱', '۱۳', '۱۵', '۱۷', '۱۹', '۲۱'];
  const days = ['ش', 'ی', 'د', 'س', 'چ'];
  const heat = (d: number, h: number) => {
    const peak = Math.exp(-Math.pow((h - 4.6) / 1.4, 2)) * 0.9 + (d === 4 ? 0.15 : 0);
    return Math.min(1, 0.12 + peak + Math.sin(t + d * 1.7 + h) * 0.07);
  };
  return (
    <Widget className="!w-full">
      <div ref={ref} className="space-y-[.7em]">
        <div className="flex items-center justify-between"><span className="swl-widget-label">ساعت‌های شلوغ</span><span className="rounded-full bg-[#dc2626]/20 px-[.6em] text-[.62em] text-[#fca5a5]">اوج: ۱۷ تا ۱۹</span></div>
        <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-[.28em] text-[.55em] text-white/45">
          <span />
          {hours.map(h => <span key={h} className="text-center">{h}</span>)}
          {days.map((d, di) => (
            <React.Fragment key={d}>
              <span className="pe-[.3em]">{d}</span>
              {hours.map((_, hi) => (
                <span key={hi} className="aspect-square rounded-[.35em] transition-colors duration-1000" style={{ background: `rgba(239,68,68,${heat(di, hi).toFixed(2)})` }} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Widget>
  );
};

export const CampaignWidget = () => {
  const [ref, t] = useTick(200);
  const sent = Math.min(480, (t % 60) * 12);
  return (
    <Widget className="!w-full">
      <div ref={ref} className="space-y-[.7em]">
        <div className="flex items-center justify-between"><span className="swl-widget-label">کمپین پیامکی</span><Sparkles className="size-[1.05em] text-[#fca5a5]" /></div>
        <div className="rounded-[1em] rounded-tr-[.3em] bg-white/[.08] p-[.7em] text-[.7em] leading-relaxed">
          یک ماه از آخرین شستشو گذشته؛ این هفته شستشوی کامل با ۱۵٪ تخفیف.
        </div>
        <div className="flex items-center justify-between text-[.64em] text-white/60"><span>مشتریان غایب بیش از ۳۰ روز</span><span className="tabular-nums">{fa(sent)} / {fa(480)}</span></div>
        <div className="h-[.3em] overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ef4444]" style={{ width: `${(sent / 480) * 100}%` }} /></div>
      </div>
    </Widget>
  );
};
