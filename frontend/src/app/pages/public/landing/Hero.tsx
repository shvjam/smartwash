import React from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, PlayCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Container, CountUp, Magnetic, Marquee, MeshBackdrop, Reveal, fa } from '../../../components/landing/kit';
import { BubbleField, CarWashScene, Drop, LaptopFrame } from '../../../components/landing/art';
import { LiveBoard } from './LiveBoard';

/**
 * The first screen answers one question: what is this, and does it understand my carwash?
 *
 * The headline makes a plain operational promise, and the proof sits beside it already
 * running — the live board, in a laptop, because that is where it is read. Behind and below
 * it the carwash itself is drawn: a car under foam, jets, soap drifting up the page. The
 * words say "no waiting"; the picture says "carwash"; the board says "and here it is".
 *
 * The headline arrives a word at a time from the right, the side a Persian reader starts on.
 * It is the one flourish, and it exists so the eye lands on "بدون معطلی" last.
 */

const TITLE_WORDS = ['کارواش', 'شما،', 'بدون', 'معطلی.'];

const PROOF = [
  '۲۵۰+ کارواش فعال',
  '۱.۲ میلیون سفارش پردازش‌شده',
  'رزرو آنلاین و باشگاه مشتریان',
  'گزارش زنده‌ی هر جایگاه',
  'تسویه‌ی انعام و کارمزد پرسنل',
  'پشتیبانی فارسی',
];

export const Hero = () => {
  const still = useReducedMotion();

  return (
    <section className="sw-hero" id="hero">
      <MeshBackdrop />
      <div className="sw-grid-texture" aria-hidden />
      <BubbleField count={16} />

      <Container className="relative">
        <div className="grid items-center gap-10 pb-6 pt-28 md:pt-36 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
          <div>
            <Reveal>
              <span className="sw-pill">
                <Sparkles size={13} />
                <span>نسخه‌ی تازه: صف رزرو، مسیر خودرو و گزارش هر جایگاه</span>
              </span>
            </Reveal>

            <h1 className="mt-6 text-balance text-[2.6rem] font-black leading-[1.18] tracking-tight text-slate-900 md:text-6xl">
              {TITLE_WORDS.map((w, i) => (
                <motion.span
                  key={w}
                  className={w === 'معطلی.' ? 'sw-title-accent' : undefined}
                  initial={still ? { opacity: 0 } : { opacity: 0, y: 22, x: 14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, x: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.08 * i, type: 'spring', stiffness: 220, damping: 26 }}
                  style={{ display: 'inline-block', marginInlineEnd: '0.28em' }}
                >
                  {w}
                </motion.span>
              ))}
            </h1>

            <Reveal delay={0.25}>
              <p className="mt-5 max-w-lg text-pretty text-[15px] leading-8 text-slate-600 md:text-[17px]">
                از لحظه‌ای که خودرو وارد جایگاه می‌شود تا تسویه و تحویل، همه‌چیز روی یک تابلوی زنده است:
                جایگاه‌ها، صف رزروها، پرسنل، مشتری و پول. بدون دفتر، بدون تماس، بدون «نوبت کی بود؟».
              </p>
            </Reveal>

            <Reveal delay={0.32}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <Link to="/register" className="sw-btn sw-btn-primary sw-btn-lg">
                    <span>۱۴ روز رایگان شروع کنید</span>
                    <ArrowLeft size={16} />
                  </Link>
                </Magnetic>
                <a href="#board" className="sw-btn sw-btn-ghost sw-btn-lg">
                  <PlayCircle size={16} />
                  <span>تابلو را امتحان کنید</span>
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.4}>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" />بدون کارت بانکی</span>
                <span className="flex items-center gap-1.5">
                  <span className="sw-live-dot" />
                  <CountUp to={250} suffix="+" className="text-slate-900" /> کارواش فعال
                </span>
                <span className="flex items-center gap-1.5"><Drop size={13} className="text-sky-500" />راه‌اندازی در {fa(1)} روز</span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15} x={-18} y={10}>
            <div className="relative">
              <LaptopFrame className="relative z-10">
                <div id="board">
                  <LiveBoard />
                </div>
              </LaptopFrame>
              {/* the bay the board is describing, drawn underneath it */}
              <CarWashScene className="sw-hero-scene" />

              {/* two small cards that lift off the screen, the way the product actually speaks */}
              <motion.div
                className="sw-float-card sw-float-ready"
                initial={still ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.9, type: 'spring', stiffness: 220, damping: 22 }}
              >
                <span className="sw-float-dot bg-emerald-500" />
                <span>
                  <b className="block text-[11.5px] text-slate-900">۱۲ ب ۳۴۵ آماده‌ی تحویل</b>
                  <span className="text-[10px] text-slate-500">پیامک برای مشتری رفت</span>
                </span>
              </motion.div>

              <motion.div
                className="sw-float-card sw-float-money"
                initial={still ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.15, type: 'spring', stiffness: 220, damping: 22 }}
              >
                <span className="sw-float-dot bg-brand-500" />
                <span>
                  <b className="block text-[11.5px] text-slate-900">فروش امروز {fa('۴٬۲۸۰٬۰۰۰')} ت</b>
                  <span className="text-[10px] text-slate-500">{fa(45)} خودرو تا این لحظه</span>
                </span>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </Container>

      <div className="relative mt-10 md:mt-14">
        <Marquee items={PROOF.map(p => <span key={p}>{p}</span>)} />
      </div>
    </section>
  );
};
