import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ChevronDown, ChevronUp, Info, Loader2 } from 'lucide-react';
import { reportsApi, type OrderArchiveRow } from '../../api';
import { OrderStage, OrderStatus } from '../../api/types';
import { Card } from '../../components/app/PageHeader';
import { WorkerAvatar } from '../../components/WorkerAvatar';
import { STAGE_META } from '../../lib/orderStages';
import { useCarWash } from '../../store';

const fa = (n: number) => n.toLocaleString('fa-IR');
const money = (rials: number) => fa(Math.round(rials / 10));
const clock = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—';
const day = (iso: string) => new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
const mins = (m?: number | null) => (m === null || m === undefined ? '—' : `${fa(m)}′`);

/**
 * One row per car, with the four things the manager kept asking for on the same line:
 * which bay, which person, what time, which car.
 *
 * The other report screens summarise; this one does not. When someone is checking a specific
 * complaint — a car that took two hours, a wash nobody remembers doing — an average is no use
 * and the individual record is the whole point. Expanding a row shows the timeline and the
 * staff, because putting all of that in the table would make it unreadable on a phone.
 */
export const OrderArchive = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  const { bays, workers } = useCarWash();
  const [rows, setRows] = useState<OrderArchiveRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [bayId, setBayId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const pageSize = 50;

  // A changed filter must go back to the first page, or the reader lands on page four of a
  // result set that now has one page and sees nothing.
  useEffect(() => { setPage(1); }, [fromDate, toDate, bayId, workerId]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    reportsApi.orderArchive(fromDate, toDate, {
      bayId: bayId || undefined,
      workerId: workerId || undefined,
      page, pageSize,
    })
      .then(res => { if (alive) { setRows(res.items); setTotal(res.totalCount); } })
      .catch(() => { if (alive) setErr('آرشیو سفارش‌ها بارگذاری نشد'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fromDate, toDate, bayId, workerId, page]);

  const photoOf = (id: string) => workers.find(w => w.id === id)?.avatar;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const summary = useMemo(() => {
    const withWash = rows.filter(r => r.washMinutes != null);
    const withWait = rows.filter(r => r.waitBeforeWashMinutes != null);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    return {
      wash: avg(withWash.map(r => r.washMinutes!)),
      wait: avg(withWait.map(r => r.waitBeforeWashMinutes!)),
      total: avg(rows.filter(r => r.totalMinutes != null).map(r => r.totalMinutes!)),
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[9rem] flex-1">
            <span className="mb-1.5 block text-[11px] font-medium text-gray-500">جایگاه</span>
            <select value={bayId} onChange={e => setBayId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="">همه‌ی جایگاه‌ها</option>
              {bays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="min-w-[9rem] flex-1">
            <span className="mb-1.5 block text-[11px] font-medium text-gray-500">پرسنل</span>
            <select value={workerId} onChange={e => setWorkerId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="">همه‌ی پرسنل</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <div className="text-[11px] text-gray-500">
            <b className="text-gray-900">{fa(total)}</b> سفارش در این بازه
          </div>
        </div>

        {(summary.total !== null || summary.wash !== null) && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-50 pt-3 text-[11px] text-gray-500">
            {summary.total !== null && <span>میانگین کل زمان مشتری <b className="text-gray-800">{fa(summary.total)}</b> دقیقه</span>}
            {summary.wash !== null && <span>میانگین زمان شستشو <b className="text-gray-800">{fa(summary.wash)}</b> دقیقه</span>}
            {summary.wait !== null && <span>میانگین انتظار تا شروع کار <b className="text-amber-700">{fa(summary.wait)}</b> دقیقه</span>}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">
          <Loader2 className="mx-auto mb-2 animate-spin" size={20} />در حال بارگذاری…
        </div>
      ) : err ? (
        <div className="py-16 text-center text-sm text-red-600">{err}</div>
      ) : rows.length === 0 ? (
        <Card className="py-16 text-center">
          <Archive className="mx-auto mb-3 text-gray-300" size={32} />
          <div className="font-bold text-gray-700">سفارشی در این بازه ثبت نشده</div>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="bg-gray-50">
                  {['سفارش', 'زمان', 'جایگاه', 'خودرو', 'مشتری', 'پرسنل', 'مدت', 'مبلغ', 'وضعیت', ''].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const expanded = open === r.orderId;
                  const meta = STAGE_META[r.stage];
                  return (
                    <React.Fragment key={r.orderId}>
                      <tr className="border-b border-gray-50 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-gray-900">{r.number}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">
                          {day(r.receivedAtUtc)} · {clock(r.receivedAtUtc)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{r.bayName}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <div className="font-mono font-bold text-gray-900">{r.vehiclePlate}</div>
                          {(r.vehicleBrand || r.vehicleModel) && (
                            <div className="text-[10px] text-gray-400">{[r.vehicleBrand, r.vehicleModel].filter(Boolean).join(' ')}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{r.customerName}</td>
                        <td className="px-3 py-2.5">
                          {r.workers.length === 0
                            ? <span className="text-[10px] text-amber-600">تعیین نشده</span>
                            : (
                              <div className="flex items-center -space-x-2 space-x-reverse">
                                {r.workers.slice(0, 3).map(w => (
                                  <WorkerAvatar key={w.workerId} src={photoOf(w.workerId)} name={w.fullName}
                                    size={22} className="border-2 border-white" />
                                ))}
                                {r.workers.length > 3 && (
                                  <span className="text-[10px] text-gray-400">+{fa(r.workers.length - 3)}</span>
                                )}
                              </div>
                            )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-gray-600">{mins(r.totalMinutes)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-gray-900">
                          {money(r.totalRials)}
                          {r.outstandingRials > 0 && (
                            <div className="text-[10px] font-bold text-red-600">مانده {money(r.outstandingRials)}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${meta?.tone ?? 'bg-gray-100 text-gray-600'}`}>
                            {r.status === OrderStatus.Completed && r.stage === OrderStage.Delivered ? 'تحویل شد' : meta?.label ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => setOpen(expanded ? null : r.orderId)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700">
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={10} className="px-4 py-3">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <div className="mb-2 text-[11px] font-bold text-gray-500">مسیر خودرو</div>
                                <div className="space-y-1">
                                  {([
                                    ['پذیرش', r.receivedAtUtc],
                                    ['شروع شستشو', r.washStartedAtUtc],
                                    ['پایان شستشو (آزادی جایگاه)', r.washCompletedAtUtc],
                                    ['آماده تحویل', r.readyAtUtc],
                                    ['تحویل', r.deliveredAtUtc],
                                  ] as Array<[string, string | null | undefined]>).map(([label, at]) => (
                                    <div key={label} className="flex items-center justify-between gap-3 text-[11px]">
                                      <span className={at ? 'text-gray-700' : 'text-gray-300'}>{label}</span>
                                      <span className={`font-mono ${at ? 'text-gray-900' : 'text-gray-300'}`}>{clock(at)}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-200 pt-2 text-[11px] text-gray-500">
                                  <span>انتظار تا شروع <b className="text-gray-800">{mins(r.waitBeforeWashMinutes)}</b></span>
                                  <span>شستشو <b className="text-gray-800">{mins(r.washMinutes)}</b></span>
                                  <span>تخمین <b className="text-gray-800">{mins(r.expectedDurationMinutes)}</b></span>
                                </div>
                              </div>

                              <div>
                                <div className="mb-2 text-[11px] font-bold text-gray-500">پرسنل و خدمات</div>
                                {r.workers.length === 0 ? (
                                  <p className="text-[11px] text-gray-400">
                                    برای این سفارش پرسنلی ثبت نشده، پس در گزارش‌های پرسنلی شمرده نمی‌شود.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {r.workers.map(w => (
                                      <div key={w.workerId} className="flex items-center gap-2.5">
                                        <WorkerAvatar src={photoOf(w.workerId)} name={w.fullName} size={28} rounded="xl" />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-xs font-bold text-gray-900">{w.fullName}</div>
                                          <div className="truncate text-[10px] text-gray-500">{w.services}</div>
                                        </div>
                                        <div className="flex-shrink-0 text-left text-[10px] text-gray-500">
                                          <div>کمیسیون {money(w.commissionRials)}</div>
                                          {w.tipRials > 0 && <div className="text-emerald-600">انعام {money(w.tipRials)}</div>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2 border-t border-gray-200 pt-2 text-[11px] text-gray-500">
                                  خدمات: <span className="text-gray-800">{r.services || '—'}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
      )}

      <div className="flex items-start gap-2.5 rounded-2xl bg-gray-50 p-4 text-[11px] leading-6 text-gray-500">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
        <p>
          زمان‌های «شستشو» و «انتظار» از مراحلی خوانده می‌شوند که اپراتور ثبت کرده است؛
          سفارش‌هایی که بدون ثبت مرحله بسته شده‌اند فقط زمان کل را نشان می‌دهند، چون لحظه‌ی ورود و تحویل همیشه معلوم است.
          سفارش‌های لغوشده در این آرشیو نمی‌آیند.
        </p>
      </div>
    </div>
  );
};
