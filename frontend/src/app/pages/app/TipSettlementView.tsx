import React, { useEffect, useState } from 'react';
import { Coins, Loader2, Check, History, Info } from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';
import { WorkerAvatar } from '../../components/WorkerAvatar';
import { tipsApi, ApiException } from '../../api';
import type { TipLedger, TipBalanceRow } from '../../api/types';
import { resolveUploadUrl } from '../../api/adapters';
import { useCarWash } from '../../store';
import { toJalaliLabel } from '../../lib/persian';

const fa = (n: number) => n.toLocaleString('fa-IR');
const money = (rials: number) => fa(Math.round(rials / 10));
const day = (iso?: string | null) => (iso ? toJalaliLabel(iso.slice(0, 10)) : '—');

/**
 * What each worker is owed in tips, and the record of what has been handed over.
 *
 * The earnings were never the problem — every tip has been recorded against a service line
 * since the beginning. What was missing was the other half: the manager pays out cash on a
 * Friday and both sides remember it differently a month later, with nothing written down to
 * settle the argument. Every settlement here records the period it covered, so the question
 * "what have I already paid you for" has an answer.
 *
 * The amount handed over is editable and defaults to what is owed, because managers round to
 * something that can be paid in notes, and forcing the exact figure would just mean the number
 * on the screen stops matching the money in the envelope.
 */
export const TipSettlementView = () => {
  const { branches } = useCarWash();
  const [ledger, setLedger] = useState<TipLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const branchId = branches[0]?.id;

  const load = async () => {
    setLoading(true); setErr(null);
    try { setLedger(await tipsApi.ledger()); }
    catch (e) { setErr(e instanceof ApiException ? e.message : 'اطلاعات انعام بارگذاری نشد'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openSettle = (row: TipBalanceRow) => {
    setSettling(row.workerId);
    // Tomans, because that is what the manager counts out.
    setAmount(Math.round(row.unsettledRials / 10));
    setNote('');
  };

  const submit = async (row: TipBalanceRow) => {
    if (!branchId || busy) return;
    setBusy(true); setErr(null);
    try {
      await tipsApi.settle({
        workerId: row.workerId,
        branchId,
        throughUtc: new Date().toISOString(),
        paidRials: amount * 10,
        note: note.trim() || null,
      });
      setSettling(null);
      setDone(row.workerId);
      setTimeout(() => setDone(null), 2500);
      await load();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'ثبت تسویه انجام نشد');
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400"><Loader2 className="mx-auto mb-2 animate-spin" size={20} />در حال بارگذاری…</div>;
  }

  const owed = ledger?.balances.filter(b => b.unsettledRials > 0) ?? [];
  const clear = ledger?.balances.filter(b => b.unsettledRials === 0) ?? [];

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <PageHeader title="تسویه انعام" subtitle="مانده‌ی هر نفر و سابقه‌ی پرداخت‌ها" />

      {err && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</div>}

      <Card className="mb-4 p-4">
        <div className="text-[11px] font-medium text-gray-500">جمع انعام پرداخت‌نشده</div>
        <div className="mt-1 text-3xl font-extrabold text-gray-900">
          {money(ledger?.totalUnsettledRials ?? 0)}
          <span className="mr-2 text-sm font-medium text-gray-400">تومان</span>
        </div>
      </Card>

      {owed.length === 0 ? (
        <Card><EmptyState icon={Check} title="همه‌ی انعام‌ها تسویه شده"
          hint="هر انعامی که از این پس ثبت شود، اینجا به‌عنوان مانده نمایش داده می‌شود." /></Card>
      ) : (
        <div className="space-y-2">
          {owed.map(row => (
            <Card key={row.workerId} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <WorkerAvatar src={resolveUploadUrl(row.avatarUrl)} name={row.fullName} size={40} rounded="xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-gray-900">{row.fullName}</div>
                  <div className="text-[11px] text-gray-500">
                    {fa(row.unsettledOrders)} سفارش از {day(row.unsettledFromUtc)}
                    {row.settledThroughUtc && ` · آخرین تسویه تا ${day(row.settledThroughUtc)}`}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-mono text-lg font-extrabold text-gray-900">{money(row.unsettledRials)}</div>
                  <div className="text-[10px] text-gray-400">تومان</div>
                </div>
                {done === row.workerId ? (
                  <span className="flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    <Check size={14} />ثبت شد
                  </span>
                ) : (
                  <button onClick={() => openSettle(row)}
                    className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">
                    تسویه
                  </button>
                )}
              </div>

              {settling === row.workerId && (
                <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[140px_1fr_auto]">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-gray-500">مبلغ پرداختی (تومان)</span>
                    <input type="number" value={amount} onChange={e => setAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-gray-500">توضیح (اختیاری)</span>
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="مثلاً نقدی، تحویل داده شد"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
                  </label>
                  <div className="flex items-end gap-2">
                    <button onClick={() => submit(row)} disabled={busy}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : 'ثبت'}
                    </button>
                    <button onClick={() => setSettling(null)} className="px-2 text-xs font-bold text-gray-500">انصراف</button>
                  </div>
                  <p className="text-[11px] leading-5 text-gray-500 sm:col-span-3">
                    این تسویه بازه‌ی {day(row.unsettledFromUtc)} تا امروز را می‌بندد. مبلغ کارکرد
                    <b className="text-gray-800"> {money(row.unsettledRials)} </b> تومان است؛ اگر مبلغ دیگری پرداخت کنید، تفاوت ثبت می‌شود.
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {clear.length > 0 && (
        <Card className="mt-4 p-4">
          <div className="mb-2 text-[11px] font-bold text-gray-500">بدون مانده</div>
          <div className="flex flex-wrap gap-2">
            {clear.map(row => (
              <span key={row.workerId} className="flex items-center gap-1.5 rounded-xl bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600">
                <WorkerAvatar src={resolveUploadUrl(row.avatarUrl)} name={row.fullName} size={18} />
                {row.fullName}
              </span>
            ))}
          </div>
        </Card>
      )}

      {(ledger?.recentSettlements.length ?? 0) > 0 && (
        <Card className="mt-4 p-0">
          <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3 text-[11px] font-bold text-gray-500">
            <History size={13} />سابقه‌ی تسویه‌ها
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="bg-gray-50">
                  {['پرسنل', 'بازه', 'کارکرد', 'پرداختی', 'تاریخ ثبت', 'توضیح'].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger!.recentSettlements.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-gray-900">{s.workerName}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{day(s.periodFromUtc)} — {day(s.periodToUtc)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-gray-600">{money(s.earnedRials)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-gray-900">{money(s.paidRials)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{day(s.settledAtUtc)}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-gray-50 p-4 text-[11px] leading-6 text-gray-500">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
        <p>
          مانده فقط از سفارش‌های <b>تکمیل‌شده</b> حساب می‌شود؛ سفارشی که هنوز باز است ممکن است لغو شود
          و پرداخت انعامش باید پس گرفته شود. هر تسویه بازه‌ی خودش را می‌بندد، پس یک روز دو بار تسویه نمی‌شود.
        </p>
      </div>
    </div>
  );
};
