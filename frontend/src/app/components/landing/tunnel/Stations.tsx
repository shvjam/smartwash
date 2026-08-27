import React from 'react';
import { motion, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';
import bubblesUrl from '../../../../imports/bubbles.svg';
import sparklesUrl from '../../../../imports/sparkles.svg';

/*
  Stations — all 8 stations of the SmartWash tunnel.

  Each station receives the master `progress` (0..1) and the smoothed `velocity`
  MotionValues. Internally each station defines its own scroll window via
  useTransform, so visuals only appear within that window.

  IMPORTANT: motion/react exposes MotionValue only as a type — that's why every
  MotionValue prop is typed via `import type` above.
*/

type Common = { progress: MotionValue<number>; velocity: MotionValue<number> };

const rand = (seed: number) => {
  const x = Math.sin(seed * 9973.13) * 43758.5453;
  return x - Math.floor(x);
};

/* ───────────────────────── 1. Entrance arch ───────────────────────── */
export const EntranceArch: React.FC<Common> = ({ progress }) => {
  const x = useTransform(progress, [0.04, 0.18], ['120%', '-120%']);
  const opacity = useTransform(progress, [0.03, 0.06, 0.16, 0.20], [0, 1, 1, 0]);
  return (
    <motion.div
      className="absolute left-1/2 top-[18%] -translate-x-1/2 pointer-events-none"
      style={{ x, opacity, zIndex: 9 }}
    >
      <div
        className="relative px-10 py-3 rounded-xl"
        style={{
          background:
            'linear-gradient(180deg, #ff5563 0%, #c81f30 100%)',
          color: 'white',
          fontWeight: 900,
          fontSize: 'clamp(18px, 2.4vw, 30px)',
          letterSpacing: '2px',
          boxShadow: '0 10px 28px rgba(200,30,50,0.45), inset 0 -4px 0 rgba(0,0,0,0.18)',
        }}
      >
        WELCOME TO SmartWash
        {/* striped trim */}
        <div
          className="absolute -inset-x-2 -bottom-3 h-3 rounded"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #ff5563 0 10px, #fff 10px 20px)',
          }}
        />
      </div>
    </motion.div>
  );
};

/* ───────────────────────── 2. Pre-soak mist ───────────────────────── */
export const PreSoakMist: React.FC<Common> = ({ progress }) => {
  const opacity = useTransform(progress, [0.12, 0.18, 0.26, 0.30], [0, 1, 1, 0]);
  const drops = React.useMemo(
    () => Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: 6 + rand(i + 1) * 88,
      size: 3 + rand(i + 7) * 5,
      delay: rand(i + 11) * 1.2,
      duration: 1.6 + rand(i + 17) * 1.6,
    })),
    [],
  );
  return (
    <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity, zIndex: 12 }}>
      {drops.map((d) => (
        <motion.div
          key={d.id}
          initial={{ opacity: 0, y: '-20vh' }}
          animate={{ opacity: [0, 0.85, 0], y: ['-20vh', '85vh'] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, repeatDelay: 0.2, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            left: `${d.left}%`,
            width: d.size,
            height: d.size * 2.4,
            borderRadius: '50%',
            background: 'linear-gradient(180deg, rgba(180,220,255,0.95) 0%, rgba(180,220,255,0.3) 100%)',
            filter: 'blur(0.5px)',
          }}
        />
      ))}
      {/* fog band */}
      <motion.div
        className="absolute inset-x-0"
        style={{
          top: '40%',
          height: '20%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
          filter: 'blur(8px)',
        }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
};

