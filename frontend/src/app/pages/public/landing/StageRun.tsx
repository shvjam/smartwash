import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll } from 'motion/react';
import clsx from 'clsx';
import { Container, Reveal, fa, faNum } from '../../../components/landing/kit';

/**
 * One order, walked through the six stages by the page's own scroll.
 *
 * This is the product's argument in its own interface: a real order card moves down a real
 * stage rail, the bay it occupies lights up and then releases, a queue behind it shortens,
 * the clock on the job runs, and the money only appears when the stage the money appears in
 * arrives. Nothing here is a metaphor for the software — it is the software's own furniture,
 * driven by a scrollbar instead of by an operator's thumb.
 *
 * It is built from DOM and CSS rather than a canvas on purpose: it stays sharp at any zoom,
 * it costs nothing to download beyond this file, it is readable by a screen reader as a list
 * of stages, and someone scrolling back up sees it run backwards rather than restart.
 */

type Stage = {
  key: string;
  label: string;
  title: string;
  body: string;
  tone: 'idle' | 'wash' | 'dry' | 'money';
  /** Which bay holds the car at this stage, or null once it has left. */
  bay: number | null;
  minutes: number;
  paid?: boolean;
};

const STAGES: Stage[] = [
  {
    key: 'received', label: 'پذیرش', tone: 'idle', bay: 1, minutes: 0,
    title: 'روی جایگاه خالی می‌زنید',
    body: 'پلاک و شماره‌ی مشتری همان‌جا ثبت می‌شود. دفعه‌ی بعد با همان شماره شناخته می‌شود و سابقه‌اش بالا می‌آید.',
  },
  {
    key: 'washing', label: 'در حال شستشو', tone: 'wash', bay: 1, minutes: 4,
    title: 'شستشو شروع می‌شود',
    body: 'از این لحظه زمان کار شمرده می‌شود. هر کسی به تابلو نگاه کند می‌داند این خودرو کجای کار است — بدون پرسیدن.',
  },
  {
    key: 'drying', label: 'خشک‌کردن', tone: 'dry', bay: 1, minutes: 13,
    title: 'خشک‌کردن، در همان جایگاه',
    body: 'هیچ مرحله‌ای دوباره جایگاه نمی‌پرسد؛ خودرو همان‌جایی است که گذاشتیدش. اگر جایگاه خشک دارید، با یک دکمه منتقل می‌شود.',
  },
  {
    key: 'ready', label: 'آماده تحویل', tone: 'money', bay: null, minutes: 21,
    title: 'جایگاه همین‌جا آزاد می‌شود',
    body: 'نه بعد از تسویه. خودرو بیرون می‌آید و منتظر مشتری می‌ماند، و جایگاه بلافاصله خودروی بعدی صف را می‌گیرد.',
  },
  {
    key: 'settle', label: 'تسویه', tone: 'money', bay: null, minutes: 24, paid: true,
    title: 'تا تسویه نشود، تحویل قفل است',
    body: 'تخفیف، کیف پول و امتیاز وفاداری همین‌جا حساب می‌شوند. مانده که صفر شد، دکمه‌ی تحویل باز می‌شود.',
  },
  {
    key: 'delivered', label: 'تحویل', tone: 'money', bay: null, minutes: 24, paid: true,
    title: 'فاکتور، سهم پرسنل، یادآور بعدی',
    body: 'سفارش بسته می‌شود، سهم و انعام پرسنل ثبت می‌شود، و خودرو به تاریخچه‌ی مشتری می‌رود تا یادآور خدمت بعدی برایش برود.',
  },
];

const TONE_CHIP: Record<Stage['tone'], string> = {
  idle: 'sw-chip-idle', wash: 'sw-chip-wash', dry: 'sw-chip-dry', money: 'sw-chip-money',
};
const TONE_COLOR: Record<Stage['tone'], string> = {
  idle: 'var(--ink-3)', wash: 'var(--wash)', dry: 'var(--dry)', money: 'var(--money)',
};

const QUEUE = ['۵۵ ج ۵۵۵ ۵۵', '۷۷ س ۱۲۳ ۱۰', '۳۱ ل ۷۷۷ ۴۴'];

