import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';

/**
 * The drawn half of the public site.
 *
 * A page of white cards and headings describes a carwash without ever looking like one. These
 * are the pictures: a car in the bay under brushes and water, soap drifting up past it, the
 * panel held in a phone and a laptop, and foam edges where sections meet.
 *
 * Everything is drawn rather than photographed, for two reasons. A photograph of someone
 * else's carwash is a promise we did not make, and a stock photo served from abroad is a
 * broken image for most of the people this is sold to. These are vectors: a few kilobytes,
 * sharp at any size, in the brand's own colours, and they move.
 */

/* The car: body, glass, and the arches its wheels sit in. */
const BODY = 'M44 134c0-20 12-29 30-33l44-30c9-8 21-12 35-12h116c20 0 36 6 48 18l24 24c26 4 48 10 60 18 8 6 10 14 8 21l-4 7c-2 4-6 6-10 6H58c-8 0-14-7-14-15Z';
const WINDSHIELD = 'M131 66c6-6 15-9 25-9h34v37h-84Z';
const REAR_GLASS = 'M204 57h38c14 0 25 5 33 13l15 16v8h-86Z';
const ARCH_FRONT = 'M108 150a38 38 0 0 1 76 0Z';
const ARCH_REAR = 'M292 150a38 38 0 0 1 76 0Z';

/**
 * A car inside the bay: jets from the beam above, a rotating brush on each side, foam sliding
 * down the paint and sparkles once it is clean.
 *
 * The paint is the brand's red and the water is the blue the panel uses for the washing
 * stage, so the picture and the product speak in the same colours.
 */
