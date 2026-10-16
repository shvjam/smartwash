import React, { useEffect, useRef, useState } from 'react';
import {
  motion, useInView, useMotionValue, useReducedMotion, useScroll,
  useSpring, useTransform, animate, type MotionValue,
} from 'motion/react';
import clsx from 'clsx';

/**
 * The movement vocabulary of the public site, in one place.
 *
 * Three rules hold everything here together:
 *
 * 1. Nothing moves to decorate. Each motion either shows where something came from, keeps the
 *    eye on a value that is changing, or answers a pointer. A page that moves for its own sake
 *    reads as a template.
 * 2. The page is read right to left, so things enter from the right — the side a Persian
 *    reader starts on. An animation copied from a Latin layout feels backwards here even when
 *    nobody can say why.
 * 3. Every effect has an honest still version. Someone who asks their system for less motion
 *    gets the same page, fully readable, without any of it.
 */

/** Persian digits, the way every number on this site is written. */
export const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
export const faNum = (n: number) => fa(n.toLocaleString('fa-IR'));
/** Prices are held in rials and spoken in tomans, as the app does everywhere. */
export const toman = (rials: number) => faNum(Math.round(rials / 10));

const spring = { type: 'spring', stiffness: 260, damping: 30, mass: 0.8 } as const;

/**
 * Brings a block in as it is reached. The offset is the distance the eye has to travel back
 * to it — small, because a long slide is read as a page still loading.
 */
export const Reveal = ({
  children, delay = 0, y = 22, x = 0, className, once = true, as: Tag = 'div',
}: {
  children: React.ReactNode; delay?: number; y?: number; x?: number;
  className?: string; once?: boolean; as?: 'div' | 'section' | 'li' | 'span';
}) => {
  const still = useReducedMotion();
  const M = motion[Tag] as typeof motion.div;
  return (
    <M
      className={className}
      initial={still ? { opacity: 0 } : { opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once, margin: '-12% 0px -12% 0px' }}
      transition={still ? { duration: 0.35 } : { ...spring, delay }}
    >
      {children}
    </M>
  );
};

/** A list whose items arrive one after another, in reading order. */
export const Stagger = ({ children, className, step = 0.07 }: { children: React.ReactNode; className?: string; step?: number }) => {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '-10% 0px' }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: still ? 0 : step } } }}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem = ({ children, className, y = 18 }: { children: React.ReactNode; className?: string; y?: number }) => {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: still ? { opacity: 0 } : { opacity: 0, y, filter: 'blur(4px)' },
        shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: spring },
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * A number that counts up once, when it is reached.
 *
 * A figure that is simply printed is read as copy. The same figure arriving at its value is
 * read as a measurement, which is what these are.
 */
export const CountUp = ({
  to, decimals = 0, prefix = '', suffix = '', duration = 1.4, className,
}: { to: number; decimals?: number; prefix?: string; suffix?: string; duration?: number; className?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? to : 0);

  useEffect(() => {
    if (!inView || still) { if (still) setShown(to); return; }
    const controls = animate(0, to, {
      duration, ease: [0.16, 1, 0.3, 1], onUpdate: v => setShown(v),
    });
    return () => controls.stop();
  }, [inView, still, to, duration]);

  const text = decimals > 0 ? shown.toFixed(decimals) : Math.round(shown).toLocaleString('fa-IR');
  return <span ref={ref} className={className}>{prefix}{fa(text)}{suffix}</span>;
};

/**
 * A control that leans toward the pointer and settles back.
 *
 * Reserved for the two or three things the page actually wants pressed: the pull is a hint
 * that this is the way forward, and it stops meaning that if everything does it.
 */
export const Magnetic = ({ children, className, strength = 0.35 }: { children: React.ReactNode; className?: string; strength?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 320, damping: 22 });
  const y = useSpring(useMotionValue(0), { stiffness: 320, damping: 22 });

  if (still) return <span className={className}>{children}</span>;
  return (
    <motion.span
      ref={ref}
      className={clsx('inline-block', className)}
      style={{ x, y }}
      onPointerMove={e => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.span>
  );
};

/**
 * A card that turns a little toward the pointer, and carries a soft light where the pointer is.
 * Enough to say the surface is responsive; not enough to read as a toy.
 */
export const TiltCard = ({
  children, className, glow = true, max = 7,
}: { children: React.ReactNode; className?: string; glow?: boolean; max?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 20 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  // Built here rather than inside the branch below: a hook may not be called conditionally.
  const glowAt = useTransform([gx, gy] as MotionValue<number>[], ([a, b]: number[]) =>
    `radial-gradient(420px circle at ${a}% ${b}%, color-mix(in oklab, var(--color-brand-500) 14%, transparent), transparent 60%)`);

  return (
    <motion.div
      ref={ref}
      className={clsx('relative', className)}
      style={still ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={e => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || still) return;
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry.set((px - 0.5) * max * 2);
        rx.set((0.5 - py) * max * 2);
        gx.set(px * 100);
        gy.set(py * 100);
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); }}
    >
      {children}
      {glow && !still && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 [.group\\/tilt:hover_&]:opacity-100"
          style={{ background: glowAt }}
        />
      )}
    </motion.div>
  );
};

/** The thin line across the top that says how much of the page is left. */
export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden
      className="sw-scroll-progress"
      style={{ scaleX: width }}
    />
  );
};

/**
 * The colour behind the page: slow-moving washes of brand red, water blue and a violet, far
 * enough apart to read as light rather than as shapes.
 */
export const MeshBackdrop = ({ className }: { className?: string }) => (
  <div aria-hidden className={clsx('sw-mesh', className)}>
    <span className="sw-mesh-blob sw-mesh-a" />
    <span className="sw-mesh-blob sw-mesh-b" />
    <span className="sw-mesh-blob sw-mesh-c" />
  </div>
);

/** A row that never ends, for small proofs that should pass by rather than be read in order. */
export const Marquee = ({ items, className }: { items: React.ReactNode[]; className?: string }) => (
  <div className={clsx('sw-marquee', className)} aria-hidden={false}>
    <div className="sw-marquee-track">
      {[0, 1].map(copy => (
        <div className="sw-marquee-group" key={copy} aria-hidden={copy === 1}>
          {items.map((item, i) => (
            <span className="sw-marquee-item" key={i}>{item}</span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** Section openings share one shape so the page has a rhythm to scroll through. */
export const SectionHead = ({
  eyebrow, title, lead, align = 'center', tone = 'brand',
}: {
  eyebrow: string; title: React.ReactNode; lead?: React.ReactNode;
  align?: 'center' | 'start'; tone?: 'brand' | 'sky' | 'emerald' | 'violet';
}) => (
  <div className={clsx('mb-10 max-w-2xl md:mb-14', align === 'center' ? 'mx-auto text-center' : 'text-right')}>
    <Reveal>
      <span className={clsx('sw-eyebrow', `sw-eyebrow-${tone}`)}>{eyebrow}</span>
    </Reveal>
    <Reveal delay={0.05}>
      <h2 className="mt-4 text-balance text-3xl font-extrabold leading-[1.25] text-slate-900 md:text-[2.6rem]">{title}</h2>
    </Reveal>
    {lead && (
      <Reveal delay={0.1}>
        <p className="mt-4 text-pretty text-[15px] leading-8 text-slate-500 md:text-base">{lead}</p>
      </Reveal>
    )}
  </div>
);

/** Shared page gutters: one measure for every section, so edges line up down the page. */
export const Container = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={clsx('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
);
