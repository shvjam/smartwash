import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, AlertTriangle, Clock, Info, X, Check } from 'lucide-react';
import { useCarWash } from '../store';
import { clsx } from 'clsx';

export const NotificationsBell = () => {
  const { notifications, unreadCount, markAllRead, dismissNotification } = useCarWash();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleToggle = () => {
    setOpen(o => {
      const next = !o;
      if (next && unreadCount > 0) setTimeout(() => markAllRead(), 800);
      return next;
    });
  };

  const iconFor = (type: string) => {
    if (type === 'overdue') return <AlertTriangle size={16} className="text-red-600" />;
    if (type === 'reminder') return <Clock size={16} className="text-amber-600" />;
    return <Info size={16} className="text-blue-600" />;
  };

  const bgFor = (type: string) => {
    if (type === 'overdue') return 'bg-red-50';
    if (type === 'reminder') return 'bg-amber-50';
    return 'bg-blue-50';
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className={clsx(
          'relative p-2.5 rounded-2xl transition-colors',
          unreadCount > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        )}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed sm:absolute left-3 right-3 sm:left-0 sm:right-auto top-16 sm:top-auto sm:mt-2 sm:w-[340px] sm:max-w-[90vw] bg-white rounded-3xl border border-gray-100 shadow-2xl shadow-gray-900/10 z-50 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">اعلان‌ها</div>
                <div className="text-[11px] text-gray-500">{notifications.length} مورد</div>
              </div>
              {notifications.length > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                  <Check size={12} /> خواندن همه
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">
                  <Bell size={32} className="mx-auto mb-2 opacity-30" />
                  هیچ اعلانی نیست
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={clsx(
                    'p-4 border-b border-gray-50 flex items-start gap-3 group hover:bg-gray-50/50',
                    !n.read && 'bg-red-50/30'
                  )}>
                    <div className={clsx('w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0', bgFor(n.type))}>
                      {iconFor(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{n.message}</div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={() => dismissNotification(n.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