/* ───────────────────────── 3. Soap nozzles ───────────────────────── */
export const SoapNozzles: React.FC<Common> = ({ progress }) => {
  const opacity = useTransform(progress, [0.22, 0.28, 0.42, 0.46], [0, 1, 1, 0]);
  const nozzleX = useTransform(progress, [0.22, 0.46], ['115%', '-15%']);
  return (
    <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity, zIndex: 13 }}>
      {/* Top nozzle + jet */}
      <motion.div className="absolute" style={{ top: '14%', x: nozzleX, left: '0%' }}>
        <div
          style={{
            width: 64,
            height: 22,
            borderRadius: 6,
            background: 'linear-gradient(180deg, #f0f4ff 0%, #98a8c4 100%)',
            boxShadow: 'inset 0 -3px 4px rgba(0,0,0,0.25)',
          }}
        />
        <motion.div
          style={{
            position: 'absolute',
            top: 22,
            left: 18,
            width: 28,
            height: 220,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247,205,214,0.9) 60%, rgba(247,205,214,0) 100%)',
            filter: 'blur(2px)',
            transformOrigin: 'top center',
          }}
          animate={{ scaleY: [1, 1.15, 0.95, 1] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      {/* Bottom nozzle + jet */}
      <motion.div className="absolute" style={{ bottom: '24%', x: nozzleX, left: '6%' }}>
        <div
          style={{
            width: 64,
            height: 22,
            borderRadius: 6,
            background: 'linear-gradient(0deg, #f0f4ff 0%, #98a8c4 100%)',
            boxShadow: 'inset 0 3px 4px rgba(0,0,0,0.25)',
          }}
        />
        <motion.div
          style={{
            position: 'absolute',
            bottom: 22,
            left: 18,
            width: 28,
            height: 180,
            background:
              'linear-gradient(0deg, rgba(255,255,255,0.95) 0%, rgba(247,205,214,0.9) 60%, rgba(247,205,214,0) 100%)',
            filter: 'blur(2px)',
            transformOrigin: 'bottom center',
          }}
          animate={{ scaleY: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      {/* Foam bubbles drifting from the jets */}
      {Array.from({ length: 18 }).map((_, i) => {
        const r1 = rand(i + 31);
        const r2 = rand(i + 51);
        return (
          <motion.img
            key={i}
            src={bubblesUrl}
            alt=""
            draggable={false}
            className="absolute"
            style={{
              left: `${20 + r1 * 60}%`,
              top: `${20 + r2 * 50}%`,
              width: `${10 + r1 * 8}%`,
              opacity: 0.85,
              filter: 'drop-shadow(0 4px 8px rgba(180,110,130,0.2))',
            }}
            animate={{ y: [0, -30, 0], scale: [0.9, 1.05, 0.9], opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.6 + r1, delay: r1 * 0.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        );
      })}
    </motion.div>
  );
};

/* ───────────────────────── 4. Brush tunnel ───────────────────────── */
export const BrushTunnel: React.FC<Common> = ({ progress, velocity }) => {
  const opacity = useTransform(progress, [0.40, 0.45, 0.55, 0.59], [0, 1, 1, 0]);
  const x = useTransform(progress, [0.40, 0.59], ['115%', '-25%']);
  // Brush spin: progress drives base rotation, velocity adds a kick.
  const baseSpin = useTransform(progress, [0.40, 0.59], [0, 1440]);
  const kick = useTransform(velocity, [-1, 0, 1], [-240, 0, 240]);
  const rotate = useTransform([baseSpin, kick], ([b, k]: number[]) => (b ?? 0) + (k ?? 0));
  return (
    <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity, zIndex: 13 }}>
      <motion.div className="absolute inset-y-0 flex flex-col justify-center gap-[14vh]" style={{ x, left: '0%' }}>
        {/* Top brush */}
        <motion.div
          style={{
            width: '24vmin',
            height: '24vmin',
            maxWidth: 240,
            maxHeight: 240,
            borderRadius: '50%',
            rotate,
            background:
              'conic-gradient(from 0deg, #ffd86b 0deg 14deg, #5a3142 14deg 28deg, #ffd86b 28deg 42deg, #5a3142 42deg 56deg, #ffd86b 56deg 70deg, #5a3142 70deg 84deg, #ffd86b 84deg 98deg, #5a3142 98deg 112deg, #ffd86b 112deg 126deg, #5a3142 126deg 140deg)',
            boxShadow: '0 12px 28px rgba(40,10,20,0.35), inset 0 0 0 6px rgba(0,0,0,0.25)',
          }}
        />
        {/* Bottom brush */}
        <motion.div
          style={{
            width: '22vmin',
            height: '22vmin',
            maxWidth: 220,
            maxHeight: 220,
            borderRadius: '50%',
            rotate: useTransform(rotate, (r: number) => -r),
            background:
              'conic-gradient(from 0deg, #98c4ff 0deg 18deg, #324f78 18deg 36deg, #98c4ff 36deg 54deg, #324f78 54deg 72deg, #98c4ff 72deg 90deg, #324f78 90deg 108deg, #98c4ff 108deg 126deg, #324f78 126deg 144deg, #98c4ff 144deg 162deg, #324f78 162deg 180deg)',
            boxShadow: '0 -12px 28px rgba(40,10,20,0.35), inset 0 0 0 6px rgba(0,0,0,0.25)',
          }}
        />
      </motion.div>
    </motion.div>
  );
};

/* ───────────────────────── 5. Rinse jets ───────────────────────── */
export const RinseJets: React.FC<Common> = ({ progress }) => {
  const opacity = useTransform(progress, [0.52, 0.58, 0.66, 0.70], [0, 1, 1, 0]);
  const streams = React.useMemo(
    () => Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      top: 18 + rand(i + 5) * 68,
      length: 30 + rand(i + 19) * 38,
      delay: rand(i + 27) * 0.5,
      duration: 0.55 + rand(i + 33) * 0.6,
    })),
    [],
  );
  return (
    <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity, zIndex: 13 }}>
      {streams.map((s) => (
        <motion.div
          key={s.id}
          initial={{ x: '-30%', opacity: 0 }}
          animate={{ x: '130vw', opacity: [0, 0.95, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, repeatDelay: 0.05, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: `${s.top}%`,
            height: 3,
            width: `${s.length}vw`,
            background: 'linear-gradient(90deg, rgba(140,200,255,0) 0%, rgba(180,230,255,1) 50%, rgba(140,200,255,0) 100%)',
            borderRadius: 3,
            filter: 'blur(0.4px) drop-shadow(0 0 6px rgba(140,200,255,0.7))',
          }}
        />
      ))}
      {/* falling droplets */}
      {Array.from({ length: 14 }).map((_, i) => {
        const r1 = rand(i + 71);
        return (
          <motion.div
            key={`d${i}`}
            initial={{ y: '-10vh', opacity: 0 }}
            animate={{ y: '110vh', opacity: [0, 1, 0] }}
            transition={{ duration: 1.0 + r1 * 0.6, delay: r1 * 0.4, repeat: Infinity, repeatDelay: 0.1, ease: 'easeIn' }}
            style={{
              position: 'absolute',
              left: `${10 + r1 * 80}%`,
              width: 5,
              height: 9,
              borderRadius: '50%',
              background: 'rgba(140,200,255,0.95)',
              boxShadow: '0 0 6px rgba(140,200,255,0.7)',
            }}
          />
        );
      })}
    </motion.div>
  );
};

