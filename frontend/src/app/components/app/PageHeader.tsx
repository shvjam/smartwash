import React from 'react';

export const PageHeader = ({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
  <header className="mb-6 sm:mb-8 flex items-start justify-between gap-4 flex-wrap">
    <div className="min-w-0">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 mb-1">{title}</h1>
      {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm">{subtitle}</p>}
    </div>
    {actions && <div data-page-header-actions className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </header>
);

export const Card = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6 ${className}`}>{children}</div>
);

export const StatCard = ({
  label, value, hint, accent = 'red',
}: { label: string; value: string | number; hint?: string; accent?: 'red' | 'emerald' | 'amber' | 'sky' | 'violet' }) => {
  const map: Record<string, string> = {
    red: 'from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 text-red-600 dark:text-red-400',
    emerald: 'from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 text-emerald-600 dark:text-emerald-400',
    amber: 'from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 text-amber-600 dark:text-amber-400',
    sky: 'from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40 text-sky-600 dark:text-sky-400',
    violet: 'from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 text-violet-600 dark:text-violet-400',
  };
  return (
    <div className={`bg-gradient-to-br ${map[accent]} rounded-2xl sm:rounded-3xl p-3.5 sm:p-5`}>
      <div className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1.5">{label}</div>
      <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{hint}</div>}
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, hint, action }: { icon: any; title: string; hint?: string; action?: React.ReactNode }) => (
  <div className="bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 p-6 sm:p-12 text-center">
    <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
      <Icon size={26} />
    </div>
    <div className="font-bold text-gray-900 dark:text-gray-100 mb-1">{title}</div>
    {hint && <div className="text-sm text-gray-500 dark:text-gray-400 mb-5">{hint}</div>}
    {action}
  </div>
);

export const Skeleton = ({ className = '', rounded = 'rounded-xl' }: { className?: string; rounded?: string }) => (
  <div className={`bg-gradient-to-l from-gray-100 via-gray-200 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse ${rounded} ${className}`} />
);

export const SkeletonRows = ({ rows = 5, className = '' }: { rows?: number; className?: string }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="w-10 h-10" rounded="rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonCards = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-24" rounded="rounded-3xl" />
    ))}
  </div>
);

export const ErrorState = ({ title = 'خطا در بارگذاری', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) => (
  <div className="bg-white dark:bg-gray-900 rounded-3xl border border-rose-200 dark:border-rose-900 p-10 text-center">
    <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
    </div>
    <div className="font-bold text-gray-900 dark:text-gray-100 mb-1">{title}</div>
    {message && <div className="text-sm text-rose-700 dark:text-rose-400 mb-5 max-w-md mx-auto">{message}</div>}
    {onRetry && (
      <button onClick={onRetry} className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold">
        تلاش مجدد
      </button>
    )}
  </div>
);
