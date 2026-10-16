import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  LayoutGrid, Users, HardHat, LineChart, Check, Star, Gift, Clock,
  Wallet, Trophy, Receipt, Bell,
} from 'lucide-react';
import clsx from 'clsx';
import { Container, Reveal, SectionHead, fa, faNum } from '../../../components/landing/kit';
import { BrushMark, PhoneFrame } from '../../../components/landing/art';

/**
 * What the product is made of, shown as four working surfaces rather than a list of nouns.
 *
 * Feature grids all look alike and none of them answer "what will this look like on my
 * screen at four in the afternoon". So each pillar carries a small, honest reproduction of
 * the real panel — the same words, colours and numbers the operator sees — and switching
 * between them animates, because the panels are siblings, not separate pages.
 */

type Key = 'floor' | 'customers' | 'staff' | 'money';

const PILLARS: Array<{
  key: Key; icon: React.ReactNode; title: string; lead: string; points: string[]; accent: string; soft: string;
}> = [
  {
    key: 'floor', icon: <LayoutGrid size={17} />, accent: 'text-sky-600', soft: 'bg-sky-50 ring-sky-100',
    title: 'جایگاه‌ها و صف',
    lead: 'تابلوی زنده‌ی کارواش: هر جایگاه، خودرویی که در آن است، مرحله‌اش و صف رزروهایی که منتظر جایگاه‌اند.',
    points: ['مراحل ثابت برای هر خودرو', 'صف شماره‌دار برای رزروها', 'آزادسازی زودهنگام جایگاه', 'جایگاه شستشو، خشک، واکس و پولیش'],
  },
  {
    key: 'customers', icon: <Users size={17} />, accent: 'text-violet-600', soft: 'bg-violet-50 ring-violet-100',
    title: 'مشتری و باشگاه',
    lead: 'هر پلاک به یک پرونده وصل است: تاریخچه، امتیاز، کیف پول و یادآور خدمت بعدی.',
    points: ['شناسایی با شماره‌ی تلفن', 'امتیاز وفاداری و خدمت رایگان', 'کیف پول و شارژ اعتبار', 'پیامک یادآور و کمپین'],
  },
  {
    key: 'staff', icon: <HardHat size={17} />, accent: 'text-amber-600', soft: 'bg-amber-50 ring-amber-100',
    title: 'پرسنل و انعام',
    lead: 'چه کسی کدام خودرو را شست، چقدر طول کشید، چقدر سهم و انعام دارد — همه ثبت‌شده، نه حدسی.',
    points: ['برنامه‌ی شیفت و حضور', 'کارمزد خودکار هر خدمت', 'تسویه‌ی انعام', 'کارنامه و خوش‌قولی هر نفر'],
  },
  {
    key: 'money', icon: <LineChart size={17} />, accent: 'text-emerald-600', soft: 'bg-emerald-50 ring-emerald-100',
    title: 'مالی و گزارش',
    lead: 'صندوق شیفت، هزینه‌ها، فروش هر جایگاه و گلوگاه‌های کارواش، با عدد و نه با حس.',
    points: ['صندوق باز و بسته‌ی هر شیفت', 'گزارش فروش و هزینه', 'عملکرد هر جایگاه', 'آرشیو و گزارش فعالیت کاربران'],
  },
];

/* ── The little panels. Each is the real screen, reduced to what proves the point. ── */

const FloorPreview = () => (
  <div className="grid gap-2 sm:grid-cols-3">
    {[
      { name: 'شستشو ۱', stage: 'در حال شستشو', chip: 'bg-sky-100 text-sky-700', plate: '۱۲ ب ۳۴۵ ۱۱', min: 8 },
      { name: 'شستشو ۲', stage: 'خشک‌کردن', chip: 'bg-violet-100 text-violet-700', plate: '۴۴ د ۲۲۲ ۳۳', min: 3 },
      { name: 'شستشو ۳', stage: 'آزاد', chip: 'bg-emerald-100 text-emerald-700', plate: '', min: 0 },
    ].map(b => (
      <div key={b.name} className="rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-700">{b.name}</span>
          <span className={clsx('rounded-md px-1.5 py-0.5 text-[9px] font-bold', b.chip)}>{b.stage}</span>
        </div>
        {b.plate ? (
          <>
            <div className="mt-2 font-mono text-[12px] font-bold text-slate-800">{b.plate}</div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
              <Clock size={10} />{fa(b.min)} دقیقه در جایگاه
            </div>
          </>
        ) : (
          <div className="mt-3 text-[10px] font-bold text-slate-300">برای ثبت کلیک کنید</div>
        )}
      </div>
    ))}
    <div className="rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100 sm:col-span-3">
      <div className="mb-1.5 text-[10px] font-extrabold text-amber-700">صف شستشو</div>
      <div className="flex flex-wrap gap-1.5">
        {['۵۵ ج ۵۵۵ ۵۵', '۷۷ س ۱۲۳ ۱۰'].map((p, i) => (
          <span key={p} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-amber-100">
            <span className="grid size-4 place-items-center rounded bg-amber-100 text-[9px] text-amber-700">{fa(i + 1)}</span>
            <span className="font-mono">{p}</span>
          </span>
        ))}
      </div>
    </div>
  </div>
);