/* ───────────────────────── 6. Dryer ───────────────────────── */
export const Dryer: React.FC<Common & { pointerX: MotionValue<number> }> = ({ progress, pointerX }) => {
  const opacity = useTransform(progress, [0.66, 0.72, 0.78, 0.82], [0, 1, 1, 0]);
  const streaks = React.useMemo(
    () => Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      top: 10 + rand(i + 9) * 78,
      length: 60 + rand(i + 13) * 90,
      delay: rand(i + 21) * 0.7,
      duration: 0.45 + rand(i + 29) * 0.4,
    })),
    [],
  );
  // The streaks bend left/right slightly with the mouse — adds 'I can play with it' feel.
  const bend = useTransform(pointerX, [-1, 1], [-4, 4]);
  return (
    <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity, zIndex: 13 }}>
      {streaks.map((s) => (
        <motion.div
          key={s.id}
          initial={{ x: '-40%', opacity: 0 }}
          animate={{ x: '140vw', opacity: [0, 0.85, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, repeatDelay: 0.05, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: `${s.top}%`,
            height: 2,
            width: `${s.length}vw`,
            background: 'linear-gradient(90deg, rgba(200,220,240,0) 0%, rgba(200,220,240,0.9) 50%, rgba(200,220,240,0) 100%)',
            borderRadius: 2,
            filter: 'blur(0.5px)',
            rotate: bend,
          }}
        />
      ))}
    </motion.div>
  );
};

