import React, { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from 'motion/react';
import { Car, Droplets, Wind, Sparkles, Wallet, KeyRound } from 'lucide-react';
import clsx from 'clsx';
import { Container, Reveal, SectionHead, fa } from '../../../components/landing/kit';
import { BubbleField, FoamDivider } from '../../../components/landing/art';

/**
 * One car's day, step by step, drawn as the visitor scrolls.
 *
 * Carwash owners do not buy "an order management module"; they buy an answer to the hour when
 * four cars are in and nobody can say which is nearly done. So the section walks the journey
 * the product actually enforces, and under each step says what the owner gets out of it —
 * the released bay, the time recorded, the money that cannot be skipped.
 *
 * The line fills with the scroll because the subject is a sequence; the page moving through it
 * is the same gesture as the car moving through the wash.
 */

const STEPS = [
  {
    icon: <Car size={18} />, tone: 'slate',
    title: 'پذیرش روی جایگاه',
    body: 'روی جایگاه خالی می‌زنید و خودرو ثبت می‌شود. پلاک و مشتری همان‌جا ذخیره می‌شوند؛ دفعه‌ی بعد با شماره‌ی تلفن شناخته می‌شود.',
    gain: 'پرونده‌ی مشتری و خودرو خودکار ساخته می‌شود',
  },
  {
    icon: <Droplets size={18} />, tone: 'sky',
    title: 'شستشو شروع می‌شود',
    body: 'یک دکمه. از این لحظه زمان کار شمرده می‌شود و تابلو برای همه روشن است که این خودرو کجای کار است.',
    gain: 'زمان واقعی هر خودرو ثبت می‌شود',
  },
  {
    icon: <Wind size={18} />, tone: 'violet',
    title: 'خشک‌کردن و خدمات آپشن',
    body: 'در همان جایگاه ادامه پیدا می‌کند، یا اگر جایگاه خشک دارید با یک دکمه منتقل می‌شود و جایگاه شستشو آزاد.',
    gain: 'جایگاه زودتر آزاد می‌شود، نه بعد از تسویه',
  },
  {
    icon: <Sparkles size={18} />, tone: 'emerald',
    title: 'آماده‌ی تحویل',
    body: 'خودرو از جایگاه بیرون می‌آید و در فهرست آماده‌ی تحویل می‌نشیند تا مشتری برسد. جایگاه بلافاصله خودروی بعدی را می‌گیرد.',
    gain: 'ظرفیت بیشتر بدون جایگاه بیشتر',
  },
  {
    icon: <Wallet size={18} />, tone: 'amber',
    title: 'تسویه، قبل از تحویل',
    body: 'تا مانده صفر نشود دکمه‌ی تحویل قفل است. تخفیف، کیف پول و امتیاز وفاداری همه در همین صفحه حساب می‌شوند.',
    gain: 'خودرویی بدون تسویه از کارواش بیرون نمی‌رود',
  },
  {
    icon: <KeyRound size={18} />, tone: 'brand',
    title: 'تحویل و فاکتور',
    body: 'فاکتور صادر می‌شود، سهم و انعام پرسنل ثبت می‌شود و خودرو به تاریخچه‌ی مشتری می‌رود تا یادآور خدمت بعدی ارسال شود.',
    gain: 'مشتری برمی‌گردد، چون یادش می‌آورید',
  },
];

const TONES: Record<string, { dot: string; ring: string; chip: string }> = {
  slate: { dot: 'bg-slate-400', ring: 'ring-slate-200', chip: 'bg-slate-50 text-slate-600' },
  sky: { dot: 'bg-sky-500', ring: 'ring-sky-200', chip: 'bg-sky-50 text-sky-700' },
  violet: { dot: 'bg-violet-500', ring: 'ring-violet-200', chip: 'bg-violet-50 text-violet-700' },
  emerald: { dot: 'bg-emerald-500', ring: 'ring-emerald-200', chip: 'bg-emerald-50 text-emerald-700' },
  amber: { dot: 'bg-amber-500', ring: 'ring-amber-200', chip: 'bg-amber-50 text-amber-700' },
  brand: { dot: 'bg-brand-600', ring: 'ring-brand-200', chip: 'bg-brand-50 text-brand-700' },
};

export const DayStory = () => {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 72%', 'end 55%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 90, damping: 24, restDelta: 0.001 });
  const height = useTransform(fill, v => `${Math.max(2, v * 100)}%`);

  return (
    <section className="sw-band sw-band-sky relative py-20 md:py-28" id="journey">
      <BubbleField count={10} />
      <Container className="relative">
        <SectionHead
          eyebrow="مسیر خودرو"
          title={<>یک خودرو، از ورود تا تحویل<br className="hidden md:block" /> روی یک خط مشخص</>}
          lead="هر مرحله یک دکمه است و هر دکمه یک اتفاق واقعی در کارواش. هیچ مرحله‌ای از شما جایگاه نمی‌پرسد؛ خودرو همان‌جایی است که گذاشتیدش."
        />

        <div ref={ref} className="relative mx-auto max-w-3xl">
          {/* The rail the steps hang from, filling as the section is read. */}
          <div className="absolute bottom-2 top-2 right-[27px] w-px bg-slate-200 md:right-[31px]" aria-hidden />
          {!still && (
            <>
              <motion.div
                aria-hidden
                className="absolute top-2 right-[27px] w-px origin-top bg-gradient-to-b from-brand-500 via-sky-400 to-emerald-400 md:right-[31px]"
                style={{ height }}
              />
              {/* A car drives down the rail as the section is read: the page scrolling and the
                  car moving through the wash are the same gesture. */}
              <motion.span aria-hidden className="sw-rail-car" style={{ top: height }}>
                <svg viewBox="0 0 48 26" className="h-5 w-9">
                  <path d="M3 19c0-4 2-5 5-6l6-5c2-1.6 4-2.4 6.6-2.4H33c3.6 0 6.4 1 8.4 3l3.2 3.4c1.4.6 2.4 1.6 2.4 3.2v3c0 1.2-1 2.2-2.2 2.2H5.2C4 20.4 3 19.6 3 18.4Z" fill="var(--color-brand-600)" />
                  <path d="M16 7.5c1.2-1 2.6-1.4 4.2-1.4H24v5.4h-12Z" fill="#fff" opacity=".85" />
                  <path d="M26 6.1h6.4c2.4 0 4.2.7 5.6 2l2.6 2.8H26Z" fill="#fff" opacity=".85" />
                  <circle cx="15" cy="21" r="4.2" fill="oklch(26% 0.02 260)" />
                  <circle cx="36" cy="21" r="4.2" fill="oklch(26% 0.02 260)" />
                  <circle cx="15" cy="21" r="1.7" fill="#e2e8f0" />
                  <circle cx="36" cy="21" r="1.7" fill="#e2e8f0" />
                </svg>
              </motion.span>
            </>
          )}

          <ol className="space-y-6 md:space-y-8">
            {STEPS.map((s, i) => {
              const tone = TONES[s.tone];
              return (
                <Reveal as="li" key={s.title} delay={i * 0.03} className="relative pr-16 md:pr-20">
                  <span className={clsx('absolute right-0 top-1 grid size-14 place-items-center rounded-2xl bg-white shadow-sm ring-1', tone.ring, 'md:size-16')}>
                    <span className={clsx('absolute -right-1 top-1/2 size-2 -translate-y-1/2 rounded-full', tone.dot)} aria-hidden />
                    <span className="text-slate-700">{s.icon}</span>
                  </span>

                  <div className="sw-step-card group/tilt">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black text-slate-300">{fa(String(i + 1).padStart(2, '0'))}</span>
                      <h3 className="text-base font-extrabold text-slate-900 md:text-lg">{s.title}</h3>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-7 text-slate-600">{s.body}</p>
                    <span className={clsx('mt-3 inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold', tone.chip)}>
                      {s.gain}
                    </span>
                  </div>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </Container>
      <FoamDivider tone="white" className="mt-16 md:mt-24" />
    </section>
  );
};
