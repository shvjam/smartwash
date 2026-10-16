import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Gauge, Info, Loader2, TrendingUp, TrendingDown, Users, Wrench, ShieldQuestion,
} from 'lucide-react';
import clsx from 'clsx';
import { reportsApi } from '../../api';
import type { BayPerformanceReport, WaitingReport, StaffingReport, RevenueReport, ActivityLogRow } from '../../api/types';
import { BayType } from '../../api/types';
import { Card } from '../../components/app/PageHeader';
import { BAY_TYPE_LABEL } from '../../lib/orderStages';
import { toJalaliLabel } from '../../lib/persian';

const fa = (n: number) => n.toLocaleString('fa-IR');
const money = (rials: number) => fa(Math.round(rials / 10));
const hm = (minutes: number) =>
  minutes >= 60 ? `${fa(Math.floor(minutes / 60))} ساعت ${fa(minutes % 60)} دقیقه` : `${fa(minutes)} دقیقه`;

const Loading = () => (
  <div className="py-16 text-center text-sm text-gray-400"><Loader2 className="mx-auto mb-2 animate-spin" size={20} />در حال محاسبه…</div>
);
const Failed = ({ what }: { what: string }) => (
  <div className="py-16 text-center text-sm text-red-600">{what} بارگذاری نشد</div>
);

/** Loads one report and hands it over, so four tabs do not repeat the same six lines. */
function useReport<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true); setFailed(false);
    load()
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, failed };
}

// ══════════════════════════════ bay performance ══════════════════════════════

/**
 * What each bay did, and what stopped it.
 *
 * Utilisation is measured against the time a bay could have worked rather than the whole
 * period, so a bay closed for three days reads as unavailable rather than as lazy — the
 * difference between calling a repairman and having a word with the crew.
 */
