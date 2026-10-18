import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, type MotionValue,
} from 'motion/react';
import type Lenis from 'lenis';

/* ── shared state ─────────────────────────────────────────────────────────── */

/** True once the preloader has gone, so the hero's entrance is not played behind it. */
export const IntroContext = createContext(true);
export const useIntro = () => useContext(IntroContext);

/** The smooth-scroll instance (null when the visitor prefers reduced motion). */
export const LenisContext = createContext<{ current: Lenis | null }>({ current: null });
export const useLenis = () => useContext(LenisContext);

/** Opens the quick-start pop-up (the reference's "Join Waitlist" form). */
export const StartContext = createContext<() => void>(() => {});
export const useStart = () => useContext(StartContext);

/** Scrolls to an in-page anchor through Lenis when it is running, natively otherwise. */
export const useScrollTo = () => {
  const lenis = useLenis();
  return (hash: string) => {
    const el = document.querySelector(hash);
    if (!(el instanceof HTMLElement)) return;
    if (lenis.current) lenis.current.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
};

const DESKTOP = '(min-width: 1024px)';
export const useIsDesktop = () => {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
};

/** Scroll-pinned choreography only runs on a wide screen with motion allowed. */
export const useCinematic = () => {
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  return desktop && !reduced;
};

type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>['offset'];

/**
 * Scroll progress through a section, as a plain motion value.
 *
 * Motion hands opacity and filter that are driven straight from `useScroll` to a native
 * ViewTimeline, but it only writes the keyframes inside the mapped range. Past the end of the
 * range the browser eases back to the element's own value, so a headline that had faded out
 * crept back in as the section kept scrolling. Mirroring the progress into an ordinary motion
 * value keeps every derived value on the JS path, where the ranges clamp as written.
 */
export const useProgress = (target: React.RefObject<HTMLElement | null>, offset: ScrollOffset) => {
  const { scrollYProgress } = useScroll({ target, offset });
  const progress = useMotionValue(0);
  useMotionValueEvent(scrollYProgress, 'change', v => progress.set(v));
  useEffect(() => { progress.set(scrollYProgress.get()); }, [scrollYProgress, progress]);
  return progress;
};

/* ── pointer velocity, for the inertia nudge on hover ─────────────────────── */

const pointer = { x: 0, y: 0, dx: 0, dy: 0, tracking: false };
const trackPointer = () => {
  if (pointer.tracking || typeof window === 'undefined') return;
  pointer.tracking = true;
  window.addEventListener('mousemove', e => {
    pointer.dx = e.clientX - pointer.x;
    pointer.dy = e.clientY - pointer.y;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });
};

/**
 * Throws the element along the pointer's travel and lets it spring home, with a small random
 * tilt — the way the reference's buttons and floating cards react to being touched.
 */
export const nudge = (el: HTMLElement | null, strength = 10, tilt = 10) => {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const spring = { type: 'spring' as const, stiffness: 160, damping: 13 };
  animate(el, { x: 0 }, { ...spring, velocity: pointer.dx * strength });
  animate(el, { y: 0 }, { ...spring, velocity: pointer.dy * strength });
  animate(el, { rotate: [0, (Math.random() - 0.5) * tilt, 0] }, { duration: 0.8, ease: 'easeInOut' });
};

/** Wraps a floating element so it reacts to the pointer (desktop only). */
export const Wobble = ({ children, className, strength = 20, tilt = 20 }: {
  children: React.ReactNode; className?: string; strength?: number; tilt?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(trackPointer, []);
  return (
    <div ref={ref} className={className}
      onMouseEnter={() => { if (window.matchMedia(DESKTOP).matches) nudge(ref.current, strength, tilt); }}>
      {children}
    </div>
  );
};

/* ── text ─────────────────────────────────────────────────────────────────── */

type SplitProps = {
  text: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div';
  preset?: 'right' | 'down';
  /** Split into letters (Latin wordmarks only — Persian letters must stay joined). */
  chars?: boolean;
  stagger?: number;
  delay?: number;
  className?: string;
  /** Wait for the preloader before playing. */
  intro?: boolean;
};

/** Words (or Latin letters) that blur into place once the text scrolls into view. */
export const Split = ({ text, as = 'span', preset = 'down', chars, stagger, delay = 0, className, intro }: SplitProps) => {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  const introDone = useIntro();
  const go = inView && (!intro || introDone);
  const parts = chars ? Array.from(text) : text.split(' ');
  const step = stagger ?? (chars ? 0.05 : preset === 'right' ? 0.09 : 0.05);
  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={`swl-split ${go ? 'is-in' : ''} ${className ?? ''}`} data-preset={preset}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            <span className="swl-split-w" style={{ transitionDelay: `${delay + i * step}s` }}>{p === ' ' ? '\u00a0' : p}</span>
            {!chars && i < parts.length - 1 ? ' ' : null}
          </React.Fragment>
        ))}
      </span>
    </Tag>
  );
};