const CustomerPreview = () => (
  <div className="grid gap-2 sm:grid-cols-[1.1fr_1fr]">
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">س</span>
        <div>
          <div className="text-[12px] font-extrabold text-slate-800">سارا کریمی</div>
          <div className="font-mono text-[10px] text-slate-400">۰۹۱۲۱۱۱۲۲۳۳</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        {[
          { l: 'مراجعه', v: fa(14), i: <Star size={11} /> },
          { l: 'امتیاز', v: fa(280), i: <Trophy size={11} /> },
          { l: 'کیف پول', v: `${faNum(120000)}`, i: <Wallet size={11} /> },
        ].map(s => (
          <div key={s.l} className="rounded-lg bg-slate-50 p-2">
            <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400">{s.i}{s.l}</div>
            <div className="mt-0.5 text-[12px] font-extrabold text-slate-800">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="space-y-2">
      <div className="rounded-xl bg-emerald-50/80 p-3 ring-1 ring-emerald-100">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700"><Gift size={12} />خدمت رایگان آماده است</div>
        <p className="mt-1 text-[10px] leading-5 text-emerald-700/80">با ۱۰ مراجعه، یازدهمین شستشو مهمان شماست.</p>
      </div>
      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700"><Bell size={12} className="text-violet-500" />یادآور خدمت</div>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">«۳۰ روز از شستشوی قبلی گذشته» — پیامک خودکار برای بازگشت مشتری.</p>
      </div>
    </div>
  </div>
);

const StaffPreview = () => (
  <div className="space-y-2">
    {[
      { n: 'مهدی رستمی', role: 'شستشوکار', cars: 11, tip: 180_000, pct: 86 },
      { n: 'یاسر قاسمی', role: 'خشک‌کن', cars: 9, tip: 120_000, pct: 71 },
      { n: 'سجاد بیات', role: 'پولیش‌کار', cars: 4, tip: 90_000, pct: 48 },
    ].map(w => (
      <div key={w.n} className="rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-[11px] font-black text-amber-700">{w.n[0]}</span>
            <div>
              <div className="text-[12px] font-extrabold text-slate-800">{w.n}</div>
              <div className="text-[9px] text-slate-400">{w.role}</div>
            </div>
          </div>
          <div className="text-left">
            <div className="text-[11px] font-extrabold text-slate-800">{fa(w.cars)} خودرو</div>
            <div className="text-[9px] text-amber-600">انعام {faNum(w.tip)} ت</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <motion.span
            className="block h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-500"
            initial={{ width: 0 }} whileInView={{ width: `${w.pct}%` }} viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    ))}
  </div>
);

const MoneyPreview = () => (
  <div className="grid gap-2 sm:grid-cols-2">
    {[
      { l: 'فروش امروز', v: `${faNum(4_280_000)} ت`, d: '+۱۸٪ از دیروز', good: true },
      { l: 'میانگین هر خودرو', v: `${faNum(96_000)} ت`, d: '۴۵ خودرو', good: true },
      { l: 'هزینه‌ی امروز', v: `${faNum(640_000)} ت`, d: 'مواد و آب', good: false },
      { l: 'مانده‌ی تسویه‌نشده', v: `${faNum(0)} ت`, d: 'تحویل بدون تسویه ممنوع', good: true },
    ].map(c => (
      <div key={c.l} className="rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
        <div className="text-[10px] text-slate-400">{c.l}</div>
        <div className="mt-1 text-[15px] font-black text-slate-900">{c.v}</div>
        <div className={clsx('mt-0.5 text-[9px] font-bold', c.good ? 'text-emerald-600' : 'text-slate-400')}>{c.d}</div>
      </div>
    ))}
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200/80 sm:col-span-2">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700"><Receipt size={12} className="text-emerald-500" />عملکرد جایگاه‌ها</div>
      <div className="space-y-1.5">
        {[{ n: 'شستشو ۱', v: 92 }, { n: 'شستشو ۲', v: 74 }, { n: 'خشک ۹', v: 55 }].map(b => (
          <div key={b.n} className="flex items-center gap-2">
            <span className="w-14 text-[10px] text-slate-500">{b.n}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <motion.span className="block h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-500"
                initial={{ width: 0 }} whileInView={{ width: `${b.v}%` }} viewport={{ once: true }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
            </span>
            <span className="w-8 text-left text-[10px] font-bold text-slate-600">{fa(b.v)}٪</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const PREVIEW: Record<Key, React.ReactNode> = {
  floor: <FloorPreview />, customers: <CustomerPreview />, staff: <StaffPreview />, money: <MoneyPreview />,
};

export const Pillars = () => {
  const [active, setActive] = useState<Key>('floor');
  const still = useReducedMotion();
  const current = PILLARS.find(p => p.key === active)!;

  return (
    <section className="sw-band sw-band-brand relative py-20 md:py-28" id="features">
      <Container>
        <SectionHead
          eyebrow="امکانات"
          tone="sky"
          title="چهار چیز که کارواش را می‌چرخاند"
          lead="روی هرکدام بزنید تا همان صفحه‌ای را ببینید که تیم شما هر روز با آن کار می‌کند."
        />

        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8">
          <div className="space-y-2.5">
            {PILLARS.map((p, i) => {
              const on = p.key === active;
              return (
                <Reveal key={p.key} delay={i * 0.05}>
                  <button
                    type="button"
                    onClick={() => setActive(p.key)}
                    aria-pressed={on}
                    className={clsx('sw-pillar', on && 'sw-pillar-on')}
                  >
                    {on && !still && (
                      <motion.span layoutId="pillar-bg" className="sw-pillar-bg" transition={{ type: 'spring', stiffness: 300, damping: 32 }} />
                    )}
                    <span className="relative flex items-start gap-3">
                      <span className={clsx('grid size-10 flex-shrink-0 place-items-center rounded-xl ring-1', p.soft, p.accent)}>{p.icon}</span>
                      <span className="min-w-0 text-right">
                        <span className="block text-[14px] font-extrabold text-slate-900">{p.title}</span>
                        <span className="mt-1 block text-[12px] leading-6 text-slate-500">{p.lead}</span>
                        <AnimatePresence initial={false}>
                          {on && (
                            <motion.span
                              className="mt-2 flex flex-wrap gap-1.5 overflow-hidden"
                              initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              animate={still ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                              exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
                            >
                              {p.points.map(pt => (
                                <span key={pt} className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[10.5px] font-bold text-slate-600 ring-1 ring-slate-200/70">
                                  <Check size={10} className="text-emerald-500" />{pt}
                                </span>
                              ))}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </div>

          <Reveal x={-14} className="relative lg:sticky lg:top-24">
            {/* The same screen in a hand, because this is a product used standing on a wet
                floor far more often than sitting at a desk. */}
            <PhoneFrame className="sw-pillar-phone">
              <div className="flex h-full flex-col bg-gradient-to-b from-white to-slate-50 p-2">
                <div className="mb-1.5 flex items-center justify-between px-0.5">
                  <span className="text-[8px] font-black text-slate-700">{current.title}</span>
                  <BrushMark size={12} className={current.accent} />
                </div>
                <div className="flex-1 overflow-hidden rounded-xl bg-white p-1.5 shadow-sm">
                  <div className="origin-top scale-[0.42] [width:238%]">{PREVIEW[active]}</div>
                </div>
              </div>
            </PhoneFrame>

            <div className="sw-preview-frame">
              <div className="sw-preview-bar">
                <span className="flex gap-1.5">
                  <i className="size-2.5 rounded-full bg-rose-300" /><i className="size-2.5 rounded-full bg-amber-300" /><i className="size-2.5 rounded-full bg-emerald-300" />
                </span>
                <span className="text-[10px] font-bold text-slate-400">{current.title} — پنل SmartWash</span>
              </div>
              <div className="sw-preview-body">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={still ? { opacity: 0 } : { opacity: 0, x: 24, filter: 'blur(5px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={still ? { opacity: 0 } : { opacity: 0, x: -24, filter: 'blur(5px)' }}
                    transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                  >
                    {PREVIEW[active]}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
};
