import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { kf1, kf2, kf3, kf4 } from '../keyframeAssets';

/*
  CarStage — the pinned, "alive" car at screen center.

  Visual layers, back to front:
   1. Soft floor shadow (compresses with squash & stretch)
   2. The car image — src swaps between kf1..kf4 based on scroll progress
   3. Foam mask — a clip-path layer that fills the car bottom-up during soap
   4. Headlight beam — points toward the cursor
   5. Honk ring — expanding circle that fires on click

  Inputs:
   - progress  : master 0..1 scroll value (chooses expression, foam level)
   - mouseX,Y  : -1..1 normalized cursor (drives tilt + headlight + dryer)
   - velocity  : smoothed -1..1 scroll velocity (drives wobble + lean)
   - honkSeq   : a counter from parent; increments → trigger honk
*/

const CAR_WIDTH = 'min(58vw, 620px)';

const useExpression = (progress: MotionValue<number>) => {
  // Pick a keyframe based on station ranges. React state — only re-renders on
  // a real change (Object.is compare), so cheap even though `decide` runs
  // on every scroll tick.
  const [src, setSrc] = useState<string>(kf2);
  useEffect(() => {
    const decide = (v: number) => {
      const next =
        v < 0.16 ? kf2 :          // resting smile
        v < 0.42 ? kf1 :          // covered in foam during soap+brush
        v < 0.68 ? kf2 :          // rinsed, smiling again
        v < 0.78 ? kf3 :          // worried under the dryer
        kf4;                       // crowned at the end
      setSrc((cur) => (cur === next ? cur : next));
    };
    decide(progress.get());
    return progress.on('change', decide);
  }, [progress]);
  return src;
};