export const BayPerformanceTab = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  const { data, loading, failed } = useReport<BayPerformanceReport>(
    () => reportsApi.bayPerformance(fromDate, toDate), [fromDate, toDate]);

  if (loading) return <Loading />;
  if (failed) return <Failed what="عملکرد جایگاه‌ها" />;
  if (!data || data.bays.length === 0) {
    return <Card className="py-16 text-center">
      <Gauge className="mx-auto mb-3 text-gray-300" size={32} />
      <div className="font-bold text-gray-700">جایگاهی تعریف نشده</div>
    </Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">خودروی سرویس‌شده</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{fa(data.totalCarsServed)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">زمان غیرفعالی</div>
          <div className={clsx('mt-1 text-2xl font-extrabold', data.totalDownMinutes > 0 ? 'text-amber-600' : 'text-gray-900')}>
            {hm(data.totalDownMinutes)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">بازه‌ی بررسی</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{hm(data.windowMinutes)}</div>
        </Card>
      </div>

      <div className="space-y-2">
        {data.bays.map(b => (
          <Card key={b.bayId} className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <b className="text-sm text-gray-900">{b.name}</b>
                <span className="mr-2 rounded-lg bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                  {BAY_TYPE_LABEL[b.type as BayType]}
                </span>
                {!b.isActive && <span className="mr-1 rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">غیرفعال</span>}
              </div>
              <div className="text-left">
                <span className="font-mono text-lg font-extrabold text-gray-900">{fa(b.utilisationPercent)}٪</span>
                <span className="mr-1 text-[10px] text-gray-400">بهره‌وری</span>
              </div>
            </div>

            <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className={clsx('h-full rounded-full',
                b.utilisationPercent >= 70 ? 'bg-emerald-500' : b.utilisationPercent >= 40 ? 'bg-amber-500' : 'bg-gray-300')}
                style={{ width: `${Math.min(100, b.utilisationPercent)}%` }} />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500">
              <span>خودرو <b className="text-gray-800">{fa(b.carsServed)}</b></span>
              <span>زمان کار <b className="text-gray-800">{hm(b.busyMinutes)}</b></span>
              <span>میانگین هر خودرو <b className="text-gray-800">{fa(b.averageMinutesPerCar)}</b> دقیقه</span>
              {b.downMinutes > 0 && <span className="text-amber-700">غیرفعالی <b>{hm(b.downMinutes)}</b></span>}
            </div>

            {b.downtime.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-gray-50 pt-2.5">
                {b.downtime.map(d => (
                  <div key={d.reason} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-gray-600"><Wrench size={12} className="text-amber-500" />{d.reasonLabel}</span>
                    <span className="font-mono text-gray-500">{hm(d.minutes)} · {fa(d.occurrences)} بار</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-gray-50 p-4 text-[11px] leading-6 text-gray-500">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
        <p>
          بهره‌وری نسبت به زمانی سنجیده می‌شود که جایگاه <b>می‌توانسته</b> کار کند، نه کل بازه.
          پس جایگاهی که سه روز در تعمیر بوده «بیکار» شمرده نمی‌شود، و علت غیرفعالی هم جدا ثبت می‌شود
          تا نبود نیرو با خرابی اشتباه گرفته نشود.
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════ waiting and bottleneck ══════════════════════════

/**
 * Where the time goes, and which step is the slow one.
 *
 * The bottleneck is named rather than left to be inferred from a column of numbers, because it
 * is the single figure that says where another person or another bay would actually help.
 */
export const WaitingTab = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  const { data, loading, failed } = useReport<WaitingReport>(
    () => reportsApi.waiting(fromDate, toDate), [fromDate, toDate]);

  if (loading) return <Loading />;
  if (failed) return <Failed what="گزارش زمان انتظار" />;
  if (!data || data.carsCounted === 0) {
    return <Card className="py-16 text-center">
      <Gauge className="mx-auto mb-3 text-gray-300" size={32} />
      <div className="font-bold text-gray-700">سفارشی در این بازه ثبت نشده</div>
    </Card>;
  }

  const longest = Math.max(1, ...data.stages.map(s => s.averageMinutes));

  return (
    <div className="space-y-4">
      {data.bottleneckLabel && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div className="text-sm leading-6 text-gray-700">
            گلوگاه عملیاتی: <b className="text-gray-900">{data.bottleneckLabel}</b> — خودروها به‌طور میانگین{' '}
            <b className="text-gray-900">{fa(data.bottleneckMinutes)} دقیقه</b> در این مرحله می‌مانند.
            افزودن نیرو یا جایگاه در همین نقطه بیشترین اثر را دارد.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">خودروهای بررسی‌شده</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{fa(data.carsCounted)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">میانگین کل زمان مشتری</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{hm(data.averageTotalMinutes)}</div>
        </Card>
      </div>

      <Card>
        <div className="mb-4">
          <h3 className="font-bold text-gray-900">زمان در هر مرحله</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">طولانی‌ترین مرحله اول آمده است.</p>
        </div>
        <div className="space-y-2.5">
          {data.stages.map(s => (
            <div key={s.stage}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-bold text-gray-800">{s.label}</span>
                <span className="font-mono text-gray-500">
                  {fa(s.averageMinutes)}′ میانگین · بیشترین {fa(s.longestMinutes)}′ · {fa(s.carsCounted)} خودرو
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className={clsx('h-full rounded-full',
                  s.stage === data.bottleneckStage ? 'bg-amber-500' : 'bg-brand-400')}
                  style={{ width: `${Math.round((s.averageMinutes / longest) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-start gap-2.5 rounded-2xl bg-gray-50 p-4 text-[11px] leading-6 text-gray-500">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
        <p>
          زمان هر مرحله از فاصله‌ی آن تا مرحله‌ی بعدی حساب می‌شود، پس فقط برای سفارش‌هایی معنا دارد
          که مراحلشان ثبت شده باشد. مرحله‌ی جاری خودرویی که همین حالا در حال شستشوست شمرده نمی‌شود،
          چون هنوز تمام نشده.
        </p>
      </div>
    </div>
  );
};

// ═════════════════════════════════ staffing ══════════════════════════════════

export const StaffingTab = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  const { data, loading, failed } = useReport<StaffingReport>(
    () => reportsApi.staffing(fromDate, toDate), [fromDate, toDate]);

  if (loading) return <Loading />;
  if (failed) return <Failed what="گزارش نیروی انسانی" />;
  if (!data) return null;

  const withStaff = data.days.filter(d => d.headCount > 0 || d.carsServed > 0);
  const busiest = Math.max(1, ...data.days.map(d => d.carsServed));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">میانگین نفرات روزانه</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{fa(data.averageHeadCount)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">کل پرسنل</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{fa(data.totalWorkers)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">فعال</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-600">{fa(data.activeWorkers)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">غیرفعال</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-400">{fa(data.inactiveWorkers)}</div>
        </Card>
      </div>

      {withStaff.length === 0 ? (
        <Card className="py-16 text-center">
          <Users className="mx-auto mb-3 text-gray-300" size={32} />
          <div className="font-bold text-gray-700">برنامه‌ی شیفتی برای این بازه ثبت نشده</div>
          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-gray-500">
            این گزارش از «برنامه شیفت» خوانده می‌شود. با ثبت شیفت‌ها، تعداد نفرات هر روز کنار
            تعداد خودروی آن روز دیده می‌شود.
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="bg-gray-50">
                  {['روز', 'نفرات', 'شستشو', 'خشک', 'آپشن', 'صندوق', 'خودرو', 'خودرو به ازای نفر'].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withStaff.map(d => (
                  <tr key={d.date} className="border-b border-gray-50 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-gray-900">{toJalaliLabel(d.date.slice(0, 10))}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-900">{fa(d.headCount)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fa(d.washers)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fa(d.dryers)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fa(d.optionStaff)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fa(d.cashiers)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-900">{fa(d.carsServed)}</span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                          <span className="block h-full rounded-full bg-brand-400" style={{ width: `${Math.round((d.carsServed / busiest) * 100)}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-gray-800">
                      {d.headCount === 0 ? '—' : fa(Math.round((d.carsServed / d.headCount) * 10) / 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ══════════════════════════════ layered revenue ══════════════════════════════

const Delta = ({ percent }: { percent?: number | null }) => {
  if (percent === null || percent === undefined) return <span className="text-[10px] text-gray-400">بدون مقایسه</span>;
  const up = percent > 0;
  if (percent === 0) return <span className="text-[10px] text-gray-400">بدون تغییر</span>;
  return (
    <span className={clsx('flex items-center gap-0.5 text-[10px] font-bold', up ? 'text-emerald-600' : 'text-red-600')}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {fa(Math.abs(percent))}٪
    </span>
  );
};

export const RevenueTab = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  const [bucket, setBucket] = useState<'day' | 'week' | 'month'>('day');
  const { data, loading, failed } = useReport<RevenueReport>(
    () => reportsApi.revenue(fromDate, toDate, bucket), [fromDate, toDate, bucket]);

  if (loading) return <Loading />;
  if (failed) return <Failed what="گزارش درآمد" />;
  if (!data) return null;

  const peak = Math.max(1, ...data.buckets.map(b => b.revenueRials));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">درآمد کل</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{money(data.revenueRials)}</div>
          <div className="mt-0.5"><Delta percent={data.revenueChangePercent} /></div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">تعداد سفارش</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{fa(data.orders)}</div>
          <div className="mt-0.5"><Delta percent={data.ordersChangePercent} /></div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">میانگین هر سفارش</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{money(data.averageOrderRials)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">انعام</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{money(data.tipsRials)}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-[11px] leading-6 text-gray-500">
          مقایسه با بازه‌ی قبل ({toJalaliLabel(data.previousFromDate)} تا {toJalaliLabel(data.previousToDate)}):
          درآمد آن بازه <b className="text-gray-800">{money(data.previousRevenueRials)}</b> تومان با{' '}
          <b className="text-gray-800">{fa(data.previousOrders)}</b> سفارش بوده است.
          {data.directToWorkerRials > 0 && (
            <> همچنین <b className="text-amber-700">{money(data.directToWorkerRials)}</b> تومان بابت خدمات آپشن
            مستقیماً توسط اپراتورها دریافت شده و در درآمد کارواش شمرده نشده است.</>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-gray-900">روند درآمد</h3>
          <div className="flex gap-1">
            {([['day', 'روزانه'], ['week', 'هفتگی'], ['month', 'ماهانه']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setBucket(v)}
                className={clsx('rounded-lg px-2.5 py-1 text-[11px] font-bold',
                  bucket === v ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600')}>{l}</button>
            ))}
          </div>
        </div>
        {data.buckets.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">درآمدی در این بازه ثبت نشده.</p>
        ) : (
          <div className="space-y-1.5">
            {data.buckets.map(b => (
              <div key={b.label} className="flex items-center gap-3 text-[11px]">
                <span className="w-20 flex-shrink-0 text-gray-600">{toJalaliLabel(b.label)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.round((b.revenueRials / peak) * 100)}%` }} />
                </span>
                <span className="w-24 flex-shrink-0 text-left font-mono text-gray-800">{money(b.revenueRials)}</span>
                <span className="w-10 flex-shrink-0 text-left text-gray-400">{fa(b.orders)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-0">
        <div className="border-b border-gray-100 px-4 py-3 text-[11px] font-bold text-gray-500">درآمد به تفکیک خدمت</div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50">
                {['خدمت', 'تعداد', 'درآمد', 'بازه‌ی قبل', 'تغییر', 'دریافت مستقیم'].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.services.map(s => (
                <tr key={s.serviceId} className="border-b border-gray-50 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-gray-900">{s.serviceName}</td>
                  <td className="px-3 py-2.5 text-gray-600">{fa(s.timesSold)}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-gray-900">{money(s.revenueRials)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-500">{money(s.previousRevenueRials)}</td>
                  <td className="px-3 py-2.5"><Delta percent={s.changePercent} /></td>
                  <td className="px-3 py-2.5 font-mono text-amber-700">
                    {s.directToWorkerRials > 0 ? money(s.directToWorkerRials) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════ activity log ════════════════════════════════

/**
 * What the people with logins actually did.
 *
 * Entries only exist from the day this shipped: the table was there from the start, but nothing
 * ever wrote to it, so there is no history to show for anything before then. The screen says so
 * rather than presenting an empty table as though nothing had happened.
 */
export const ActivityLogTab = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  const [page, setPage] = useState(1);
  const { data, loading, failed } = useReport(
    () => reportsApi.activityLog(fromDate, toDate, { page, pageSize: 50 }), [fromDate, toDate, page]);

  useEffect(() => { setPage(1); }, [fromDate, toDate]);

  if (loading) return <Loading />;
  if (failed) return <Failed what="گزارش عملکرد کاربران" />;

  const rows = (data?.items ?? []) as ActivityLogRow[];
  const pages = Math.max(1, Math.ceil((data?.totalCount ?? 0) / 50));

  if (rows.length === 0) {
    return (
      <Card className="py-16 text-center">
        <ShieldQuestion className="mx-auto mb-3 text-gray-300" size={32} />
        <div className="font-bold text-gray-700">فعالیتی در این بازه ثبت نشده</div>
        <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-gray-500">
          ثبت عملیات کاربران از همین نسخه فعال شده است، پس سوابق قبل از آن وجود ندارد.
          از این پس هر تغییر مهم با نام کاربر و ساعت ثبت می‌شود.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs" dir="rtl">
            <thead>
              <tr className="bg-gray-50">
                {['زمان', 'کاربر', 'عملیات', 'موضوع', 'آی‌پی'].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">
                    {toJalaliLabel(r.atUtc.slice(0, 10))} ·{' '}
                    {new Date(r.atUtc).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-gray-900">{r.userName}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{r.actionLabel}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{r.entityName}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-gray-400" dir="ltr">{r.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="rounded-xl bg-gray-50 px-3 py-1.5 font-bold text-gray-600 disabled:opacity-40">قبلی</button>
            <span className="text-gray-500">صفحه {fa(page)} از {fa(pages)}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              className="rounded-xl bg-gray-50 px-3 py-1.5 font-bold text-gray-600 disabled:opacity-40">بعدی</button>
          </div>
        )}
      </Card>
    </div>
  );
};
