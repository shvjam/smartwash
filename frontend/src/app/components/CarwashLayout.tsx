import React from 'react';
import { motion } from 'motion/react';
import { Droplets, Sparkles, ArrowLeft, Crown } from 'lucide-react';
import { clsx } from 'clsx';
import type { Bay } from '../types';

type Props = {
  bays: Bay[];
  workers: { id: string; name: string; avatar: string }[];
  ordersByBay: Record<string, { plate: string; workerIds: string[]; total: number; itemsCount: number; minutesElapsed: number } | undefined>;
  onSelect: (bayId: string) => void;
};

const CarTopView = ({ color = '#dc2626', soaped = false }: { color?: string; soaped?: boolean }) => (
  <svg viewBox="0 0 80 140" className="w-14 md:w-16 h-auto drop-shadow-lg">
    <defs>
      <linearGradient id={`carBody-${color}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="1" />
        <stop offset="100%" stopColor={color} stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id={`carShine-${color}`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect x="8" y="10" width="64" height="120" rx="18" fill={`url(#carBody-${color})`} />
    <rect x="8" y="10" width="64" height="120" rx="18" fill={`url(#carShine-${color})`} />
    <path d="M16 30 L64 30 L60 52 L20 52 Z" fill="#1f2937" opacity="0.85" />
    <rect x="20" y="54" width="40" height="32" rx="4" fill="#0f172a" opacity="0.75" />
    <path d="M20 88 L60 88 L64 110 L16 110 Z" fill="#1f2937" opacity="0.85" />
    <rect x="4" y="40" width="6" height="8" rx="2" fill={color} />
    <rect x="70" y="40" width="6" height="8" rx="2" fill={color} />
    <circle cx="20" cy="16" r="3" fill="#fef3c7" />
    <circle cx="60" cy="16" r="3" fill="#fef3c7" />
    <rect x="14" y="124" width="10" height="3" rx="1" fill="#7f1d1d" />
    <rect x="56" y="124" width="10" height="3" rx="1" fill="#7f1d1d" />
    {soaped && (
      <>
        <circle cx="22" cy="38" r="4" fill="#fff" opacity="0.6" />
        <circle cx="58" cy="62" r="5" fill="#fff" opacity="0.5" />
        <circle cx="34" cy="80" r="3" fill="#fff" opacity="0.7" />
        <circle cx="50" cy="100" r="4" fill="#fff" opacity="0.55" />
        <circle cx="28" cy="115" r="2.5" fill="#fff" opacity="0.6" />
      </>
    )}
  </svg>
);

const WaterArch = () => (
  <svg viewBox="0 0 80 50" className="absolute -top-4 left-0 right-0 mx-auto w-full pointer-events-none">
    <motion.path
      d="M 5 40 Q 40 0 75 40"
      fill="none"
      stroke="#60a5fa"
      strokeWidth="0.6"
      strokeDasharray="2 3"
      animate={{ strokeDashoffset: [0, -10] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      opacity="0.7"
    />
    <motion.path
      d="M 12 42 Q 40 8 68 42"
      fill="none"
      stroke="#3b82f6"
      strokeWidth="0.5"
      strokeDasharray="1 2"
      animate={{ strokeDashoffset: [0, -8] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      opacity="0.5"
    />
  </svg>
);

const FloorMarkings = () => (
  <svg className="absolute inset-x-0 bottom-3 h-2 w-full pointer-events-none" viewBox="0 0 100 4" preserveAspectRatio="none">
    <line x1="0" y1="2" x2="100" y2="2" stroke="#fbbf24" strokeWidth="0.6" strokeDasharray="3 2" opacity="0.4" />
  </svg>
);

const statusConfig: Record<Bay['status'], { card: string; tag: string; tagText: string; dot: string }> = {
  empty: {
    card: 'bg-gradient-to-br from-white to-slate-50 border-2 border-dashed border-slate-300 hover:border-red-400 hover:from-red-50 hover:to-white',
    tag: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    tagText: 'آزاد',
    dot: 'bg-emerald-500',
  },
  occupied: {
    card: 'bg-gradient-to-br from-red-50 via-white to-blue-50 border border-red-200 shadow-[0_15px_40px_-10px_rgba(239,68,68,0.3)]',
    tag: 'bg-red-100 text-red-600 border border-red-200',
    tagText: 'در حال شستشو',
    dot: 'bg-red-500 animate-pulse',
  },
  reserved: {
    card: 'bg-gradient-to-br from-amber-50 to-white border border-amber-200',
    tag: 'bg-amber-100 text-amber-700 border border-amber-200',
    tagText: 'رزرو',
    dot: 'bg-amber-500',
  },
  maintenance: {
    card: 'bg-gradient-to-br from-gray-50 to-white border-2 border-dashed border-gray-300 opacity-60',
    tag: 'bg-gray-100 text-gray-600 border border-gray-200',
    tagText: 'تعمیر',
    dot: 'bg-gray-400',
  },
};

export const CarwashLayout = ({ bays, workers, ordersByBay, onSelect }: Props) => {
  return (
    <div className="relative bg-gradient-to-b from-slate-100 via-slate-50 to-white rounded-3xl sm:rounded-[2.5rem] p-3 sm:p-4 md:p-6 border border-slate-200 shadow-[inset_0_2px_20px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Asphalt texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)',
        backgroundSize: '14px 14px'
      }} />

      {/* Entrance / Exit */}
      <div className="relative z-10 flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
          <Droplets size={13} className="text-blue-500" />
          <span className="text-[11px] font-bold text-blue-700">ورودی</span>
        </div>
        <div className="flex-1 mx-3 relative h-0.5">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-200 via-yellow-200 to-emerald-200 rounded-full"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
          <span className="text-[11px] font-bold text-emerald-700">خروجی</span>
          <ArrowLeft size={13} className="text-emerald-500" />
        </div>
      </div>

      {/* Building structure */}
      <div className="relative z-10 bg-white/70 backdrop-blur-sm rounded-3xl border border-slate-200 p-3 md:p-5 shadow-inner">
        {/* Top beams */}
        <div className="flex justify-between mb-3 px-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-1 h-2.5 bg-slate-300 rounded-full" />
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {bays.map((bay, idx) => {
            const order = ordersByBay[bay.id];
            const cfg = statusConfig[bay.status];
            const isVip = bay.type === 'vip';
            const assignedWorkers = order?.workerIds.map(id => workers.find(w => w.id === id)).filter(Boolean) ?? [];

            return (
              <motion.button
                key={bay.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelect(bay.id)}
                className={clsx(
                  'relative rounded-3xl p-4 md:p-5 text-right transition-all duration-300 group min-h-[200px] sm:min-h-[230px] md:min-h-[260px] flex flex-col overflow-hidden',
                  cfg.card
                )}
              >
                {/* VIP shine */}
                {isVip && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400" />
                )}

                {/* Lane lines */}
                <div className="absolute top-3 bottom-3 right-2 w-0.5 bg-gradient-to-b from-transparent via-slate-300/60 to-transparent" />
                <div className="absolute top-3 bottom-3 left-2 w-0.5 bg-gradient-to-b from-transparent via-slate-300/60 to-transparent" />

                {/* Header */}
                <div className="relative flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-gray-900">{bay.name}</span>
                    {isVip && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-extrabold flex items-center gap-0.5 shadow-sm">
                        <Crown size={9} /> VIP
                      </span>
                    )}
                  </div>
                  <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5', cfg.tag)}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                    {cfg.tagText}
                  </span>
                </div>

                {/* Visual */}
                <div className="flex-1 relative flex flex-col items-center justify-center">
                  {bay.status === 'occupied' && <WaterArch />}

                  {bay.status === 'empty' || bay.status === 'maintenance' ? (
                    <div className="flex flex-col items-center justify-center text-slate-300 group-hover:text-red-400 transition-colors">
                      <svg viewBox="0 0 80 140" className="w-14 md:w-16 h-auto opacity-60">
                        <rect x="6" y="6" width="68" height="128" rx="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 6" />
                        <line x1="20" y1="70" x2="60" y2="70" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                      </svg>
                      <span className="text-[11px] font-bold mt-2">
                        {bay.status === 'maintenance' ? 'در تعمیر' : 'برای ثبت کلیک کنید'}
                      </span>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-2 relative"
                    >
                      <CarTopView color={bay.status === 'reserved' ? '#f59e0b' : '#dc2626'} soaped={bay.status === 'occupied'} />
                      {bay.status === 'occupied' && (
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map(i => (
                            <motion.div
                              key={i}
                              animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                              className="w-1 h-1 rounded-full bg-blue-400"
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                  <FloorMarkings />
                </div>

                {/* Footer info */}
                {order && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-extrabold text-gray-800 bg-gray-100 px-2 py-1 rounded-md tracking-wider truncate">
                        {order.plate}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] text-gray-700 font-mono font-bold">
                          {Math.round(order.total / 10).toLocaleString('fa-IR')} تومان
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {order.itemsCount} خدمت • {order.minutesElapsed}د
                        </span>
                      </div>
                    </div>
                    {assignedWorkers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 space-x-reverse">
                          {assignedWorkers.slice(0, 3).map(w => w && (
                            <img key={w.id} src={w.avatar} alt={w.name} className="w-5 h-5 rounded-full border-2 border-white" />
                          ))}
                        </div>
                        {assignedWorkers.length > 1 && (
                          <span className="text-[10px] text-gray-500">{assignedWorkers.length} کارگر</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Bottom beams */}
        <div className="mt-3 flex justify-between px-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-1 h-2.5 bg-slate-300 rounded-full" />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />آزاد</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />در حال شستشو</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />رزرو</div>
        <div className="flex items-center gap-1"><Sparkles size={11} className="text-yellow-500" />جایگاه VIP</div>
      </div>
    </div>
  );
};