export const CarStage: React.FC<{
  progress: MotionValue<number>;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  velocity: MotionValue<number>;
  honkSeq: number;
}> = ({ progress, mouseX, mouseY, velocity, honkSeq }) => {
  const expressionSrc = useExpression(progress);

  // Scroll-velocity wobble & lean — the car briefly leans forward on fast scrolls.
  const lean = useSpring(useTransform(velocity, [-1, 0, 1], [4, 0, -4]), { stiffness: 120, damping: 14 });
  const bob = useSpring(useTransform(velocity, [-1, 0, 1], [-4, 0, 4]), { stiffness: 80, damping: 12 });

  // Mouse tilt — ±4° pitch / yaw based on cursor.
  const tiltX = useTransform(mouseY, [-1, 1], [3, -3]);   // pitch (mouse up tilts back)
  const tiltY = useTransform(mouseX, [-1, 1], [-5, 5]);   // yaw (RTL: mouse right tilts right)

  // Foam level — 0 at start, grows during soap, drops during rinse.
  const foamLevel = useTransform(progress, [0.20, 0.32, 0.50, 0.60], [0, 1, 1, 0]);
  // Foam clip-path: inset from top (foam fills bottom-up).
  const foamClip = useTransform(foamLevel, (l) => `inset(${(1 - l) * 100}% 0% 0% 0% round 12px)`);

  // Polish saturation/brightness boost.
  const carFilter = useTransform(progress, (v) => {
    const polish = Math.max(0, Math.min(1, (v - 0.72) / 0.10));
    const sat = 1 + 0.25 * polish;
    const bright = 1 + 0.10 * polish;
    return `saturate(${sat}) brightness(${bright}) drop-shadow(0 26px 36px rgba(120,30,45,${0.22 + 0.10 * polish}))`;
  });

  // Subtle living loop — gentle breathing scale regardless of scroll.
  // ---

  // Honk: when honkSeq changes, animate squash + ring + flash.
  const honkRingRef = useRef<HTMLDivElement | null>(null);
  const honkSquashRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (honkSeq <= 0) return;
    const ring = honkRingRef.current;
    const squash = honkSquashRef.current;
    if (!ring || !squash) return;
    ring.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.9 },
        { transform: 'translate(-50%, -50%) scale(4)', opacity: 0 },
      ],
      { duration: 700, easing: 'cubic-bezier(0.22,1,0.36,1)' },
    );
    squash.animate(
      [
        { transform: 'scaleX(1) scaleY(1)' },
        { transform: 'scaleX(1.06) scaleY(0.92)' },
        { transform: 'scaleX(0.96) scaleY(1.05)' },
        { transform: 'scaleX(1) scaleY(1)' },
      ],
      { duration: 400, easing: 'cubic-bezier(0.34,1.56,0.64,1)' },
    );
  }, [honkSeq]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 14 }}>
      <motion.div
        className="relative"
        style={{
          width: CAR_WIDTH,
          y: bob,
          rotate: lean,
        }}
      >
        {/* Floor shadow */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            bottom: '-14%',
            width: '92%',
            height: '7%',
            background: 'radial-gradient(ellipse at center, rgba(60,30,40,0.32) 0%, rgba(60,30,40,0.12) 50%, rgba(60,30,40,0) 80%)',
            filter: 'blur(6px)',
          }}
          animate={{ scaleX: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Squash wrapper (honk animation) + mouse tilt */}
        <motion.div
          ref={honkSquashRef}
          style={{
            rotateX: tiltX,
            rotateY: tiltY,
            transformStyle: 'preserve-3d',
            perspective: 1200,
          }}
        >
          <motion.div
            animate={{ y: [0, -6, 0, 4, 0], rotate: [0, -0.6, 0, 0.6, 0] }}
            transition={{ duration: 5.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'relative' }}
          >
            {/* Base car (always visible) */}
            <motion.img
              src={expressionSrc}
              alt="SmartWash car"
              draggable={false}
              className="block w-full h-auto select-none"
              style={{ filter: carFilter, maxHeight: '64vh', objectFit: 'contain' }}
            />
            {/* Foam overlay clip-mask — same car silhouette filled with white foam */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                clipPath: foamClip,
                WebkitClipPath: foamClip,
                background:
                  'radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.95) 0%, rgba(255,236,240,0.92) 40%, rgba(247,205,214,0.75) 70%, rgba(247,205,214,0.55) 100%)',
                mixBlendMode: 'screen',
                borderRadius: '12px',
                opacity: 0.95,
              }}
            />
            {/* Foam bubble cluster on top of body */}
            <motion.div
              className="absolute inset-x-0 pointer-events-none"
              style={{
                top: '0%',
                height: '60%',
                opacity: useTransform(foamLevel, [0, 0.6, 1], [0, 0.7, 1]),
                clipPath: foamClip,
                WebkitClipPath: foamClip,
                background:
                  'radial-gradient(circle at 30% 30%, rgba(255,255,255,1) 0%, rgba(255,236,240,0) 14%), radial-gradient(circle at 55% 25%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 11%), radial-gradient(circle at 78% 32%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 13%), radial-gradient(circle at 45% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 10%), radial-gradient(circle at 70% 55%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 9%), radial-gradient(circle at 22% 60%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 9%)',
                filter: 'drop-shadow(0 2px 4px rgba(180,110,130,0.25))',
              }}
            />
            {/* Headlight beam — tracks cursor (only visible during dryer/polish phase) */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                top: '45%',
                left: '50%',
                width: '120%',
                height: '80%',
                transformOrigin: 'left center',
                rotate: useTransform(mouseX, [-1, 1], [-8, 8]),
                opacity: useTransform(progress, [0.55, 0.62, 0.78, 0.85], [0, 0.65, 0.65, 0]),
                background:
                  'linear-gradient(90deg, rgba(255,255,200,0.55) 0%, rgba(255,255,200,0.18) 35%, rgba(255,255,200,0) 70%)',
                filter: 'blur(8px)',
                mixBlendMode: 'screen',
              }}
            />
          </motion.div>
        </motion.div>

        {/* Honk ring (sits at the center of the car) */}
        <div
          ref={honkRingRef}
          className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
          style={{
            width: '60%',
            height: '60%',
            border: '3px solid rgba(255,80,90,0.85)',
            boxShadow: '0 0 24px rgba(255,80,90,0.55)',
            transform: 'translate(-50%, -50%) scale(0.2)',
            opacity: 0,
          }}
        />
      </motion.div>
    </div>
  );
};

export default CarStage;
