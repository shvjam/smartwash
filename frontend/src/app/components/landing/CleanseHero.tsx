import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Sparkles, MousePointer2, Droplets } from 'lucide-react';

const MASK_SIZE = 512;
const BRUSH = 70;

export const CleanseHero: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dirtImgRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [hinted, setHinted] = useState(false);

  // Parallax tilt via spring.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 18 });

  // Initialise the dirt mask canvas (white = dirt visible).
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = c.height = MASK_SIZE;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    maskCanvasRef.current = c;
    updateMask();
  }, []);

  const updateMask = () => {
    const c = maskCanvasRef.current;
    const el = dirtImgRef.current;
    if (!c || !el) return;
    const url = c.toDataURL();
    el.style.webkitMaskImage = `url(${url})`;
    (el.style as any).maskImage = `url(${url})`;
  };

  const paintAt = (x: number, y: number) => {
    const c = maskCanvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const u = (x - rect.left) / rect.width;
    const v = (y - rect.top) / rect.height;
    const px = u * MASK_SIZE;
    const py = v * MASK_SIZE;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, BRUSH);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, BRUSH, 0, Math.PI * 2);
    ctx.fill();
    updateMask();
    sampleProgress();
  };

  const lastSampleRef = useRef(0);
  const sampleProgress = () => {
    const now = performance.now();
    if (now - lastSampleRef.current < 180) return;
    lastSampleRef.current = now;
    const c = maskCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const data = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
    let sum = 0;
    const step = 64;
    for (let i = 0; i < data.length; i += step) sum += data[i];
    const max = (data.length / step) * 255;
    const dirt = sum / max;
    setProgress(1 - dirt);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!hinted) setHinted(true);
    paintAt(e.clientX, e.clientY);
    const rect = wrapRef.current!.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const pct = Math.round(progress * 100);

  return (
    <motion.div
      ref={wrapRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ perspective: 1200 }}
      className="relative w-full aspect-square sm:aspect-[4/3] lg:aspect-square rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#05050c] via-[#0d0d1a] to-[#1a0a14] shadow-2xl shadow-black/40 border border-white/10 select-none touch-none"
    >
      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 -left-24 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
          className="absolute bottom-0 -right-24 w-96 h-96 bg-rose-500/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2.8 }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-violet-500/25 rounded-full blur-3xl"
        />
      </div>

      {/* Studio grid floor */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, transparent 55%, black 75%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 55%, black 75%, black 100%)',
        }}
      />

      {/* Tilted car stage */}
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        className="absolute inset-0 flex items-center justify-center p-6"
      >
        <div className="relative w-full max-w-[640px] aspect-[16/9]">
          {/* Layer 1 — clean car photo (under) */}
          <img
            src="https://images.unsplash.com/photo-1578739281228-834e241b6d56?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=85&w=1400"
            alt="car"
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_30px_50px_rgba(0,0,0,0.7)]"
            draggable={false}
          />

          {/* Layer 2 — same photo, "dirty" via CSS filter, revealed by the mask canvas (white = dirty visible) */}
          <DirtImageOverlay maskCanvasRef={maskCanvasRef} />

          {/* Layer 3 — wet shine sweep when nearly clean */}
          <AnimatePresence>
            {pct >= 90 && (
              <motion.div
                initial={{ x: '-120%', opacity: 0 }}
                animate={{ x: '120%', opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, ease: 'easeInOut' }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.55) 50%, transparent 62%)',
                  mixBlendMode: 'screen',
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Floating water droplets where pointer moved */}
      <Droplet x={mx} y={my} />

      {/* Top label */}
      <div className="absolute top-5 right-5 z-10 pointer-events-none">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-bold">
          <Sparkles size={12} className="text-cyan-300" />
          <span>تجربه‌ی شستشو</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-5 left-5 right-5 z-10 pointer-events-none">
        <div className="flex items-center justify-between mb-2 text-white/90 text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <Droplets size={12} className="text-cyan-300" />
            میزان تمیزی
          </span>
          <motion.span
            key={pct}
            initial={{ scale: 1.25, color: '#22d3ee' }}
            animate={{ scale: 1, color: '#ffffff' }}
            transition={{ duration: 0.25 }}
          >
            {pct}٪
          </motion.span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden backdrop-blur-sm">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* Initial hint */}
      <AnimatePresence>
        {!hinted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white text-sm"
            >
              <MousePointer2 size={14} className="text-cyan-300" />
              <span>موس را روی ماشین حرکت دهید</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clean badge */}
      <AnimatePresence>
        {pct >= 95 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
          >
            <div className="px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-black text-sm font-black shadow-2xl shadow-cyan-400/50">
              ✨ کاملاً تمیز
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Tiny droplet trail near pointer.
const Droplet: React.FC<{ x: any; y: any }> = ({ x, y }) => {
  const tx = useTransform(x, (v: number) => `${50 + v * 100}%`);
  const ty = useTransform(y, (v: number) => `${50 + v * 100}%`);
  return (
    <motion.div
      style={{ left: tx, top: ty, translateX: '-50%', translateY: '-50%' }}
      className="absolute pointer-events-none z-10 w-24 h-24 rounded-full"
    >
      <div className="absolute inset-0 rounded-full bg-cyan-300/20 blur-2xl" />
    </motion.div>
  );
};

// Real-photo dirt overlay: same car image with brown/dark CSS filter, clipped by the mask canvas.
const DirtImageOverlay: React.FC<{ maskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null> }> = ({ maskCanvasRef }) => {
  const elRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = maskCanvasRef.current;
      if (c && elRef.current) {
        const url = c.toDataURL();
        elRef.current.style.webkitMaskImage = `url(${url})`;
        (elRef.current.style as any).maskImage = `url(${url})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [maskCanvasRef]);
  return (
    <div
      ref={elRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    >
      <img
        src="https://images.unsplash.com/photo-1578739281228-834e241b6d56?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=85&w=1400"
        alt=""
        crossOrigin="anonymous"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          filter: 'brightness(0.55) saturate(0.4) sepia(0.7) hue-rotate(-15deg) contrast(0.9)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 25% 35%, rgba(90,65,40,0.55) 0%, rgba(46,31,18,0.55) 40%, rgba(20,12,6,0.55) 80%), repeating-radial-gradient(circle at 70% 65%, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0) 8px)',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
};

// (legacy) The dirt layer is animated by re-rendering a CSS background based on the mask canvas dataURL.
const DirtOverlay: React.FC<{ maskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null> }> = ({ maskCanvasRef }) => {
  const elRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = maskCanvasRef.current;
      if (c && elRef.current) {
        const url = c.toDataURL();
        elRef.current.style.webkitMaskImage = `url(${url})`;
        (elRef.current.style as any).maskImage = `url(${url})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [maskCanvasRef]);
  return (
    <div
      ref={elRef}
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(circle at 25% 35%, #5a4128 0%, #2e1f12 40%, #140c06 80%), repeating-radial-gradient(circle at 70% 65%, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0) 8px)',
        mixBlendMode: 'normal',
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    />
  );
};

// Sleek SUV/coupe silhouette + body — pure SVG so it stays crisp.
const CleanCarSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ef4444" />
        <stop offset="0.5" stopColor="#b91c1c" />
        <stop offset="1" stopColor="#450a0a" />
      </linearGradient>
      <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1e293b" />
        <stop offset="1" stopColor="#020617" />
      </linearGradient>
      <linearGradient id="highlight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="rgba(255,255,255,0.7)" />
        <stop offset="0.4" stopColor="rgba(255,255,255,0.1)" />
        <stop offset="1" stopColor="rgba(255,255,255,0)" />
      </linearGradient>
      <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="rgba(0,0,0,0.55)" />
        <stop offset="1" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>

    {/* Ground shadow */}
    <ellipse cx="300" cy="250" rx="230" ry="14" fill="url(#shadow)" />

    {/* Body */}
    <path
      d="M70,200 C80,160 100,150 140,148 L180,108 C200,90 240,82 290,82 L380,82 C420,84 450,98 478,128 L520,150 C550,154 560,170 558,196 L555,216 C555,222 550,226 544,226 L500,226 C496,210 480,198 460,198 C440,198 424,210 420,226 L200,226 C196,210 180,198 160,198 C140,198 124,210 120,226 L80,226 C74,226 70,222 70,216 Z"
      fill="url(#bodyGrad)"
    />
    {/* Top highlight strip */}
    <path
      d="M150,108 C170,92 210,86 280,86 L380,86 C420,88 448,100 472,126 L460,134 C436,112 410,104 380,102 L280,102 C220,102 188,108 168,120 Z"
      fill="url(#highlight)"
      opacity="0.6"
    />
    {/* Window */}
    <path
      d="M188,110 C204,96 240,90 290,90 L370,90 C405,92 432,104 452,128 L432,144 L208,144 Z"
      fill="url(#glassGrad)"
    />
    {/* Window highlight */}
    <path d="M200,120 L432,140 L432,144 L208,144 Z" fill="rgba(255,255,255,0.08)" />
    {/* Door line */}
    <path d="M300,108 L300,224" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
    {/* Handle */}
    <rect x="340" y="170" width="34" height="6" rx="3" fill="rgba(0,0,0,0.45)" />
    {/* Headlight */}
    <ellipse cx="528" cy="170" rx="20" ry="9" fill="#fef9c3" opacity="0.95" />
    <ellipse cx="528" cy="170" rx="10" ry="4" fill="#ffffff" />
    {/* Tail light */}
    <rect x="76" y="162" width="14" height="18" rx="3" fill="#fb7185" />
    {/* Wheels */}
    <circle cx="160" cy="230" r="32" fill="#0a0a0a" />
    <circle cx="160" cy="230" r="18" fill="#1e293b" />
    <circle cx="160" cy="230" r="6" fill="#475569" />
    <circle cx="460" cy="230" r="32" fill="#0a0a0a" />
    <circle cx="460" cy="230" r="18" fill="#1e293b" />
    <circle cx="460" cy="230" r="6" fill="#475569" />
  </svg>
);

const carSilhouetteSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 300'><path fill='white' d='M70,200 C80,160 100,150 140,148 L180,108 C200,90 240,82 290,82 L380,82 C420,84 450,98 478,128 L520,150 C550,154 560,170 558,196 L555,216 C555,222 550,226 544,226 L500,226 C496,210 480,198 460,198 C440,198 424,210 420,226 L200,226 C196,210 180,198 160,198 C140,198 124,210 120,226 L80,226 C74,226 70,222 70,216 Z'/><circle fill='white' cx='160' cy='230' r='32'/><circle fill='white' cx='460' cy='230' r='32'/></svg>`;

export default CleanseHero;
