import React, { useMemo } from 'react';
import { motion } from 'motion/react';

const rand = (seed: number) => {
  const x = Math.sin(seed * 12345.678) * 43758.5453;
  return x - Math.floor(x);
};

export const SparklesBurst: React.FC<{ active: boolean; count?: number }> = ({ active, count = 18 }) => {
  const items = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: 10 + rand(i + 3) * 80,
      top: 18 + rand(i + 11) * 55,
      size: 8 + rand(i + 17) * 22,
      delay: rand(i + 23) * 1.6,
      duration: 1.1 + rand(i + 31) * 0.9,
    }));
  }, [count]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((s) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 0.8, 0], scale: [0, 1, 1.1, 0.4], rotate: [0, 90, 180] }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: 1.6 + rand(s.id + 41) * 2,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            mixBlendMode: 'screen',
          }}
        >
          <svg viewBox="0 0 24 24" width="100%" height="100%">
            <defs>
              <radialGradient id={`spg-${s.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="60%" stopColor="#ffe9a8" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#ffd166" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path
              d="M12 1 L13.6 10.4 L23 12 L13.6 13.6 L12 23 L10.4 13.6 L1 12 L10.4 10.4 Z"
              fill={`url(#spg-${s.id})`}
            />
          </svg>
        </motion.div>
      ))}
    </div>
  );
};

export default SparklesBurst;