/** A label whose words roll up and are replaced by a copy rolling in from below on hover. */
export const Roll = ({ text }: { text: string }) => {
  const words = text.split(' ');
  const row = (hidden?: boolean) => (
    <span className={hidden ? 'swl-roll-b' : 'swl-roll-a'} aria-hidden={hidden || undefined}>
      {words.map((w, i) => (
        <span key={i} className="swl-roll-w" style={{ transitionDelay: `${i * 0.04}s` }}>{w}</span>
      ))}
    </span>
  );
  return <span className="swl-roll">{row()}{row(true)}</span>;
};

/** Scales in from the centre (or from below) when scrolled into view. */
export const View = ({ children, className, from = 'center', delay = 0, style, as = 'div' }: {
  children?: React.ReactNode; className?: string; from?: 'center' | 'down'; delay?: number;
  style?: React.CSSProperties; as?: 'div' | 'span';
}) => {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={`${from === 'down' ? 'swl-v-down' : 'swl-v-center'} ${inView ? 'is-in' : ''} ${className ?? ''}`}
      style={{ ...style, transitionDelay: delay ? `${delay}s` : undefined }}>
      {children}
    </Tag>
  );
};

/* ── buttons ──────────────────────────────────────────────────────────────── */

type BtnProps = {
  children: React.ReactNode;
  variant?: 'red' | 'light' | 'ghost';
  to?: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  'aria-label'?: string;
};

export const Btn = ({ children, variant = 'red', to, href, onClick, className, type = 'button', disabled, ...rest }: BtnProps) => {
  const bg = useRef<HTMLSpanElement>(null);
  useEffect(trackPointer, []);
  const cls = `swl-btn ${variant === 'light' ? 'swl-btn--light' : variant === 'ghost' ? 'swl-btn--ghost' : ''} ${className ?? ''}`;
  const inner = (
    <>
      <span ref={bg} className="swl-btn-bg" aria-hidden="true" />
      {children}
    </>
  );
  const enter = () => nudge(bg.current, 10, 10);
  if (to) return <Link to={to} className={cls} onMouseEnter={enter} onClick={onClick} aria-label={rest['aria-label']}>{inner}</Link>;
  if (href) return <a href={href} className={cls} onMouseEnter={enter} onClick={onClick} aria-label={rest['aria-label']}>{inner}</a>;
  return <button type={type} className={cls} onMouseEnter={enter} onClick={onClick} disabled={disabled} aria-label={rest['aria-label']}>{inner}</button>;
};

/* ── the rotating gradient border ─────────────────────────────────────────── */

export const Stroke = ({ children, className, innerClassName, glow = true, style }: {
  children: React.ReactNode; className?: string; innerClassName?: string; glow?: boolean; style?: React.CSSProperties;
}) => (
  <div className={`swl-stroke ${className ?? ''}`} style={style}>
    {glow && <div className="swl-stroke-point" aria-hidden="true"><div className="swl-stroke-glow" /></div>}
    <div className={`swl-stroke-inner ${innerClassName ?? ''}`}>{children}</div>
  </div>
);

/* ── brand mark (the ring and sparkle from the SmartWash logo) ────────────── */

const arc = (r: number, a0: number, a1: number) => {
  const p = (a: number) => [50 + r * Math.cos((a * Math.PI) / 180), 50 + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
export const RING_SEGMENTS = [
  { d: arc(42, 186, 265), red: true },
  { d: arc(42, 275, 354), red: true },
  { d: arc(42, 6, 85), red: false },
  { d: arc(42, 95, 174), red: false },
];
export const SPARKLE = 'M50 22 C52.2 40 60 47.8 78 50 C60 52.2 52.2 60 50 78 C47.8 60 40 52.2 22 50 C40 47.8 47.8 40 50 22Z';

export const BrandMark = ({ size, rotate, className }: { size?: number | string; rotate?: MotionValue<number>; className?: string }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
    <motion.g style={{ rotate, originX: '50px', originY: '50px' }}>
      {RING_SEGMENTS.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={s.red ? '#e5302a' : '#6b6a70'} strokeWidth="9" strokeLinecap="butt" />
      ))}
    </motion.g>
    <path d={SPARKLE} fill="#ef3b2f" transform="translate(50 50) scale(.62) translate(-50 -50)" />
  </svg>
);