export const StageRun = () => {
  const still = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const [at, setAt] = useState(0);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });

  useEffect(() => scrollYProgress.on('change', value => {
    // Six stages across the travel, with the last one holding while the section finishes.
    const index = Math.min(STAGES.length - 1, Math.floor(value * (STAGES.length + 0.2)));
    setAt(prev => (prev === index ? prev : index));
  }), [scrollYProgress]);

  const stage = STAGES[at];
  const bayHolds = (n: number) => stage.bay === n;
  // The queue shortens as the car ahead of it clears the bay.
  const waiting = QUEUE.slice(0, stage.bay === null ? (at >= 4 ? 1 : 2) : 3);

  return (
    <section ref={section} className="sw-run" id="journey">
      <div className="sw-run-pin">
        <Container className="w-full">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            {/* ── The words ───────────────────────────────────────────── */}
            <div>
              <Reveal>
                <span className="sw-eyebrow-line">مسیر یک سفارش</span>
              </Reveal>

              <div className="mt-5 min-h-[9.5rem]">
                <div className="sw-mask-line">
                  <motion.h2
                    key={`t-${stage.key}`}
                    className="sw-display text-[1.9rem] md:text-[2.4rem]"
                    initial={still ? { opacity: 0 } : { y: '105%' }}
                    animate={still ? { opacity: 1 } : { y: '0%' }}
                    transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
                  >
                    {stage.title}
                  </motion.h2>
                </div>
                <motion.p
                  key={`b-${stage.key}`}
                  className="sw-lead mt-4 max-w-md text-[14.5px]"
                  initial={still ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.2, 0, 0, 1], delay: 0.06 }}
                >
                  {stage.body}
                </motion.p>
              </div>

              {/* Six ticks, not a percentage: the reader is counting stages, not progress. */}
              <ol className="mt-9 flex items-center gap-1.5">
                {STAGES.map((s, i) => (
                  <li key={s.key} className="flex-1">
                    <div
                      className="sw-rail"
                      style={{ color: i <= at ? TONE_COLOR[s.tone] : 'transparent' }}
                    >
                      <motion.span
                        initial={false}
                        animate={{ width: i <= at ? '100%' : '0%' }}
                        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
                      />
                    </div>
                    <div className={clsx('mt-2 truncate text-[10.5px] transition-colors duration-200',
                      i === at ? 'font-extrabold text-[var(--ink)]' : 'text-[var(--ink-4)]')}>
                      {s.label}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* ── The instrument ──────────────────────────────────────── */}
            <div className="sw-console-frame">
              <div className="sw-console-bar">
                <span className="sw-console-dots" aria-hidden><i /><i /><i /></span>
                <span className="font-mono text-[10px] opacity-70" dir="ltr">ORD-000412</span>
                <span className="flex items-center gap-1.5 text-[10px] opacity-80">
                  <span className="sw-live-dot" />در حال انجام
                </span>
              </div>

              <div className="space-y-3 bg-[var(--paper-2)] p-3.5">
                {/* The three bays, one of which is holding our car */}
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(n => {
                    const holding = bayHolds(n);
                    return (
                      <div
                        key={n}
                        className={clsx('sw-card sw-edge px-2.5 py-2 transition-colors duration-200')}
                        style={{ color: holding ? TONE_COLOR[stage.tone] : 'var(--line)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-[var(--ink)]">شستشو {fa(n)}</span>
                          <span className={clsx('sw-chip', holding ? TONE_CHIP[stage.tone] : 'sw-chip-money')}>
                            {holding ? stage.label : 'آزاد'}
                          </span>
                        </div>
                        <div className="mt-1.5 font-mono text-[11px] text-[var(--ink-2)]">
                          {holding ? '۱۲ ب ۳۴۵ ۱۱' : <span className="text-[var(--ink-4)]">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* The order itself */}
                <motion.div layout className="sw-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-extrabold">۱۲ ب ۳۴۵ ایران ۱۱</span>
                      <span className="text-[11px] text-[var(--ink-3)]">رضا محمدی</span>
                    </span>
                    <motion.span layout className={clsx('sw-chip', TONE_CHIP[stage.tone])}>
                      {stage.label}
                    </motion.span>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--line-soft)]">
                    <Figure label="زمان در کارواش" value={`${fa(stage.minutes)} دقیقه`} />
                    <Figure label="خدمات" value={`${fa(2)} مورد`} />
                    <Figure
                      label="مانده"
                      value={stage.paid ? `${fa(0)} تومان` : `${faNum(140_000)} تومان`}
                      tone={stage.paid ? 'money' : 'wait'}
                    />
                  </div>

                  <div className="border-t border-[var(--line-soft)] px-3 py-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-[var(--ink-3)]">
                      <span>پیشرفت کار</span>
                      <span className="sw-num">{fa(Math.round(((at + 1) / STAGES.length) * 100))}٪</span>
                    </div>
                    <div className="sw-rail" style={{ color: TONE_COLOR[stage.tone] }}>
                      <motion.span
                        initial={false}
                        animate={{ width: `${((at + 1) / STAGES.length) * 100}%` }}
                        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
                      />
                    </div>
                  </div>

                  {/* The one line that changes the economics, stated where it happens */}
                  <motion.div
                    initial={false}
                    animate={{ height: stage.bay === null ? 'auto' : 0, opacity: stage.bay === null ? 1 : 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 bg-[oklch(55%_0.14_160_/_0.07)] px-3 py-2 text-[11px] font-bold text-[var(--money)]">
                      جایگاه آزاد شد — خودروی بعدی می‌تواند وارد شود
                    </div>
                  </motion.div>
                </motion.div>

                {/* The queue behind it */}
                <div className="sw-card px-3 py-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-[var(--ink)]">صف رزروها</span>
                    <motion.span layout className="sw-chip sw-chip-wait">
                      {fa(waiting.length)} خودرو منتظر
                    </motion.span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {waiting.map((plate, i) => (
                      <motion.span
                        layout
                        key={plate}
                        initial={still ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                        className="flex items-center gap-1.5 rounded-md bg-[var(--paper-2)] px-2 py-1 font-mono text-[10.5px] text-[var(--ink-2)]"
                      >
                        <span className="sw-num rounded bg-[oklch(68%_0.14_75_/_0.15)] px-1 text-[9px] font-bold text-[var(--wait)]">
                          {fa(i + 1)}
                        </span>
                        {plate}
                      </motion.span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
};

const Figure = ({ label, value, tone }: { label: string; value: string; tone?: 'money' | 'wait' }) => (
  <div className="px-3 py-2.5">
    <div className="text-[10.5px] text-[var(--ink-3)]">{label}</div>
    <motion.div
      key={value}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      className="sw-num mt-0.5 text-[13px] font-extrabold"
      style={{ color: tone === 'money' ? 'var(--money)' : tone === 'wait' ? 'var(--wait)' : 'var(--ink)' }}
    >
      {value}
    </motion.div>
  </div>
);