/* ───────────────────────── 7. Polish station ───────────────────────── */
export const PolishStation: React.FC<Common> = ({ progress }) => {
  const opacity = useTransform(progress, [0.78, 0.82, 0.88, 0.90], [0, 1, 1, 0]);
  const x = useTransform(progress, [0.78, 0.90], ['-40%', '140%']);
  return (
    <motion.div className="absolute inset-0 pointer-events-none" style={{ opacity, zIndex: 15 }}>
      <motion.div
        className="absolute inset-y-0 w-1/2"
        style={{
          x,
          background:
            'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.95) 50%, transparent 70%)',
          filter: 'blur(2px)',
        }}
      />
      {/* Sparkles bloom outward */}
      {Array.from({ length: 8 }).map((_, i) => {
        const r1 = rand(i + 61);
        return (
          <motion.img
            key={i}
            src={sparklesUrl}
            alt=""
            draggable={false}
            className="absolute"
            style={{
              left: `${30 + r1 * 40}%`,
              top: `${28 + rand(i + 81) * 40}%`,
              width: `${4 + r1 * 3}%`,
              filter: 'drop-shadow(0 0 6px rgba(255,220,140,0.9))',
            }}
            animate={{ scale: [0.5, 1.2, 0.9], opacity: [0, 1, 0], rotate: [0, 20, 0] }}
            transition={{ duration: 1.2, delay: r1 * 1.0, repeat: Infinity, ease: 'easeOut' }}
          />
        );
      })}
    </motion.div>
  );
};

