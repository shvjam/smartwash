import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import {
  BrandMark, Btn, Particles, RING_SEGMENTS, Roll, SPARKLE, Split, View, WaveField,
  useCinematic, useIsDesktop, useLenis, useProgress, useScrollTo, useStart,
} from './kit';
import { BoardScreen, PhoneFrame } from './mockups';

export const NAV = [
  { href: '#how', label: 'روش کار' },
  { href: '#features', label: 'امکانات' },
  { href: '#pricing', label: 'تعرفه‌ها' },
  { href: '#faq', label: 'سوالات' },
];

/* ── preloader ────────────────────────────────────────────────────────────── */

export const Preloader = ({ onDone }: { onDone: () => void }) => {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const a = window.setTimeout(() => setLeaving(true), 2500);
    const b = window.setTimeout(onDone, 3300);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [onDone]);
  const ease = [0.19, 1, 0.22, 1] as const;
  return (
    <motion.div className="swl-preloader" initial={{ opacity: 1 }} animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: 0.8 }}
      role="status" aria-label="در حال بارگذاری">
      <Particles density={0.7} />
      <svg viewBox="0 0 100 100" className="relative z-10 w-[7.5rem] lg:w-[9rem]" aria-hidden="true">
        {RING_SEGMENTS.map((s, i) => (
          <motion.path key={i} d={s.d} fill="none" stroke={s.red ? '#e5302a' : '#6b6a70'} strokeWidth="8"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease }} />
        ))}
        <motion.path d={SPARKLE} fill="#ef3b2f" style={{ originX: '50px', originY: '50px' }}
          initial={{ scale: 0, rotate: -120 }} animate={{ scale: 0.62, rotate: 0 }}
          transition={{ duration: 1.4, delay: 0.75, ease }} />
      </svg>
      <motion.div className="swl-latin relative z-10 text-[1.6rem] font-medium tracking-[-.04em] lg:text-[2rem]" dir="ltr"
        initial={{ opacity: 0, filter: 'blur(.6rem)', y: 12 }} animate={{ opacity: 1, filter: 'blur(0rem)', y: 0 }}
        transition={{ duration: 1.2, delay: 1.05, ease }}>
        smartwash
      </motion.div>
    </motion.div>
  );
};

/* ── header ───────────────────────────────────────────────────────────────── */