/** A four-point sparkle with a soft halo, used where the reference uses its rotating star. */
export const Sparkle = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
    <defs>
      <radialGradient id="swl-spark-halo">
        <stop offset="0" stopColor="#ffd2cc" stopOpacity=".55" />
        <stop offset=".35" stopColor="#ff5a4b" stopOpacity=".18" />
        <stop offset="1" stopColor="#ff5a4b" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#swl-spark-halo)" />
    <path d={SPARKLE} fill="#fff" transform="translate(50 50) scale(.55) translate(-50 -50)" />
    <path d={SPARKLE} fill="#fff" opacity=".35" transform="translate(50 50) rotate(45) scale(.3) translate(-50 -50)" />
  </svg>
);

/* ── canvases ─────────────────────────────────────────────────────────────── */

/** Runs a draw loop on a canvas that fills its parent, only while it is on screen. */
const useCanvasLoop = (
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, setup: boolean) => void,
  fps = 30,
) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0, h = 0, raf = 0, last = 0, visible = true, setup = true;
    const t0 = performance.now();
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setup = true;
      if (reduced) { draw(ctx, w, h, 0, true); setup = false; }
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 1000 / fps) return;
      last = now;
      draw(ctx, w, h, (now - t0) / 1000, setup);
      setup = false;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    if (!reduced) raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [draw, fps, reduced]);
  return ref;
};

type Dot = { x: number; y: number; r: number; vx: number; vy: number; a: number; s: number; red: boolean };

/** Slowly drifting specks of light — the reference's particle layer, as fine spray. */
export const Particles = ({ density = 1, className }: { density?: number; className?: string }) => {
  const dots = useRef<Dot[]>([]);
  const draw = React.useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number, setup: boolean) => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if (setup) {
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      const n = Math.min(160, Math.round(((w * h) / 9000) * density * (saveData ? 0.4 : 1)));
      dots.current = Array.from({ length: n }, () => {
        const front = Math.random() < 0.35;
        return {
          x: Math.random() * w, y: Math.random() * h,
          r: Math.max(0.6, (front ? 0.235 : 0.15) * rem * 0.5),
          vx: (Math.random() - 0.5) * 6, vy: -(2 + Math.random() * 8) * (front ? 1.4 : 1),
          a: front ? 0.75 : 0.4, s: Math.random() * Math.PI * 2, red: Math.random() < 0.18,
        };
      });
    }
    ctx.clearRect(0, 0, w, h);
    const dt = 1 / 30;
    for (const d of dots.current) {
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; }
      if (d.x < -4) d.x = w + 4; else if (d.x > w + 4) d.x = -4;
      const tw = 0.55 + 0.45 * Math.sin(t * 1.6 + d.s);
      ctx.globalAlpha = d.a * tw;
      ctx.fillStyle = d.red ? '#ff8a7a' : '#ffffff';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [density]);
  const ref = useCanvasLoop(draw, 30);
  return <canvas ref={ref} className={`swl-particles ${className ?? ''}`} aria-hidden="true" />;
};

/**
 * Flowing lines of light, standing in for the reference's background video. Each line is a
 * band of water sheeting across the screen; the bundle stays a few kilobytes instead of a
 * multi-megabyte clip.
 */
export const WaveField = ({ className, lines = 38, intensity = 1 }: { className?: string; lines?: number; intensity?: number }) => {
  const draw = React.useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(120,10,10,0)');
    grad.addColorStop(0.22, 'rgba(200,30,30,.9)');
    grad.addColorStop(0.5, 'rgba(255,110,90,1)');
    grad.addColorStop(0.78, 'rgba(200,30,30,.9)');
    grad.addColorStop(1, 'rgba(120,10,10,0)');
    ctx.strokeStyle = grad;
    const step = Math.max(8, w / 140);
    for (let i = 0; i < lines; i++) {
      const k = i / (lines - 1);
      const base = h * (0.32 + 0.62 * k);
      ctx.globalAlpha = (0.05 + 0.32 * Math.pow(Math.sin(Math.PI * k), 2)) * intensity;
      ctx.lineWidth = 1 + (k > 0.45 && k < 0.6 ? 0.6 : 0);
      ctx.beginPath();
      for (let x = -step; x <= w + step; x += step) {
        const u = x / w;
        const bulge = Math.exp(-Math.pow((u - 0.5) / 0.22, 2));
        const y = base
          + Math.sin(u * 7 + t * 0.55 + i * 0.21) * h * 0.035
          + Math.sin(u * 15 - t * 0.35 + i * 0.45) * h * 0.012
          - bulge * h * 0.16 * (1 - k * 0.6);
        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [lines, intensity]);
  const ref = useCanvasLoop(draw, 30);
  return <canvas ref={ref} className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true" />;
};
