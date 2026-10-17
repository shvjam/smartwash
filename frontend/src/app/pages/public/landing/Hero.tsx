import React from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Container, CountUp, Reveal, faNum } from '../../../components/landing/kit';
import { LiveBoard } from './LiveBoard';

/**
 * The first screen: a claim, and the instrument that backs it.
 *
 * The claim is operational — no waiting — and the proof beside it is the board itself,
 * running, with its buttons live. Someone who presses one has used the product before they
 * have read a feature list, and that is the only kind of demonstration that survives a
 * sceptical carwash owner.
 *
 * The headline arrives a line at a time from behind its own edge. Masked lines read as a
 * machine setting type; words flying in from the side read as a slide deck.
 */

const PROOF = [
  { value: 250, suffix: '+', label: 'کارواش فعال' },
  { value: 1_200_000, suffix: '', label: 'سفارش پردازش‌شده' },
  { value: 24, suffix: ' دقیقه', label: 'میانگین هر خودرو' },
];

export const Hero = () => {
  const still = useReducedMotion();

  const line = (content: React.ReactNode, i: number) => (
    <span className="sw-mask-line" key={i}>
      <motion.span
        className="block"
        initial={still ? { opacity: 0 } : { y: '110%' }}
        animate={still ? { opacity: 1 } : { y: '0%' }}
        transition={{ delay: 0.07 * i, duration: 0.55, ease: [0.2, 0, 0, 1] }}
      >
        {content}
      </motion.span>
    </span>
  );

  return (
    <section className="relative overflow-hidden pb-14 pt-28 md:pb-20 md:pt-36" id="hero">
      <div className="sw-page-glow" aria-hidden />
      <div className="sw-grid-bg" aria-hidden />

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.15fr] lg:gap-14">
          <div>
            <Reveal>
              <span className="sw-eyebrow-line">سامانه‌ی مدیریت کارواش</span>
            </Reveal>

            <h1 className="sw-display mt-5 text-[2.7rem] md:text-[3.5rem]">
              {line('کارواش شما،', 0)}
              {line(<>بدون <span className="text-brand-600">معطلی.</span></>, 1)}
            </h1>

            <Reveal delay={0.18}>
              <p className="sw-lead mt-6 max-w-md">
                جایگاه‌ها، صف رزرو، پرسنل و پول — روی یک تابلو که همیشه می‌گوید هر خودرو
                کجای کار است. بدون دفتر، بدون تماس، بدون «نوبت کی بود؟».
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-2.5">
                <Link to="/register" className="sw-cta sw-cta-primary">
                  <span>۱۴ روز رایگان</span>
                  <ArrowLeft size={15} />
                </Link>
                <a href="#board" className="sw-cta sw-cta-quiet">
                  <span>تابلو را امتحان کنید</span>
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="mt-10 flex items-center gap-7 border-t border-[var(--line-soft)] pt-5">
                {PROOF.map(p => (
                  <div key={p.label}>
                    <div className="sw-num text-[17px] font-extrabold">
                      <CountUp to={p.value} suffix={p.suffix} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{p.label}</div>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.34}>
              <p className="mt-5 flex items-center gap-1.5 text-[11.5px] text-[var(--ink-3)]">
                <ShieldCheck size={13} className="text-[var(--money)]" />
                بدون کارت بانکی · راه‌اندازی با تیم ما · لغو هر زمان
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12} x={-16}>
            <div id="board" className="sw-console-frame">
              <div className="sw-console-bar">
                <span className="sw-console-dots" aria-hidden><i /><i /><i /></span>
                <span className="font-mono text-[10px] tracking-wide opacity-70" dir="ltr">
                  appsmartwash.com/app/bays
                </span>
                <span className="flex items-center gap-1.5 text-[10px] opacity-80">
                  <span className="sw-live-dot" />زنده
                </span>
              </div>
              <div className="bg-[var(--paper-2)] p-3">
                <LiveBoard />
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] text-[var(--ink-4)]">
              همین تابلو با همان دکمه‌ها — {faNum(3)} جایگاه و یک صف نمونه. دست بزنید.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
};
