import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll } from 'motion/react';
import { Car, Droplets, Wind, Sparkles, Wallet, KeyRound } from 'lucide-react';
import clsx from 'clsx';
import { Container, Reveal, fa } from '../../../components/landing/kit';

/**
 * The wash itself, played by the page.
 *
 * A tall section is pinned while the scroll drives a car through a bay: it arrives, is
 * soaped, scrubbed, rinsed, dried and handed back. Beside it the six captions are the six
 * stages the product enforces, lit one at a time, so what the visitor is watching and what
 * the software does are the same six words.
 *
 * Why this and not a video: a video is a file to download and a thing to buffer, it cannot
 * be scrubbed backwards by someone reading slowly, and it is out of date the moment the
 * product changes. This is 28 KB of models driven by one number.
 *
 * Where it will not run — a narrow screen, a browser without WebGL, a system asking for less
 * motion, a visitor who has turned on data saving — the captions remain as an ordinary list
 * and nothing is downloaded. The argument survives without the picture.
 */

const WashSequence = lazy(() => import('../../../components/landing/WashSequence'));

const STEPS = [
  { at: 0.06, icon: <Car size={16} />, title: 'خودرو می‌رسد', body: 'پلاک و مشتری همان‌جا ثبت می‌شوند و خودرو روی جایگاه می‌نشیند.', tone: 'slate' },
  { at: 0.26, icon: <Droplets size={16} />, title: 'شستشو شروع می‌شود', body: 'از این لحظه زمان کار شمرده می‌شود و تابلو برای همه روشن است.', tone: 'sky' },
  { at: 0.5, icon: <Sparkles size={16} />, title: 'آبکشی', body: 'مرحله‌ی بعد خودش پیشنهاد می‌شود؛ کسی دنبال نوبت نمی‌گردد.', tone: 'cyan' },
  { at: 0.68, icon: <Wind size={16} />, title: 'خشک‌کردن', body: 'در همین جایگاه یا جایگاه خشک — هر کدام، جایگاه زودتر آزاد می‌شود.', tone: 'violet' },
  { at: 0.84, icon: <Wallet size={16} />, title: 'تسویه', body: 'تا مانده صفر نشود، دکمه‌ی تحویل قفل است.', tone: 'amber' },
  { at: 0.95, icon: <KeyRound size={16} />, title: 'تحویل', body: 'فاکتور، سهم پرسنل، و یادآور خدمت بعدی برای همین مشتری.', tone: 'brand' },
];

const TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  sky: 'bg-sky-100 text-sky-700 ring-sky-200',
  cyan: 'bg-cyan-100 text-cyan-700 ring-cyan-200',
  violet: 'bg-violet-100 text-violet-700 ring-violet-200',
  amber: 'bg-amber-100 text-amber-700 ring-amber-200',
  brand: 'bg-brand-100 text-brand-700 ring-brand-200',
};

export const WashStory = () => {
  const still = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [active, setActive] = useState(0);
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });

  // The scene reads this ref every frame; React state would re-render sixty times a second
  // for a number nothing in the DOM needs. The captions are the exception, and they change
  // six times in the whole section.
  useEffect(() => scrollYProgress.on('change', value => {
    progress.current = value;
    let index = 0;
    for (let i = 0; i < STEPS.length; i++) if (value >= STEPS[i].at - 0.08) index = i;
    setActive(prev => (prev === index ? prev : index));
  }), [scrollYProgress]);

  // Loaded only where it can be seen and afforded, like the rest of the 3D on this page.
  useEffect(() => {
    if (still) return;
    const roomy = window.matchMedia('(min-width: 1024px)').matches;
    const thrifty = (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!roomy || thrifty) return;

    const node = section.current;
    if (!node) return;
    const watcher = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setShow(true); watcher.disconnect(); }
    }, { rootMargin: '300px 0px' });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [still]);

  return (
    <section ref={section} className="sw-wash" id="wash">
      <div className="sw-wash-pin">
        <Container className="h-full">
          <div className="grid h-full items-center gap-8 lg:grid-cols-[1fr_1.25fr]">
            <div className="relative z-10">
              <Reveal>
                <span className="sw-eyebrow sw-eyebrow-sky">یک شستشو، از اول تا آخر</span>
                <h2 className="mt-4 text-balance text-3xl font-black leading-[1.25] text-slate-900 md:text-[2.5rem]">
                  همان شش مرحله‌ای که سیستم می‌شمارد
                </h2>
              </Reveal>

              <ol className="mt-7 space-y-1.5">
                {STEPS.map((step, i) => {
                  const on = i === active;
                  const done = i < active;
                  return (
                    <li key={step.title}>
                      <motion.div
                        className={clsx('sw-wash-step', on && 'sw-wash-step-on')}
                        animate={still ? undefined : { opacity: on ? 1 : done ? 0.55 : 0.32, x: on ? 0 : 6 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                      >
                        <span className={clsx('grid size-9 flex-shrink-0 place-items-center rounded-xl ring-1', TONES[step.tone])}>
                          {step.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-baseline gap-2">
                            <b className="text-[13.5px] font-extrabold text-slate-900">{step.title}</b>
                            <span className="font-mono text-[10px] text-slate-300">{fa(String(i + 1).padStart(2, '0'))}</span>
                          </span>
                          <motion.span
                            className="block overflow-hidden text-[12px] leading-6 text-slate-500"
                            animate={still ? undefined : { height: on ? 'auto' : 0, opacity: on ? 1 : 0 }}
                            initial={false}
                          >
                            {step.body}
                          </motion.span>
                        </span>
                      </motion.div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-6 h-1 overflow-hidden rounded-full bg-slate-200/70">
                <motion.div className="h-full origin-right bg-gradient-to-l from-brand-500 to-sky-400"
                  style={still ? undefined : { scaleX: scrollYProgress }} />
              </div>
            </div>

            <div className="relative h-[46vh] lg:h-[70vh]">
              {show && (
                <Suspense fallback={null}>
                  <WashSequence progress={progress} className="absolute inset-0" onReady={() => setReady(true)} />
                </Suspense>
              )}
              {!ready && (
                <div className="sw-wash-placeholder">
                  <span>{show ? 'در حال آماده‌سازی جایگاه…' : 'برای دیدن این بخش، صفحه را پایین بیاورید'}</span>
                </div>
              )}
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
};
