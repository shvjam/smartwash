import React, { useEffect, useState } from 'react';
import { Timer, RefreshCw, CheckCircle2, AlertTriangle, XCircle, CircleDashed } from 'lucide-react';
import { clsx } from 'clsx';
import { platformCronApi, CronJobHealthDto, CronJobStatus } from '../../api';

/**
 * Whether the scheduled jobs are actually running.
 *
 * These jobs settle subscriptions, expire trials, dispatch campaigns and send reminders, and
 * none of them has a screen of its own: when one stops, nothing on any page changes — the
 * work simply does not happen, and the first sign is a customer who was never reminded or a
 * subscription that never renewed. This page is the only place that silence becomes visible.
 */

/** What each job is for, in the words of someone running the platform. */
const JOB_LABEL: Record<string, string> = {
  'campaign-dispatcher': 'ارسال کمپین‌های پیامکی',
  'generate-notifications': 'اعلان‌های پنل (سفارش معوق، رزرو نزدیک، تولد)',
  'cleanup-tokens': 'پاک‌سازی نشست‌های منقضی',
  'usage-rollup': 'ثبت مصرف (خودروهای سرویس‌شده)',
  'daily-billing': 'تمدید و صدور فاکتور اشتراک‌ها',
  'expire-trials': 'پایان دوره‌های آزمایشی',
  'expire-grace': 'پایان دوره‌های مهلت',
  'expire-overdue-subscriptions': 'تعلیق اشتراک‌های پرداخت‌نشده',
  'generate-service-reminders': 'ساخت یادآور شستشوی بعدی',
  'send-reminders': 'ارسال یادآورهای پیامکی به مشتری',
  'billing-reminders': 'یادآور پرداخت به مالکان کارواش',
};

const fmt = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      .format(new Date(iso));
  } catch { return iso; }
};

/** The schedule, in Iran time: daily slots are stored in UTC and Iran is UTC+03:30. */
const scheduleLabel = (j: CronJobHealthDto) => {
  if (j.everyMinutes) return `هر ${j.everyMinutes.toLocaleString('fa-IR')} دقیقه`;
  if (j.dailyAtUtc) {
    const [h, m] = j.dailyAtUtc.split(':').map(Number);
    const total = (h * 60 + m + 210) % (24 * 60);
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `روزانه ساعت ${Number(hh).toLocaleString('fa-IR')}:${mm.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])}`;
  }
  return 'بدون برنامه';
};

const state = (j: CronJobHealthDto) => {
  if (!j.lastRunAtUtc) return { label: 'هرگز اجرا نشده', icon: CircleDashed, tone: 'text-red-300 bg-red-500/10' };
  if (j.lastStatus === CronJobStatus.Running) return { label: 'در حال اجرا', icon: RefreshCw, tone: 'text-sky-300 bg-sky-500/10' };
  if (j.lastStatus === CronJobStatus.Failed) return { label: 'آخرین اجرا ناموفق', icon: XCircle, tone: 'text-red-300 bg-red-500/10' };
  if (j.isLate) return { label: 'دیر کرده', icon: AlertTriangle, tone: 'text-amber-300 bg-amber-500/10' };
  return { label: 'سالم', icon: CheckCircle2, tone: 'text-emerald-300 bg-emerald-500/10' };
};

export const CronHealthView = () => {
  const [jobs, setJobs] = useState<CronJobHealthDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { setJobs(await platformCronApi.health()); }
    catch (e: any) { setErr(e?.message ?? 'خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // A health page that has to be refreshed by hand is a health page nobody reads.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const troubled = jobs.filter(j => j.isLate || j.lastStatus === CronJobStatus.Failed || !j.lastRunAtUtc);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center text-violet-300">
            <Timer size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">کارهای زمان‌بندی‌شده</h1>
            <p className="text-xs text-gray-400">تمدید اشتراک، کمپین‌ها، یادآورها — آیا واقعاً اجرا می‌شوند؟</p>
          </div>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-gray-200 transition">
          <RefreshCw size={16} className={clsx(loading && 'animate-spin')} /> بروزرسانی
        </button>
      </header>

      {err && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {!loading && jobs.length > 0 && (
        <div className={clsx('rounded-3xl border p-5 flex items-center gap-3',
          troubled.length ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10')}>
          {troubled.length
            ? <AlertTriangle className="text-amber-300 shrink-0" size={22} />
            : <CheckCircle2 className="text-emerald-300 shrink-0" size={22} />}
          <div className="text-sm">
            {troubled.length
              ? <span className="text-amber-100">{troubled.length.toLocaleString('fa-IR')} کار نیاز به بررسی دارد. کاری که «هرگز اجرا نشده» معمولاً یعنی زمان‌بند برای آن تنظیم نشده است.</span>
              : <span className="text-emerald-100">همه‌ی {jobs.length.toLocaleString('fa-IR')} کار طبق برنامه اجرا می‌شوند.</span>}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-white/5 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-400 border-b border-white/5">
                <th className="text-right font-medium px-5 py-3">کار</th>
                <th className="text-right font-medium px-5 py-3">برنامه</th>
                <th className="text-right font-medium px-5 py-3">وضعیت</th>
                <th className="text-right font-medium px-5 py-3">آخرین اجرا</th>
                <th className="text-right font-medium px-5 py-3">آخرین موفق</th>
                <th className="text-right font-medium px-5 py-3">۲۴ ساعت اخیر</th>
              </tr>
            </thead>
            <tbody>
              {loading && jobs.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">در حال بارگذاری…</td></tr>
              )}
              {jobs.map(j => {
                const s = state(j);
                const Icon = s.icon;
                return (
                  <tr key={j.jobName} className="border-b border-white/5 last:border-0 align-top">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white">{JOB_LABEL[j.jobName] ?? j.jobName}</div>
                      <div className="text-[11px] text-gray-500 font-mono" dir="ltr">{j.jobName}</div>
                      {j.lastStatus === CronJobStatus.Failed && j.lastError && (
                        <div className="mt-2 max-w-md rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-200 font-mono break-all" dir="ltr">
                          {j.lastError}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-300 whitespace-nowrap">{scheduleLabel(j)}</td>
                    <td className="px-5 py-4">
                      <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap', s.tone)}>
                        <Icon size={12} />{s.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-300 whitespace-nowrap">
                      {fmt(j.lastRunAtUtc)}
                      {j.lastItemsProcessed != null && (
                        <div className="text-[11px] text-gray-500">{j.lastItemsProcessed.toLocaleString('fa-IR')} مورد</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-300 whitespace-nowrap">
                      {fmt(j.lastSuccessAtUtc)}
                      {j.hoursSinceLastSuccess != null && (
                        <div className="text-[11px] text-gray-500">{j.hoursSinceLastSuccess.toLocaleString('fa-IR')} ساعت پیش</div>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-gray-300">{j.runsLast24h.toLocaleString('fa-IR')} اجرا</span>
                      {j.failuresLast24h > 0 && (
                        <span className="mr-2 text-red-300">{j.failuresLast24h.toLocaleString('fa-IR')} ناموفق</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CronHealthView;
