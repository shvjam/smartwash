import React, { useMemo } from 'react';
import { motion } from 'motion/react';

type Bubble = {
  id: number;
  left: number;       // % across screen
  size: number;       // px
  delay: number;      // s
  duration: number;   // s
  drift: number;      // px horizontal sway amplitude
  startY: number;     // % from bottom where it spawns
  popAt: number;      // 0..1 fraction of duration where it pops
};

const rand = (seed: number) => {
  // deterministic pseudo-random so it doesn't reshuffle every render
  const x = Math.sin(seed * 9973.13) * 43758.5453;
  return x - Math.floor(x);
};

export const BubblesField: React.FC<{ active: boolean; count?: number }> = ({ active, count = 42 }) => {
  const bubbles = useMemo<Bubble[]>(() => {
    return Array.from({ length: count }).map((_, i) => {
      const r1 = rand(i + 1);
      const r2 = rand(i + 7);
      const r3 = rand(i + 13);
      const r4 = rand(i + 21);
      const r5 = rand(i + 29);
      return {
        id: i,
        left: 5 + r1 * 90,
        size: 14 + r2 * 60,
        delay: r3 * 2.8,
        duration: 3.2 + r4 * 2.8,
        drift: (r5 - 0.5) * 90,
        startY: 5 + r2 * 30,
        popAt: 0.78 + r5 * 0.18,
      };
    });
  }, [count]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {bubbles.map((b) => (
        <motion.div
          key={b.id}
          initial={{ opacity: 0, y: 0, x: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 0.9, 0.95, 0.85, 0],
            y: [`${b.startY}vh`, `-${60 + b.startY}vh`],
            x: [0, b.drift * 0.4, -b.drift * 0.6, b.drift, b.drift * 0.2],
            scale: [0.4, 1, 1.05, 1.1, 1.25],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            repeatDelay: 0.2 + rand(b.id + 51) * 1.6,
            ease: 'easeOut',
            times: [0, 0.15, 0.55, b.popAt, 1],
          }}
          style={{
            position: 'absolute',
            left: `${b.left}%`,
            bottom: 0,
            width: b.size,
            height: b.size,
            borderRadius: '9999px',
            background:
              'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.98) 0%, rgba(255,236,240,0.85) 30%, rgba(247,205,214,0.55) 60%, rgba(225,150,170,0.28) 82%, rgba(225,150,170,0) 100%)',
            boxShadow:
              'inset 0 -3px 6px rgba(190,120,140,0.25), inset 2px 2px 4px rgba(255,255,255,0.9), 0 2px 8px rgba(180,110,130,0.18)',
            border: '1px solid rgba(255,255,255,0.5)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '15%',
              left: '22%',
              width: '28%',
              height: '28%',
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.85)',
              filter: 'blur(1px)',
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

export default BubblesField;