export const CarWashScene = ({ className, compact = false, withCar = true }: { className?: string; compact?: boolean; withCar?: boolean }) => {
  const still = useReducedMotion();
  const nozzles = [110, 170, 230, 290, 350, 410];
  const foam = [
    { cx: 92, r: 26, d: 0 }, { cx: 142, r: 32, d: 0.4 }, { cx: 198, r: 24, d: 0.9 },
    { cx: 256, r: 34, d: 0.2 }, { cx: 312, r: 26, d: 0.7 }, { cx: 372, r: 30, d: 1.1 },
    { cx: 424, r: 22, d: 0.5 },
  ];

  return (
    <div className={clsx('sw-scene', className)} aria-hidden>
      <svg viewBox="0 0 520 250" className="sw-scene-svg" role="img">
        <defs>
          <linearGradient id="swPaint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(74% 0.19 24)" />
            <stop offset="52%" stopColor="oklch(58% 0.24 27)" />
            <stop offset="100%" stopColor="oklch(42% 0.17 27)" />
          </linearGradient>
          <linearGradient id="swGlass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(95% 0.03 235)" />
            <stop offset="100%" stopColor="oklch(76% 0.09 238)" />
          </linearGradient>
          <linearGradient id="swArch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(94% 0.03 235)" />
            <stop offset="100%" stopColor="oklch(84% 0.05 238)" />
          </linearGradient>
          <linearGradient id="swJet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(78% 0.13 235 / 0.95)" />
            <stop offset="100%" stopColor="oklch(90% 0.06 235 / 0)" />
          </linearGradient>
          <radialGradient id="swShine" cx="34%" cy="22%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="swFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(86% 0.04 235 / 0.7)" />
            <stop offset="100%" stopColor="oklch(96% 0.01 235 / 0)" />
          </linearGradient>
          <clipPath id="swBodyClip"><path d={BODY} /></clipPath>
        </defs>

        {/* the bay itself: an arch over the car with a beam of nozzles */}
        <path d="M34 214V92c0-28 22-50 50-50h352c28 0 50 22 50 50v122"
          fill="none" stroke="url(#swArch)" strokeWidth="13" strokeLinecap="round" />
        <path d="M66 72h388" stroke="oklch(88% 0.04 238)" strokeWidth="7" strokeLinecap="round" />

        {nozzles.map((x, i) => (
          <g key={x}>
            <rect x={x - 4} y="75" width="8" height="9" rx="3" fill="oklch(80% 0.06 238)" />
            <motion.path
              d={`M${x} 84 C ${x - 6} 104, ${x + 6} 120, ${x} 142`}
              stroke="url(#swJet)" strokeWidth="3" strokeLinecap="round" fill="none"
              initial={{ opacity: still ? 0.5 : 0.12 }}
              animate={still ? undefined : { opacity: [0.12, 0.85, 0.12] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            />
          </g>
        ))}

        <ellipse cx="260" cy="206" rx="210" ry="17" fill="url(#swFloor)" />

        {/* The drawn car steps aside once the modelled one has loaded into the same bay;
            two cars in one bay is one car too many. */}
        {withCar && (<>
        <g>
          <ellipse cx="260" cy="192" rx="178" ry="11" fill="oklch(40% 0.06 260 / 0.16)" />
          <path d={BODY} fill="url(#swPaint)" />
          <path d={BODY} fill="url(#swShine)" />
          <path d={ARCH_FRONT} fill="oklch(32% 0.08 27)" opacity=".5" />
          <path d={ARCH_REAR} fill="oklch(32% 0.08 27)" opacity=".5" />
          <path d={WINDSHIELD} fill="url(#swGlass)" />
          <path d={REAR_GLASS} fill="url(#swGlass)" />
          <path d="M194 57h7v37h-7z" fill="oklch(40% 0.12 27)" opacity=".45" />
          <path d="M168 104h124" stroke="oklch(38% 0.14 27)" strokeWidth="2" strokeLinecap="round" opacity=".4" />
          <rect x="214" y="108" width="25" height="6" rx="3" fill="oklch(92% 0.02 27)" opacity=".85" />
          <path d="M418 118h26c6 0 10 4 10 9s-4 9-10 9h-26Z" fill="oklch(93% 0.1 90)" opacity=".95" />
          <path d="M50 120h20v16H54c-5 0-9-4-9-8 0-5 2-8 5-8Z" fill="oklch(72% 0.2 25)" opacity=".9" />

          {/* foam sliding down the paint */}
          <g clipPath="url(#swBodyClip)">
            {foam.map(f => (
              <motion.circle
                key={f.cx}
                cx={f.cx} fill="#fff"
                // Radius belongs in initial, like every other value motion writes on this
                // element: passed as a bare attribute it was missing on the first frame and
                // the browser rejected r="undefined" once per blob of foam.
                initial={{ r: f.r, cy: still ? 92 : 46, opacity: still ? 0.5 : 0 }}
                animate={still ? undefined : { cy: [46, 170], opacity: [0, 0.7, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, delay: f.d, ease: 'easeIn' }}
              />
            ))}
          </g>
        </g>

        {/* wheels, turning as the car rolls through */}
        {[146, 330].map((cx, i) => (
          <g key={cx}>
            <circle cx={cx} cy="150" r="29" fill="oklch(24% 0.02 260)" />
            <circle cx={cx} cy="150" r="14" fill="oklch(88% 0.01 260)" />
            <motion.g
              style={{ originX: `${cx}px`, originY: '150px' }}
              animate={still ? undefined : { rotate: 360 }}
              transition={{ duration: 6 + i, repeat: Infinity, ease: 'linear' }}
            >
              {[0, 60, 120, 180, 240, 300].map(a => (
                <rect key={a} x={cx - 1.5} y="138" width="3" height="10" rx="1.5"
                  fill="oklch(58% 0.02 260)" transform={`rotate(${a} ${cx} 150)`} />
              ))}
            </motion.g>
          </g>
        ))}

        </>)}

        {/* the tunnel's two brushes, turning against the car */}
        {[38, 482].map((cx, i) => (
          <motion.g
            key={cx}
            style={{ originX: `${cx}px`, originY: '140px' }}
            animate={still ? undefined : { rotate: i === 0 ? 360 : -360 }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 14 }, (_, k) => (
              <rect key={k} x={cx - 3} y="102" width="6" height="22" rx="3"
                fill={k % 2 ? 'oklch(78% 0.1 300)' : 'oklch(87% 0.07 300)'}
                transform={`rotate(${k * 25.7} ${cx} 140)`} />
            ))}
            <circle cx={cx} cy="140" r="11" fill="oklch(62% 0.14 300)" />
          </motion.g>
        ))}

        {/* beads of water, then sparkles: the car is clean */}
        {!compact && [[116, 82], [224, 74], [320, 88], [390, 108]].map(([x, y], i) => (
          <motion.circle
            key={`${x}-${y}`} cx={x} cy={y} fill="#fff"
            // The radius is animated, so it has to start as a number motion owns. Left as a
            // plain attribute, the first frame wrote r="undefined" and the browser complained
            // once per bead on every load.
            initial={{ r: 3.5, opacity: 0.7 }}
            animate={still ? undefined : { r: [3.5, 5, 3.5], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.5 }}
          />
        ))}
        {[[96, 56], [270, 34], [446, 60]].map(([x, y], i) => (
          <motion.path
            key={`s${x}`}
            d={`M${x} ${y - 11} l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z`}
            fill="oklch(93% 0.11 95)"
            initial={{ opacity: still ? 0.85 : 0, scale: still ? 1 : 0.4 }}
            animate={still ? undefined : { opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: 0.8 + i * 0.9 }}
            style={{ originX: `${x}px`, originY: `${y}px` }}
          />
        ))}
      </svg>
    </div>
  );
};

/* ── Bubbles ──────────────────────────────────────────────────────────────── */

/** Soap drifting up behind a section. Pure decoration, and the first thing to stop moving. */
export const BubbleField = ({ count = 14, className }: { count?: number; className?: string }) => {
  const still = useReducedMotion();
  if (still) return null;
  const bubbles = Array.from({ length: count }, (_, i) => ({
    left: (i * 97) % 100,
    size: 8 + ((i * 37) % 26),
    delay: (i * 1.3) % 9,
    duration: 11 + ((i * 7) % 9),
  }));
  return (
    <div aria-hidden className={clsx('sw-bubbles', className)}>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="sw-bubble"
          style={{
            insetInlineStart: `${b.left}%`,
            width: b.size, height: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

/* ── Section edges ────────────────────────────────────────────────────────── */

/** A foam line between sections, so two bands of colour meet in something softer than a cut. */
export const FoamDivider = ({ flip = false, tone = 'sky', className }: { flip?: boolean; tone?: 'sky' | 'brand' | 'white'; className?: string }) => {
  const fill = tone === 'sky' ? 'oklch(97% 0.02 235)' : tone === 'brand' ? 'oklch(97.5% 0.015 25)' : '#fff';
  return (
    <div aria-hidden className={clsx('sw-divider', flip && 'sw-divider-flip', className)}>
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="block h-[56px] w-full md:h-[88px]">
        <path d="M0 40c120 30 240 44 360 36s240-38 360-44 240 16 360 30 180 14 360-4v32H0Z" fill={fill} />
        <g fill={fill}>
          {[[120, 30, 16], [300, 22, 11], [520, 34, 14], [760, 24, 9], [980, 32, 15], [1240, 26, 12]].map(([cx, cy, r]) => (
            <circle key={cx} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      </svg>
    </div>
  );
};

/* ── Device frames ────────────────────────────────────────────────────────── */

/** The panel in a laptop, so a screen reads as a screen and not a floating card. */
export const LaptopFrame = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={clsx('sw-laptop', className)}>
    <div className="sw-laptop-screen">
      <div className="sw-laptop-bar">
        <span className="flex gap-1.5">
          <i className="size-2 rounded-full bg-rose-300" />
          <i className="size-2 rounded-full bg-amber-300" />
          <i className="size-2 rounded-full bg-emerald-300" />
        </span>
        <span className="sw-laptop-url" dir="ltr">appsmartwash.com</span>
        <span className="w-10" />
      </div>
      <div className="sw-laptop-body">{children}</div>
    </div>
    <div className="sw-laptop-base" />
  </div>
);

/** The same panel in a phone: most of this product is used standing on a wet floor. */
export const PhoneFrame = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={clsx('sw-phone', className)}>
    <span className="sw-phone-notch" />
    <div className="sw-phone-screen">{children}</div>
  </div>
);

/* ── Small drawn marks ────────────────────────────────────────────────────── */

/** A drop of water, used as a bullet and a badge. */
export const Drop = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
    <path d="M12 2c4.5 6 7 9.5 7 13a7 7 0 1 1-14 0c0-3.5 2.5-7 7-13Z" fill="currentColor" />
    <path d="M9 14.5c0 1.5 1 2.8 2.4 3.2" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </svg>
);

/** The tunnel's brush head, drawn as a rosette; it marks washing wherever it appears. */
export const BrushMark = ({ size = 22, className }: { size?: number; className?: string }) => {
  const still = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden
      animate={still ? undefined : { rotate: 360 }}
      transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="18.6" y="1" width="2.8" height="13" rx="1.4" fill="currentColor" opacity={0.35 + (i % 3) * 0.22}
          transform={`rotate(${i * 30} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="6" fill="currentColor" />
    </motion.svg>
  );
};
