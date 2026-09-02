import React, { useEffect, useMemo, useState } from 'react';
import { Timer, TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react';
import { reportsApi, type PunctualityReport } from '../../api';
import { Card } from '../../components/app/PageHeader';

const fa = (n: number) => n.toLocaleString('fa-IR');

/** Green when comfortably on time, amber when slipping, red when it is a pattern. */
const rateTone = (percent: number) =>
  percent >= 85 ? { text: 'text-emerald-600', bg: 'bg-emerald-500', soft: 'bg-emerald-50' }
    : percent >= 60 ? { text: 'text-amber-600', bg: 'bg-amber-500', soft: 'bg-amber-50' }
      : { text: 'text-red-600', bg: 'bg-red-500', soft: 'bg-red-50' };

const Tile = ({ label, value, hint, tone = 'text-gray-900' }: {
  label: string; value: string; hint?: string; tone?: string;
}) => (
  <Card className="p-4">
    <div className="text-[11px] font-medium text-gray-500">{label}</div>
    <div className={`mt-1 text-2xl font-extrabold ${tone}`}>{value}</div>
    {hint && <div className="mt-0.5 text-[11px] text-gray-400">{hint}</div>}
  </Card>
);

/**
 * Two bars on one baseline: what the service was expected to take, and what it actually took.
 * A number pair in a table makes the reader do the comparison; drawing them against a shared
 * scale makes an over-running service obvious at a glance, which is the whole point of the
 * screen.
 */
const DurationBars = ({ estimated, actual, scale }: { estimated: number; actual: number; scale: number }) => {
  const pct = (v: number) => (scale === 0 ? 0 : Math.min(100, Math.round((v / scale) * 100)));
  const over = actual > estimated;
  return (
    <div className="min-w-[7rem] space-y-1">
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-gray-300" style={{ width: `${pct(estimated)}%` }} />
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct(actual)}%` }} />
      </div>
    </div>
  );
};

export const PunctualityTab = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  const [data, setData] = useState<PunctualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    reportsApi.punctuality(fromDate, toDate)
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setErr('گزارش دقت زمان‌بندی بارگذاری نشد'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fromDate, toDate]);

  // One shared scale across every row, so bar lengths are comparable between services.
  const scale = useMemo(() => {
    if (!data) return 0;
    return Math.max(1, ...data.services.flatMap(s => [s.estimatedMinutes, s.averageActualMinutes]));
  }, [data]);

  if (loading) return <div className="py-16 text-center text-sm text-gray-400">در حال محاسبه…</div>;
  if (err) return <div className="py-16 text-center text-sm text-red-600">{err}</div>;
  if (!data || data.completedOrders === 0) {
    return (
      <Card className="py-16 text-center">
        <Timer className="mx-auto mb-3 text-gray-300" size={32} />
        <div className="font-bold text-gray-700">هنوز سفارش تکمیل‌شده‌ای در این بازه نیست</div>
        <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-gray-500">
          این گزارش زمان واقعی هر سفارش را با زمان تخمینی خدماتش مقایسه می‌کند. با تکمیل چند سفارش، اینجا پر می‌شود.
        </p>
      </Card>
    );
  }

  const tone = rateTone(data.onTimePercent);
  const gap = data.averageActualMinutes - data.averageEstimatedMinutes;
  const worst = data.services.filter(s => s.lateCount > 0).slice(0, 1)[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="سفارش‌های بررسی‌شده" value={fa(data.completedOrders)} hint="تکمیل‌شده در این بازه" />
        <Tile label="به‌موقع" value={`${fa(data.onTimePercent)}٪`} tone={tone.text}
          hint={`${fa(data.onTimeOrders)} از ${fa(data.completedOrders)} سفارش`} />
        <Tile label="میانگین تخمین" value={`${fa(data.averageEstimatedMinutes)} دقیقه`} hint="بر اساس تعرفه‌ها" />
        <Tile label="میانگین واقعی" value={`${fa(data.averageActualMinutes)} دقیقه`}
          tone={gap > 0 ? 'text-red-600' : 'text-emerald-600'}
          hint={gap === 0 ? 'برابر تخمین' : gap > 0 ? `${fa(gap)} دقیقه بیشتر از تخمین` : `${fa(Math.abs(gap))} دقیقه کمتر از تخمین`} />
      </div>

      {worst && (
        <div className={`flex items-start gap-3 rounded-2xl border border-gray-100 p-4 ${rateTone(worst.onTimePercent).soft}`}>
          <AlertTriangle size={18} className={`mt-0.5 flex-shrink-0 ${rateTone(worst.onTimePercent).text}`} />
          <div className="text-sm leading-6 text-gray-700">
            <span className="font-bold">{worst.serviceName}</span> بیشترین انحراف را دارد — به‌طور میانگین{' '}
            <span className="font-bold">{fa(worst.averageOverrunMinutes)} دقیقه</span> بیشتر از تخمین طول می‌کشد.
            یا تخمین این خدمت باید اصلاح شود، یا اجرای آن گلوگاه دارد.
          </div>
        </div>
      )}

      <Card>
        <div className="mb-4">
          <h3 className="font-bold text-gray-900">دقت تخمین خدمات</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            میله‌ی خاکستری تخمین، میله‌ی رنگی زمان واقعی. کم‌دقت‌ترین خدمت اول آمده است.
          </p>
        </div>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full text-right text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50">
                {['خدمت', 'دفعات', 'تخمین', 'واقعی', 'مقایسه', 'به‌موقع', 'میانگین تأخیر'].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.services.map(s => {
                const t = rateTone(s.onTimePercent);
                return (
                  <tr key={s.serviceId} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2.5 font-bold text-gray-900">{s.serviceName}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fa(s.timesPerformed)}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-500">{fa(s.estimatedMinutes)}′</td>
                    <td className={`px-3 py-2.5 font-mono font-bold ${s.averageActualMinutes > s.estimatedMinutes ? 'text-red-600' : 'text-emerald-600'}`}>
                      {fa(s.averageActualMinutes)}′
                    </td>
                    <td className="px-3 py-2.5">
                      <DurationBars estimated={s.estimatedMinutes} actual={s.averageActualMinutes} scale={scale} />
                    </td>
                    <td className={`px-3 py-2.5 font-bold ${t.text}`}>{fa(s.onTimePercent)}٪</td>
                    <td className="px-3 py-2.5 font-mono text-gray-600">
                      {s.averageOverrunMinutes > 0 ? `+${fa(s.averageOverrunMinutes)}′` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h3 className="font-bold text-gray-900">راندمان پرسنل</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">سفارش‌هایی که هر نفر روی آن‌ها کار کرده — بیشترین دقت اول.</p>
        </div>
        <div className="space-y-2">
          {data.workers.map(w => {
            const t = rateTone(w.onTimePercent);
            return (
              <div key={w.workerId} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-900">{w.fullName}</div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {fa(w.orderCount)} سفارش · میانگین {fa(w.averageActualMinutes)} دقیقه
                    {w.averageOverrunMinutes > 0 && ` · تأخیر ${fa(w.averageOverrunMinutes)} دقیقه`}
                  </div>
                </div>
                <div className="w-28 flex-shrink-0">
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                    <div className={`h-full rounded-full ${t.bg}`} style={{ width: `${w.onTimePercent}%` }} />
                  </div>
                </div>
                <div className={`w-12 flex-shrink-0 text-left text-sm font-extrabold ${t.text}`}>
                  {fa(w.onTimePercent)}٪
                </div>
                {w.onTimePercent >= 85
                  ? <TrendingUp size={15} className="flex-shrink-0 text-emerald-500" />
                  : <TrendingDown size={15} className="flex-shrink-0 text-gray-300" />}
              </div>
            );
          })}
          {data.workers.length === 0 && (
            <p className="py-6 text-center text-xs text-gray-400">
              هیچ سفارشی با پرسنل مشخص ثبت نشده. برای دیدن راندمان، موقع افزودن خدمت پرسنل آن را انتخاب کنید.
            </p>
          )}
        </div>
      </Card>

      {/* Stated on the screen rather than buried in documentation: a manager acting on these
          numbers needs to know what they do and do not measure. */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-gray-50 p-4 text-[11px] leading-6 text-gray-500">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
        <p>
          زمان واقعی از لحظه‌ی ورود خودرو به جایگاه تا بسته‌شدن سفارش محاسبه می‌شود، پس شامل انتظار و تسویه هم هست، نه فقط زمان کار.
          وقتی چند خدمت روی یک سفارش باشد، زمان واقعی به نسبت تخمین هر خدمت بین آن‌ها تقسیم می‌شود.
        </p>
      </div>
    </div>
  );
};
