import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search, Building2, Power, RefreshCw, ChevronLeft } from 'lucide-react';
import { platformTenantsApi, platformSubscriptionsApi, TenantAdminDto, TenantStatus } from '../../api';
import { clsx } from 'clsx';

// کلاس‌های Tailwind باید کاملِ ثابت باشند؛ ساختِ پویا مثل `bg-${c}-500/10` توسط کامپایلر شناسایی نمی‌شود.
const statusMap: Record<TenantStatus, { l: string; c: string }> = {
  [TenantStatus.Trial]: { l: 'دوره آزمایشی', c: 'bg-sky-500/10 text-sky-400' },
  [TenantStatus.Active]: { l: 'فعال', c: 'bg-emerald-500/10 text-emerald-400' },
  [TenantStatus.Grace]: { l: 'مهلت پرداخت', c: 'bg-amber-500/10 text-amber-400' },
  [TenantStatus.Suspended]: { l: 'تعلیق', c: 'bg-red-500/10 text-red-400' },
  [TenantStatus.Cancelled]: { l: 'لغو شده', c: 'bg-gray-500/10 text-gray-400' },
  [TenantStatus.Expired]: { l: 'منقضی', c: 'bg-red-500/10 text-red-400' },
  [TenantStatus.Archived]: { l: 'آرشیو', c: 'bg-gray-500/10 text-gray-400' },
};

export const TenantsAdmin = () => {
  const [list, setList] = useState<TenantAdminDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await platformTenantsApi.list({ search: search || undefined, pageSize: 50 });
      setList(r.items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const suspend = async (t: TenantAdminDto) => {
    const reason = prompt('علت تعلیق:');
    if (!reason) return;
    try { await platformSubscriptionsApi.suspendTenant(t.id, reason); await reload(); }
    catch (e: any) { alert(e?.message ?? 'خطا در تعلیق مستاجر'); }
  };
  const reactivate = async (t: TenantAdminDto) => {
    try { await platformSubscriptionsApi.reactivateTenant(t.id); await reload(); }
    catch (e: any) { alert(e?.message ?? 'خطا در فعال‌سازی مستاجر'); }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-1">مستاجران</h1>
          <p className="text-gray-400 text-sm">مدیریت کارواش‌های ثبت‌شده در پلتفرم</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && reload()}
              placeholder="جستجو نام یا نامک…"
              className="w-72 bg-gray-900 border border-white/5 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500" />
          </div>
          <button onClick={reload} className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-1.5"><RefreshCw size={14} />به‌روزرسانی</button>
        </div>
      </header>

      <div className="bg-gray-900 rounded-3xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-right text-xs text-gray-400">
              <th className="px-5 py-3 font-medium">نام / نامک</th>
              <th className="px-5 py-3 font-medium">مالک</th>
              <th className="px-5 py-3 font-medium">وضعیت</th>
              <th className="px-5 py-3 font-medium">پلن</th>
              <th className="px-5 py-3 font-medium">سررسید</th>
              <th className="px-5 py-3 font-medium">ساخت</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan={7} className="text-center text-gray-500 py-8">در حال بارگذاری…</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 py-12"><Building2 size={28} className="mx-auto mb-2 opacity-50" />هیچ مستاجری یافت نشد</td></tr>}
            {list.map(t => {
              const s = statusMap[t.status];
              const suspended = t.status === TenantStatus.Suspended;
              return (
                <tr key={t.id} className="hover:bg-white/5">
                  <td className="px-5 py-4">
                    <Link to={`/platform/tenants/${t.id}`} className="font-bold text-white hover:text-violet-300 transition-colors">{t.displayName}</Link>
                    <div className="text-[11px] text-gray-500" dir="ltr">{t.slug}</div>
                  </td>
                  <td className="px-5 py-4 text-gray-300 text-xs">{t.ownerEmail || '-'}</td>
                  <td className="px-5 py-4"><span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-bold', s.c)}>{s.l}</span></td>
                  <td className="px-5 py-4 text-gray-300 text-xs">{t.planCode || '-'}</td>
                  <td className="px-5 py-4 text-gray-300 text-xs">{t.activeUntilUtc ? new Date(t.activeUntilUtc).toLocaleDateString('fa-IR') : '-'}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{new Date(t.createdAtUtc).toLocaleDateString('fa-IR')}</td>
                  <td className="px-5 py-4 text-left">
                    <div className="flex items-center justify-end gap-2">
                      {suspended
                        ? <button onClick={() => reactivate(t)} className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold hover:bg-emerald-500/20">فعال‌سازی</button>
                        : <button onClick={() => suspend(t)} className="text-xs px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 flex items-center gap-1"><Power size={11} />تعلیق</button>
                      }
                      <Link to={`/platform/tenants/${t.id}`}
                        className="text-xs px-3 py-1.5 rounded-xl bg-violet-500/10 text-violet-300 font-bold hover:bg-violet-500/20 flex items-center gap-1">جزئیات<ChevronLeft size={11} /></Link>
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

export default TenantsAdmin;
