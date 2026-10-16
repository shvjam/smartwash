import React from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, PlayCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Container, CountUp, Magnetic, Marquee, MeshBackdrop, Reveal, fa } from '../../../components/landing/kit';
import { LiveBoard } from './LiveBoard';

/**
 * The first screen answers one question: what is this, and does it understand my carwash?
 *
 * So the headline makes a plain operational promise rather than a slogan, and the proof sits
 * next to it already running — the live board, which is the product. The two buttons are the
 * only two things a visitor can want at this point: start, or look first.
 *
 * The headline arrives a word at a time from the right. It is the one flourish on the page,
 * and it exists because the eye should land on "بدون معطلی" last.
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
    <section className="relative overflow-hidden pb-16 pt-28 md:pb-24 md:pt-36" id="hero">
      <MeshBackdrop />
      <div className="sw-grid-texture" aria-hidden />

      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_1.18fr] lg:gap-10">
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
                  <Link to="/register" className="sw-btn sw-btn-primary">
                    <span>۱۴ روز رایگان شروع کنید</span>
                    <ArrowLeft size={16} />
                  </Link>
                </Magnetic>
                <a href="#board" className="sw-btn sw-btn-ghost">
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
                <span>راه‌اندازی در {fa(1)} روز</span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15} x={-18} y={10} className="sw-board-shell" as="div">
            <div id="board">
              <LiveBoard />
            </div>
          </Reveal>
        </div>
      </Container>

      <div className="mt-16 md:mt-24">
        <Marquee items={PROOF.map(p => <span key={p}>{p}</span>)} />
      </div>
    </section>
  );
};