export const Header = () => {
  const desktop = useIsDesktop();
  const scrollTo = useScrollTo();
  const start = useStart();
  const lenis = useLenis();
  const { scrollYProgress } = useScroll();
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 720]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) lenis.current?.stop(); else lenis.current?.start();
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lenis]);
  useEffect(() => { if (desktop) setOpen(false); }, [desktop]);

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    window.setTimeout(() => scrollTo(href), open ? 350 : 0);
  };

  const brand = (
    <Link to="/" className="swl-brand" aria-label="SmartWash، صفحه‌ی اصلی">
      <BrandMark size="74%" rotate={rotate} />
    </Link>
  );

  if (desktop) {
    return (
      <header className="swl-header">
        <nav className="swl-nav" aria-label="ناوبری اصلی">
          {brand}
          {NAV.map(n => (
            <a key={n.href} href={n.href} onClick={go(n.href)} className="swl-nav-link swl-roll-host"><Roll text={n.label} /></a>
          ))}
          <Link to="/login" className="swl-nav-link swl-roll-host"><Roll text="ورود" /></Link>
          <Btn onClick={start}>شروع رایگان</Btn>
        </nav>
      </header>
    );
  }

  return (
    <header className="swl-header">
      <nav className="swl-nav" aria-label="ناوبری اصلی">
        <div className="relative z-[2]">{brand}</div>
        <button type="button" className="swl-menu-btn" aria-expanded={open} aria-controls="swl-menu"
          aria-label={open ? 'بستن منو' : 'باز کردن منو'} onClick={() => setOpen(o => !o)}>
          <span /><span />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div id="swl-menu" className="swl-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <div className="swl-glow" style={{ width: '30rem', top: '-10rem', insetInlineStart: '-10rem', filter: 'blur(8rem)', opacity: 0.35 }} />
              <ul className="relative space-y-5">
                {[...NAV, { href: '/login', label: 'ورود به پنل' }].map((n, i) => (
                  <motion.li key={n.href} initial={{ opacity: 0, x: 40, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    transition={{ delay: 0.08 + i * 0.06, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}>
                    {n.href.startsWith('#')
                      ? <a href={n.href} onClick={go(n.href)} className="text-[2.6rem] font-semibold leading-tight">{n.label}</a>
                      : <Link to={n.href} className="text-[2.6rem] font-semibold leading-tight">{n.label}</Link>}
                  </motion.li>
                ))}
              </ul>
              <motion.div className="relative space-y-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}>
                <p className="swl-body swl-dim">از پذیرش تا تحویل، روی یک تابلو</p>
                <a href="mailto:info@appsmartwash.com" className="swl-latin block text-[1.5rem]" dir="ltr" style={{ textAlign: 'right' }}>info@appsmartwash.com</a>
                <Btn onClick={() => { setOpen(false); start(); }} className="w-full">شروع ۱۴ روز رایگان</Btn>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
};

/* ── hero + rings (they share one scroll timeline) ────────────────────────── */

const PHONE_TILT = 'perspective(2400px) rotateX(10deg) rotateY(12deg) rotateZ(-11deg)';

const HeroCta = () => {
  const start = useStart();
  return (
    <View className="swl-hero-cta">
      <div>
        <div className="swl-mid font-semibold">۱۴ روز رایگان، بدون کارت بانکی</div>
        <div className="swl-body swl-dim">کارواشتان را همین امروز روی تابلو ببرید</div>
      </div>
      <div className="flex items-center gap-2">
        <Btn onClick={start}>شروع رایگان</Btn>
        <Btn variant="ghost" href="#pricing" onClick={e => { e.preventDefault(); document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>تعرفه‌ها</Btn>
      </div>
    </View>
  );
};

const Hero = ({ phoneY }: { phoneY: MotionValue<string> }) => {
  const desktop = useIsDesktop();
  return (
    <section className="swl-hero" aria-labelledby="swl-hero-title">
      <div className="swl-container swl-hero-inner">
        <div className="swl-hero-media" aria-hidden="true">
          <WaveField />
          <div className="swl-hero-mask" />
          <Particles density={0.9} />
        </div>
        <div className="swl-hero-topblur" aria-hidden="true" />

        <div className="relative z-30 flex w-full flex-1 flex-col items-center justify-between gap-6">
          <div className="flex flex-col items-center text-center">
            <h1 id="swl-hero-title" className="swl-wordmark swl-latin">
              <Split text="smartwash" chars preset="right" intro />
            </h1>
            <Split as="p" text="سامانه‌ی مدیریت کارواش" preset="down" className="swl-hero-tag" intro delay={0.55} />
          </div>

          {!desktop && (
            <View className="pointer-events-none relative -mb-6 h-[56vh] min-h-[22rem] w-full overflow-hidden" aria-hidden="true">
              <div className="absolute left-1/2 top-2 -translate-x-1/2">
                <PhoneFrame style={{ fontSize: 'min(3.9vw, 1rem)', transform: 'perspective(2000px) rotateX(8deg) rotateZ(-6deg)' }}>
                  <BoardScreen />
                </PhoneFrame>
              </div>
            </View>
          )}

          <div className="flex w-full justify-center lg:justify-end">
            <HeroCta />
          </div>
        </div>

        {desktop && (
          <motion.div className="swl-hero-phone-point" style={{ y: phoneY }} aria-hidden="true">
            <div className="absolute" style={{ top: '-9rem', left: '-9.3rem' }}>
              <View>
                <PhoneFrame style={{ fontSize: '1.05rem', transform: PHONE_TILT }}>
                  <BoardScreen />
                </PhoneFrame>
              </View>
            </div>
          </motion.div>
        )}
      </div>
      <div className="swl-hero-downmask" aria-hidden="true" />
    </section>
  );
};

const STAGE_LABELS = ['پذیرش', 'شستشو', 'خشک‌کردن', 'خدمات آپشن', 'آماده تحویل', 'تحویل'];

/*
 * The reference draws seven circles that gather into its logo. Here they carry the product's
 * one rule: six stages around a single bay. Spread out, each circle names its stage; as the page
 * scrolls they close in on the centre, the way the car never leaves the bay it was booked on.
 * Coordinates are in viewBox units, where 100 is the width of the square stage.
 */
const R = 4;
const FAR = 21;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const SPOKES = [null, ...STAGE_LABELS.map((_, i) => ((-90 + i * 60) * Math.PI) / 180)];

const usePetal = (angle: number | null, gather: MotionValue<number>) => {
  const d = useTransform(gather, g => (angle === null ? 0 : FAR + (R - FAR) * easeInOut(g)));
  const x = useTransform(d, v => 50 + v * Math.cos(angle ?? 0));
  const y = useTransform(d, v => 50 + v * Math.sin(angle ?? 0));
  return { x, y };
};

const Petal = ({ i, gather, draw }: { i: number; gather: MotionValue<number>; draw: MotionValue<number> }) => {
  const { x, y } = usePetal(SPOKES[i], gather);
  return (
    <motion.circle cx={x} cy={y} r={R} fill={i === 0 ? 'rgba(239,68,68,.08)' : 'none'}
      stroke={i === 0 ? '#ef4444' : '#ffffff'} strokeOpacity={i === 0 ? 0.95 : 0.85} strokeWidth={0.16}
      style={{ pathLength: draw }} />
  );
};

const PetalLabel = ({ i, gather, opacity }: { i: number; gather: MotionValue<number>; opacity: MotionValue<number> }) => {
  const { x, y } = usePetal(SPOKES[i], gather);
  const left = useTransform(x, v => `${v}%`);
  const top = useTransform(y, v => `${v}%`);
  return (
    <motion.span className="swl-petal-label" style={{ left, top, opacity }}>
      {i === 0 ? (
        <><span className="swl-petal-num">همه روی</span>یک جایگاه</>
      ) : (
        <><span className="swl-petal-num">{`مرحله‌ی ${i.toLocaleString('fa-IR')}`}</span>{STAGE_LABELS[i - 1]}</>
      )}
    </motion.span>
  );
};

const Rings = ({ progress }: { progress: MotionValue<number> }) => {
  // Keyframes follow the reference's logo scroll: fade in by 35%, gather by 55%, then turn once
  // and grow while the section leaves.
  const opacity = useTransform(progress, [0.2, 0.35], [0, 1]);
  const y = useTransform(progress, [0.2, 0.35], ['20vh', '0vh']);
  const lift = useTransform(progress, [0, 0.45], ['10rem', '0rem']);
  const draw = useTransform(progress, [0.18, 0.34], [0, 1]);
  const labels = useTransform(progress, [0.24, 0.31, 0.37, 0.45], [0, 1, 1, 0]);
  const gather = useTransform(progress, [0.31, 0.55], [0, 1]);
  const scale = useTransform(progress, [0.55, 1], [1, 1.4]);
  const rotate = useTransform(progress, [0.55, 1], [0, 360]);
  const glow = useTransform(progress, [0.35, 0.45], [0, 0.25]);
  return (
    <div className="swl-rings-sticky" aria-hidden="true">
      <motion.div className="swl-glow" style={{ height: '70vh', maxHeight: '50rem', opacity: glow }} />
      <div className="swl-rings-area">
        <motion.div className="swl-rings-ell" style={{ opacity, y: lift }}>
          <motion.div className="absolute inset-0" style={{ y, scale, rotate }}>
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
              {SPOKES.map((_, i) => <Petal key={i} i={i} gather={gather} draw={draw} />)}
            </svg>
            {SPOKES.map((_, i) => <PetalLabel key={i} i={i} gather={gather} opacity={labels} />)}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export const Opening = () => {
  const ringsRef = useRef<HTMLElement>(null);
  const cinematic = useCinematic();
  const progress = useProgress(ringsRef, ['start end', 'end start']);
  const phoneY = useTransform(progress, [0, 0.55], ['0rem', cinematic ? '-28rem' : '0rem']);
  return (
    <>
      <Hero phoneY={phoneY} />
      <section ref={ringsRef} className="swl-rings-height" aria-label="شش مرحله‌ی مسیر خودرو، روی یک جایگاه">
        <div className="swl-rings-sub">
          <Rings progress={progress} />
        </div>
      </section>
    </>
  );
};