/* ───────────────────────── 8. Crown ceremony ───────────────────────── */
export const CrownCeremony: React.FC<Common> = ({ progress }) => {
  const opacity = useTransform(progress, [0.85, 0.90, 0.96, 0.99], [0, 1, 1, 0]);
  // Crown falls from above and lands at ~46% top.
  const crownY = useTransform(progress, [0.85, 0.92, 0.96], ['-50vh', '0vh', '-1vh']);
  const crownScale = useTransform(progress, [0.85, 0.92, 0.96], [0.6, 1.1, 1.0]);
  const flashOpacity = useTransform(progress, [0.88, 0.92, 0.95], [0, 1, 0]);
  return (
    <motion.div className="absolute inset-0 pointer-events-none" style={{ opacity, zIndex: 20 }}>
      {/* golden flash */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: flashOpacity,
          background:
            'radial-gradient(circle at 50% 38%, rgba(255,210,90,0.85) 0%, rgba(255,180,60,0.0) 55%)',
        }}
      />
      {/* shockwave ring */}
      <motion.div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{
          width: 80,
          height: 80,
          borderColor: 'rgba(255,210,90,0.85)',
          boxShadow: '0 0 30px rgba(255,210,90,0.6)',
          scale: useTransform(progress, [0.90, 0.96], [0.2, 5]),
          opacity: useTransform(progress, [0.90, 0.93, 0.96], [0, 0.9, 0]),
        }}
      />
      {/* falling crown SVG */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: '32%',
          width: 'min(22vw, 220px)',
          aspectRatio: '1 / 0.85',
          y: crownY,
          scale: crownScale,
        }}
      >
        <svg viewBox="0 0 100 85" className="w-full h-full">
          <defs>
            <linearGradient id="ccgld" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ffe27a" />
              <stop offset="0.6" stopColor="#f5b41a" />
              <stop offset="1" stopColor="#a86b00" />
            </linearGradient>
          </defs>
          <path
            d="M5 70 L15 25 L35 50 L50 12 L65 50 L85 25 L95 70 Z"
            fill="url(#ccgld)"
            stroke="rgba(120,70,0,0.5)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect x="5" y="68" width="90" height="12" rx="3" fill="url(#ccgld)" stroke="rgba(120,70,0,0.5)" strokeWidth="2" />
          <circle cx="15" cy="25" r="4" fill="#ff5563" />
          <circle cx="50" cy="12" r="4" fill="#3eaaff" />
          <circle cx="85" cy="25" r="4" fill="#3aff8a" />
        </svg>
      </motion.div>
      {/* confetti */}
      {Array.from({ length: 30 }).map((_, i) => {
        const r1 = rand(i + 91);
        const r2 = rand(i + 117);
        const colors = ['#ff5563', '#ffd86b', '#3eaaff', '#3aff8a', '#c81f30'];
        return (
          <motion.div
            key={i}
            initial={{ y: '-10vh', x: 0, opacity: 0, rotate: 0 }}
            animate={{
              y: ['-10vh', '90vh'],
              x: [0, (r2 - 0.5) * 200, (r2 - 0.5) * 240],
              opacity: [0, 1, 0],
              rotate: [0, 360 + r1 * 180, 720],
            }}
            transition={{ duration: 2.2 + r1 * 0.8, delay: r1 * 1.5, repeat: Infinity, ease: 'easeIn' }}
            style={{
              position: 'absolute',
              left: `${10 + r1 * 80}%`,
              width: 8,
              height: 14,
              background: colors[i % colors.length],
              borderRadius: 2,
            }}
          />
        );
      })}
    </motion.div>
  );
};

/* ───────────────────────── 9. Exit reveal (ribbon + CTA) ───────────────────────── */
export const ExitReveal: React.FC<Common & { onEnter: () => void }> = ({ progress, onEnter }) => {
  const opacity = useTransform(progress, [0.92, 0.96], [0, 1]);
  // Two ribbon halves parting horizontally
  const leftX = useTransform(progress, [0.93, 0.99], ['0%', '-110%']);
  const rightX = useTransform(progress, [0.93, 0.99], ['0%', '110%']);
  return (
    <motion.div className="absolute inset-0 pointer-events-none" style={{ opacity, zIndex: 32 }}>
      <motion.div
        className="absolute inset-y-0"
        style={{
          left: 0,
          width: '50%',
          x: leftX,
          background:
            'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 30%, #ff5563 90%, #c81f30 100%)',
          boxShadow: '8px 0 24px rgba(200,30,50,0.35)',
        }}
      />
      <motion.div
        className="absolute inset-y-0"
        style={{
          right: 0,
          width: '50%',
          x: rightX,
          background:
            'linear-gradient(270deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 30%, #ff5563 90%, #c81f30 100%)',
          boxShadow: '-8px 0 24px rgba(200,30,50,0.35)',
        }}
      />
      {/* CTA */}
      <motion.button
        type="button"
        onClick={onEnter}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer outline-none"
        style={{ opacity: useTransform(progress, [0.94, 0.98], [0, 1]) }}
      >
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-red-500/40 via-amber-300/30 to-red-500/40 rounded-full" />
          <div className="relative px-10 py-5 rounded-full bg-white border border-red-200 shadow-2xl shadow-red-500/30">
            <span className="text-neutral-900 text-3xl md:text-5xl font-black tracking-tight">
              ورود به Smart<span className="bg-gradient-to-r from-red-600 via-rose-500 to-red-500 bg-clip-text text-transparent">Wash</span>
            </span>
          </div>
        </div>
      </motion.button>
    </motion.div>
  );
};
