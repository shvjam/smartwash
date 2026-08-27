import React, { useEffect, useState } from 'react';
import { CreditCard, Plus, X, RefreshCw } from 'lucide-react';
import { platformSubscriptionsApi, SubscriptionDto, SubscriptionStatus, SubscriptionCycle } from '../../api';
import { clsx } from 'clsx';

// کلاس‌های Tailwind باید کاملِ ثابت باشند؛ ساختِ پویا مثل `bg-${c}-500/10` توسط کامپایلر شناسایی نمی‌شود و رنگ اعمال نمی‌شود.
const statusMap: Record<SubscriptionStatus, { l: string; c: string }> = {
  [SubscriptionStatus.PendingPayment]: { l: 'در انتظار پرداخت', c: 'bg-sky-500/10 text-sky-400' },
  [SubscriptionStatus.Active]: { l: 'فعال', c: 'bg-emerald-500/10 text-emerald-400' },
  [SubscriptionStatus.PastDue]: { l: 'سررسید گذشته', c: 'bg-amber-500/10 text-amber-400' },
  [SubscriptionStatus.Cancelled]: { l: 'لغو شده', c: 'bg-gray-500/10 text-gray-400' },
  [SubscriptionStatus.Expired]: { l: 'منقضی', c: 'bg-red-500/10 text-red-400' },
};

export const SubscriptionsAdmin = () => {
  const [list, setList] = useState<SubscriptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | ''>('');

  const reload = async () => {
    setLoading(true);
    try {
      const r = await platformSubscriptionsApi.list({
        status: statusFilter === '' ? undefined : statusFilter, pageSize: 100,
      });
      setList(r.items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [statusFilter]);

  const extend = async (s: SubscriptionDto) => {
    const days = Number(prompt('چند روز تمدید شود؟', '30'));
    if (!days || days <= 0) return;
    try { await platformSubscriptionsApi.extend(s.id, days); await reload(); }
    catch (e: any) { alert(e?.message ?? 'خطا در تمدید اشتراک'); }
  };
  const cancel = async (s: SubscriptionDto) => {
    if (!confirm(`اشتراک ${s.tenantName} لغو شود؟`)) return;
    try { await platformSubscriptionsApi.cancel(s.id); await reload(); }
    catch (e: any) { alert(e?.message ?? 'خطا در لغو اشتراک'); }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-1">اشتراک‌ها</h1>
          <p className="text-gray-400 text-sm">مدیریت اشتراک‌های مستاجران</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-gray-900 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none">
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <button onClick={reload} className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-1.5"><RefreshCw size={14} />تازه‌سازی</button>
        </div>
      </header>

      <div className="bg-gray-900 rounded-3xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-right text-xs text-gray-400">
              <th className="px-5 py-3 font-medium">مستاجر</th>
              <th className="px-5 py-3 font-medium">پلن</th>
              <th className="px-5 py-3 font-medium">دوره</th>
              <th className="px-5 py-3 font-medium">وضعیت</th>
              <th className="px-5 py-3 font-medium">شروع</th>
              <th className="px-5 py-3 font-medium">پایان</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan={7} className="text-center text-gray-500 py-8">در حال بارگذاری…</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 py-12"><CreditCard size={28} className="mx-auto mb-2 opacity-50" />اشتراکی یافت نشد</td></tr>}
            {list.map(s => {
              const st = statusMap[s.status];
              return (
                <tr key={s.id} className="hover:bg-white/5">
                  <td className="px-5 py-4">
                    <div className="font-bold text-white">{s.tenantName}</div>
                    <div className="text-[11px] text-gray-500" dir="ltr">{s.tenantSlug}</div>
                  </td>
                  <td className="px-5 py-4 text-gray-300">{s.planName}</td>
                  <td className="px-5 py-4 text-gray-300 text-xs">{s.cycle === SubscriptionCycle.Monthly ? 'ماهانه' : 'سالانه'}</td>
                  <td className="px-5 py-4"><span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-bold', st.c)}>{st.l}</span></td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{new Date(s.startsAtUtc).toLocaleDateString('fa-IR')}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{new Date(s.currentPeriodEndUtc).toLocaleDateString('fa-IR')}</td>
                  <td className="px-5 py-4 text-left">
                    <div className="flex gap-1.5 justify-end">
                      {(s.status === SubscriptionStatus.Active || s.status === SubscriptionStatus.PastDue) && (
                        <button onClick={() => extend(s)} className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold hover:bg-emerald-500/20 flex items-center gap-1"><Plus size={11} />تمدید</button>
                      )}
                      {s.status !== SubscriptionStatus.Cancelled && (
                        <button onClick={() => cancel(s)} className="text-xs px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 flex items-center gap-1"><X size={11} />لغو</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubscriptionsAdmin;
