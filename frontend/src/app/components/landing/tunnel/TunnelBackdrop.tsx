import React from 'react';
import { motion, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';

/*
  TunnelBackdrop — what the user "sees out the windshield":
    - far parallax wall (slow)
    - tunnel ceiling pipes/lights (medium)
    - conveyor belt under the wheels (fast)
    - side rails (very fast — sells the speed)

  All move from right to left as `progress` grows (RTL → car moves forward).
*/
export const TunnelBackdrop: React.FC<{ progress: MotionValue<number> }> = ({ progress }) => {
  // Background positions driven by scroll progress.
  const wallX = useTransform(progress, [0, 1], ['0%', '-180%']);
  const ceilingX = useTransform(progress, [0, 1], ['0%', '-260%']);
  const conveyorX = useTransform(progress, [0, 1], ['0%', '-400%']);
  const railX = useTransform(progress, [0, 1], ['0%', '-600%']);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
      {/* Sky / far wall — soft horizontal banding */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(180deg, #fff7f4 0%, #f8e2e6 60%, #e6c6cd 100%)',
        }}
      />
      <motion.div
        className="absolute inset-x-0"
        style={{
          top: '0%',
          height: '58%',
          x: wallX,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.0) 0 220px, rgba(255,255,255,0.55) 220px 222px, rgba(255,255,255,0.0) 222px 440px)',
          backgroundSize: '440px 100%',
          opacity: 0.6,
        }}
      />

      {/* Ceiling pipe with lights */}
      <motion.div
        className="absolute inset-x-0"
        style={{
          top: '6%',
          height: '52px',
          x: ceilingX,
          backgroundImage:
            'linear-gradient(180deg, #5a3142 0%, #3a1d2a 60%, #2a131c 100%)',
          backgroundSize: '300px 100%',
          boxShadow: '0 6px 16px rgba(40,10,20,0.18) inset',
        }}
      />
      <motion.div
        className="absolute inset-x-0 flex items-center"
        style={{
          top: 'calc(6% + 6px)',
          height: '40px',
          x: ceilingX,
        }}
      >
        {/* Repeating yellow lights */}
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,225,120,0.95) 0 8px, rgba(255,225,120,0) 12px), radial-gradient(circle, rgba(255,225,120,0.6) 0 4px, rgba(255,225,120,0) 6px)',
            backgroundSize: '180px 100%, 60px 100%',
            backgroundPosition: '0 50%, 30px 50%',
            backgroundRepeat: 'repeat-x',
            filter: 'drop-shadow(0 0 6px rgba(255,200,80,0.7))',
          }}
        />
      </motion.div>

      {/* Side rails — slim vertical light strips that whoosh past */}
      <motion.div
        className="absolute"
        style={{
          left: 0,
          right: 0,
          top: '24%',
          height: '6px',
          x: railX,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,200,200,0) 0 70px, rgba(255,150,160,0.7) 70px 88px, rgba(255,200,200,0) 88px 160px)',
          backgroundSize: '160px 100%',
          filter: 'blur(0.4px)',
        }}
      />
      <motion.div
        className="absolute"
        style={{
          left: 0,
          right: 0,
          top: '72%',
          height: '6px',
          x: railX,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(120,160,210,0) 0 90px, rgba(120,160,210,0.7) 90px 112px, rgba(120,160,210,0) 112px 200px)',
          backgroundSize: '200px 100%',
          filter: 'blur(0.4px)',
        }}
      />

      {/* Floor base */}
      <div
        className="absolute inset-x-0"
        style={{
          bottom: 0,
          height: '24%',
          backgroundImage:
            'linear-gradient(180deg, rgba(40,20,28,0.0) 0%, rgba(40,20,28,0.10) 30%, rgba(40,20,28,0.18) 100%)',
        }}
      />

      {/* Conveyor belt — fast horizontal stripe under the wheels */}
      <motion.div
        className="absolute inset-x-0"
        style={{
          bottom: '14%',
          height: '46px',
          x: conveyorX,
          backgroundImage:
            'repeating-linear-gradient(90deg, #2a1820 0 24px, #1a0d12 24px 48px)',
          boxShadow: 'inset 0 12px 14px rgba(0,0,0,0.45), inset 0 -8px 12px rgba(0,0,0,0.35)',
        }}
      />
      {/* Conveyor rivets */}
      <motion.div
        className="absolute inset-x-0"
        style={{
          bottom: 'calc(14% + 20px)',
          height: '6px',
          x: conveyorX,
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.35) 0 1.5px, rgba(255,255,255,0) 3px)',
          backgroundSize: '24px 6px',
          backgroundRepeat: 'repeat-x',
        }}
      />
    </div>
  );
};

export default TunnelBackdrop;
