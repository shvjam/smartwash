import React, { useEffect, useState } from 'react';
import { Users, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { reportsApi, type WorkerScorecardReport, type WorkerScorecardRow } from '../../api';
import { Card } from '../../components/app/PageHeader';
import { WorkerAvatar } from '../../components/WorkerAvatar';
import { useCarWash } from '../../store';

const fa = (n: number) => n.toLocaleString('fa-IR');
const money = (rials: number) => fa(Math.round(rials / 10)); // نمایش به تومان
const dec = (x10: number) => fa(Math.round(x10 / 10 * 10) / 10);

/**
 * How far this worker sits from the team, as a signed percentage.
 * A raw number invites the reader to compare in their head; this states the comparison.
 */
const delta = (value: number, average: number) => {
  if (average === 0) return null;
  const pct = Math.round(((value - average) / average) * 100);
  return pct === 0 ? null : pct;
};

const Delta = ({ value, average, higherIsBetter = true }: {
  value: number; average: number; higherIsBetter?: boolean;
}) => {
  const d = delta(value, average);
  if (d === null) return <span className="text-[10px] text-gray-400">هم‌تراز میانگین</span>;
  const good = higherIsBetter ? d > 0 : d < 0;
  return (
    <span className={`text-[10px] font-bold ${good ? 'text-emerald-600' : 'text-brand-600'}`}>
      {d > 0 ? '+' : '−'}{fa(Math.abs(d))}٪ نسبت به میانگین
    </span>
  );
};

const Metric = ({ label, value, unit, children }: {
  label: string; value: string; unit?: string; children?: React.ReactNode;
}) => (
  <div className="min-w-0">
    <div className="text-[10px] font-medium text-gray-500">{label}</div>
    <div className="mt-0.5 text-lg font-extrabold text-gray-900">
      {value}{unit && <span className="mr-1 text-[11px] font-medium text-gray-400">{unit}</span>}
    </div>
    {children}
  </div>
);

/**
 * Reads the three situations apart, which is the whole reason this screen exists: the same
 * low order count can mean fewer days, slower work, or longer jobs, and they call for
 * opposite responses from a manager.
 */
const diagnose = (w: WorkerScorecardRow, team: WorkerScorecardReport['team']): string | null => {
  const belowVolume = team.ordersCompleted > 0 && w.ordersCompleted < team.ordersCompleted * 0.75;
  if (!belowVolume) return null;

  const fewerDays = team.activeDays > 0 && w.activeDays < team.activeDays * 0.75;
  const normalRate = team.ordersPerActiveDayX10 > 0
    && w.ordersPerActiveDayX10 >= team.ordersPerActiveDayX10 * 0.85;
  const slow = team.averageOrderMinutes > 0 && w.averageOrderMinutes > team.averageOrderMinutes * 1.25;
  const longJobs = w.serviceMix.length > 0
    && w.serviceMix[0].totalMinutes / Math.max(1, w.serviceMix[0].count) > team.averageOrderMinutes;

  if (fewerDays && normalRate) return 'تعداد کمتر، ولی نرخ روزانه عادی — روزهای کاری کمتری داشته است.';
  if (slow) return 'تعداد کمتر و زمان هر سفارش بیشتر از میانگین — سرعت اجرا را بررسی کنید.';
  if (longJobs) return 'تعداد کمتر، ولی خدمات طولانی‌تری انجام داده — با تعداد قابل مقایسه نیست.';
  return 'تعداد کمتر از میانگین تیم — علتش از این معیارها روشن نیست.';
};

export const WorkerScorecards = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  // The report is built from order lines and carries no photo, so it is matched back to the
  // staff list the app already holds rather than widening the API for one image.
  const { workers } = useCarWash();
  const photoOf = (id: string) => workers.find(w => w.id === id)?.avatar;

  const [data, setData] = useState<WorkerScorecardReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    reportsApi.workerScorecards(fromDate, toDate)
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setErr('کارنامه پرسنل بارگذاری نشد'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fromDate, toDate]);

  if (loading) return <div className="py-16 text-center text-sm text-gray-400">در حال محاسبه…</div>;
  if (err) return <div className="py-16 text-center text-sm text-red-600">{err}</div>;
  if (!data || data.workers.length === 0) {
    return (
      <Card className="py-16 text-center">
        <Users className="mx-auto mb-3 text-gray-300" size={32} />
        <div className="font-bold text-gray-700">هنوز کارکردی برای مقایسه نیست</div>
        <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-gray-500">
          این کارنامه فقط سفارش‌هایی را می‌شمارد که پرسنل روی خط خدمت مشخص شده باشد.
          هنگام افزودن خدمت به سفارش، پرسنل آن را انتخاب کنید.
        </p>
      </Card>
    );
  }

  const { team } = data;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 text-[11px] font-bold text-gray-500">میانگین تیم در این بازه</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="سفارش" value={fa(team.ordersCompleted)} />
          <Metric label="خدمت" value={fa(team.servicesPerformed)} />
          <Metric label="روز کاری" value={fa(team.activeDays)} />
          <Metric label="سفارش در روز" value={dec(team.ordersPerActiveDayX10)} />
          <Metric label="زمان هر سفارش" value={fa(team.averageOrderMinutes)} unit="دقیقه" />
          <Metric label="به‌موقع" value={`${fa(team.onTimePercent)}٪`} />
        </div>
      </Card>

      <div className="space-y-3">
        {data.workers.map(w => {
          const note = diagnose(w, team);
          const expanded = open === w.workerId;
          return (
            <Card key={w.workerId} className="overflow-hidden p-0">
              <div className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <WorkerAvatar src={photoOf(w.workerId)} name={w.fullName} size={38} rounded="xl" />
                    <div className="min-w-0">
                      <div className="truncate font-bold text-gray-900">{w.fullName}</div>
                      <div className="text-[11px] text-gray-500">{w.role || '—'}</div>
                    </div>
                  </div>
                  <button onClick={() => setOpen(expanded ? null : w.workerId)}
                    className="flex flex-shrink-0 items-center gap-1 rounded-xl bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-100">
                    ترکیب کار {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric label="سفارش" value={fa(w.ordersCompleted)}>
                    <Delta value={w.ordersCompleted} average={team.ordersCompleted} />
                  </Metric>
                  <Metric label="روز کاری" value={fa(w.activeDays)}>
                    <Delta value={w.activeDays} average={team.activeDays} />
                  </Metric>
                  <Metric label="سفارش در روز" value={dec(w.ordersPerActiveDayX10)}>
                    <Delta value={w.ordersPerActiveDayX10} average={team.ordersPerActiveDayX10} />
                  </Metric>
                  <Metric label="زمان هر سفارش" value={fa(w.averageOrderMinutes)} unit="دقیقه">
                    <Delta value={w.averageOrderMinutes} average={team.averageOrderMinutes} higherIsBetter={false} />
                  </Metric>
                  <Metric label="به‌موقع" value={`${fa(w.onTimePercent)}٪`}>
                    <Delta value={w.onTimePercent} average={team.onTimePercent} />
                  </Metric>
                  <Metric label="درآمدزایی" value={money(w.revenueRials)} unit="تومان">
                    <Delta value={w.revenueRials} average={team.revenueRials} />
                  </Metric>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-50 pt-3 text-[11px] text-gray-500">
                  <span>کمیسیون <b className="text-gray-800">{money(w.commissionRials)}</b> تومان</span>
                  <span>انعام <b className="text-gray-800">{money(w.tipsRials)}</b> تومان</span>
                  <span>مجموع دریافتی <b className="text-emerald-700">{money(w.earningsRials)}</b> تومان</span>
                  <span>میانگین ارزش هر خدمت <b className="text-gray-800">{money(w.averageServiceValueRials)}</b> تومان</span>
                  {w.averageOverrunMinutes > 0 && (
                    <span className="text-red-600">میانگین تأخیر <b>{fa(w.averageOverrunMinutes)}</b> دقیقه</span>
                  )}
                </div>

                {note && (
                  <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-6 text-amber-900">
                    {note}
                  </div>
                )}
              </div>

              {expanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="mb-2 text-[11px] font-bold text-gray-500">خدماتی که انجام داده</div>
                  <div className="space-y-1.5">
                    {w.serviceMix.map(m => (
                      <div key={m.serviceId} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-gray-800">{m.serviceName}</span>
                        <span className="flex-shrink-0 font-mono text-gray-500">
                          {fa(m.count)} بار · {fa(m.totalMinutes)} دقیقه
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-gray-50 p-4 text-[11px] leading-6 text-gray-500">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
        <p>
          «روز کاری» یعنی روزهایی که این نفر دست‌کم یک سفارش را بسته است. سامانه ثبت حضور و غیاب ندارد،
          پس اگر کسی حاضر بوده ولی سفارشی تمام نکرده، در این شمارش نمی‌آید.
          مقایسه‌ها نسبت به میانگین همین بازه است و فقط سفارش‌هایی شمرده می‌شوند که پرسنلشان مشخص شده باشد.
        </p>
      </div>
    </div>
  );
};
