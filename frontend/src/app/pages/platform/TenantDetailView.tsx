import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowRight, Building2, CreditCard, Layers, Mail, Phone, Power, RefreshCw,
  ShieldCheck, ShieldOff, Calendar, Receipt, Users as UsersIcon, Car, Sparkles, ShoppingBag,
} from 'lucide-react';
import {
  platformTenantsApi, platformSubscriptionsApi, platformPlansApi,
  TenantDetailDto, TenantStatus, SubscriptionStatus, SubscriptionCycle, PlanDto,
} from '../../api';
import { clsx } from 'clsx';

// کلاس‌های Tailwind باید کاملِ ثابت باشند؛ ساختِ پویا مثل `bg-${c}-500/15` توسط کامپایلر شناسایی نمی‌شود.
const badge = {
  sky: 'bg-sky-500/15 text-sky-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-300',
  red: 'bg-red-500/15 text-red-300',
  gray: 'bg-gray-500/15 text-gray-300',
};

const tenantStatusMap: Record<TenantStatus, { l: string; c: string }> = {
  [TenantStatus.Trial]: { l: 'دوره آزمایشی', c: badge.sky },
  [TenantStatus.Active]: { l: 'فعال', c: badge.emerald },
  [TenantStatus.Grace]: { l: 'مهلت پرداخت', c: badge.amber },
  [TenantStatus.Suspended]: { l: 'تعلیق', c: badge.red },
  [TenantStatus.Cancelled]: { l: 'لغو شده', c: badge.gray },
  [TenantStatus.Expired]: { l: 'منقضی', c: badge.red },
  [TenantStatus.Archived]: { l: 'آرشیو', c: badge.gray },
};

const subStatusMap: Record<SubscriptionStatus, { l: string; c: string }> = {
  [SubscriptionStatus.PendingPayment]: { l: 'در انتظار پرداخت', c: badge.sky },
  [SubscriptionStatus.Active]: { l: 'فعال', c: badge.emerald },
  [SubscriptionStatus.PastDue]: { l: 'سررسید گذشته', c: badge.amber },
  [SubscriptionStatus.Cancelled]: { l: 'لغو شده', c: badge.gray },
  [SubscriptionStatus.Expired]: { l: 'منقضی', c: badge.red },
};

const invoiceStatusMap: Record<number, { l: string; c: string }> = {
  0: { l: 'باز', c: badge.amber },
  1: { l: 'پرداخت شده', c: badge.emerald },
  2: { l: 'سررسید گذشته', c: badge.red },
  3: { l: 'باطل', c: badge.gray },
};

const fmtMoney = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n / 10)) + ' تومان';
const fmtDate = (iso?: string | null) => iso ? new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) : '—';

const statPillColors: Record<string, string> = {
  violet: 'bg-violet-500/10 border-violet-500/20',
  sky: 'bg-sky-500/10 border-sky-500/20',
  amber: 'bg-amber-500/10 border-amber-500/20',
  emerald: 'bg-emerald-500/10 border-emerald-500/20',
  rose: 'bg-rose-500/10 border-rose-500/20',
  indigo: 'bg-indigo-500/10 border-indigo-500/20',
  teal: 'bg-teal-500/10 border-teal-500/20',
};
const StatPill = ({ icon: Icon, label, value, color = 'violet' }: { icon: any; label: string; value: number; color?: string }) => (
  <div className={clsx('border rounded-2xl p-4', statPillColors[color] ?? statPillColors.violet)}>
    <div className="flex items-center gap-2 mb-2 text-gray-400">
      <Icon size={16} /><span className="text-[11px]">{label}</span>
    </div>
    <div className="text-xl font-bold text-white">{new Intl.NumberFormat('fa-IR').format(value)}</div>
  </div>
);

export const TenantDetailView = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<TenantDetailDto | null>(null);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [planId, setPlanId] = useState<string>('');
  const [cycle, setCycle] = useState<SubscriptionCycle>(SubscriptionCycle.Monthly);
  const [activateNow, setActivateNow] = useState(true);

  const reload = async () => {
    if (!id) return;
    setLoading(true); setErr(null);
    try {
      const d = await platformTenantsApi.get(id);
      setData(d);
    } catch (e: any) {
      setErr(e?.message ?? 'خطا در بارگذاری');
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { platformPlansApi.list().then(r => setPlans(r ?? [])).catch(() => {}); }, []);

  const suspend = async () => {
    if (!data) return;
    const reason = prompt('علت تعلیق:');
    if (!reason) return;
    try { await platformSubscriptionsApi.suspendTenant(data.id, reason); await reload(); }
    catch (e: any) { alert(e?.message ?? 'خطا در تعلیق مستاجر'); }
  };
  const reactivate = async () => {
    if (!data) return;
    try { await platformSubscriptionsApi.reactivateTenant(data.id); await reload(); }
    catch (e: any) { alert(e?.message ?? 'خطا در فعال‌سازی مستاجر'); }
  };

  const assign = async () => {
    if (!data || !planId) return;
    setAssigning(true);
    try {
      await platformTenantsApi.assignPlan(data.id, { planId, cycle, activateImmediately: activateNow });
      setAssignOpen(false);
      reload();
    } catch (e: any) {
      alert(e?.message ?? 'خطا در تخصیص پلن');
    } finally { setAssigning(false); }
  };

  const totalPaid = useMemo(() => (data?.recentInvoices ?? []).filter(i => i.status === 1).reduce((s, i) => s + i.totalRials, 0), [data]);

  if (loading) return <div className="p-10 text-center text-gray-400">در حال بارگذاری...</div>;
  if (err) return <div className="p-10 text-center text-rose-300">{err}</div>;
  if (!data) return <div className="p-10 text-center text-gray-500">یافت نشد</div>;

  const ts = tenantStatusMap[data.status];
  const suspended = data.status === TenantStatus.Suspended;

  return (
    <div className="space-y-6 max-w-7xl">
      <button onClick={() => nav('/platform/tenants')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowRight size={16} /> بازگشت به لیست مستاجران
      </button>

      <div className="bg-gray-900 border border-white/5 rounded-3xl p-6 flex flex-wrap items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/20 text-violet-300 flex items-center justify-center">
          <Building2 size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{data.displayName}</h1>
            <span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-bold', ts.c)}>{ts.l}</span>
          </div>
          <div className="text-[12px] text-gray-400 flex items-center gap-3 flex-wrap" dir="ltr">
            <span>{data.slug}</span>
            <span className="text-gray-600">•</span>
            <span className="flex items-center gap-1"><Mail size={11} /> {data.ownerEmail}</span>
            {data.ownerPhone && <><span className="text-gray-600">•</span><span className="flex items-center gap-1"><Phone size={11} /> {data.ownerPhone}</span></>}
            <span className="text-gray-600">•</span>
            <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(data.createdAtUtc)}</span>
          </div>
          {data.suspendReason && (
            <div className="mt-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
              علت تعلیق: {data.suspendReason}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300"><RefreshCw size={16} /></button>
          <button onClick={() => setAssignOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold">
            <Layers size={14} /> تخصیص پلن
          </button>
          {suspended ? (
            <button onClick={reactivate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 text-sm font-bold">
              <ShieldCheck size={14} /> فعال‌سازی
            </button>
          ) : (
            <button onClick={suspend}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/25 text-sm font-bold">
              <ShieldOff size={14} /> تعلیق
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatPill icon={Building2} label="شعب" value={data.stats.branches} color="violet" />
        <StatPill icon={Car} label="جایگاه" value={data.stats.bays} color="sky" />
        <StatPill icon={UsersIcon} label="پرسنل" value={data.stats.workers} color="amber" />
        <StatPill icon={Sparkles} label="خدمات" value={data.stats.services} color="emerald" />
        <StatPill icon={UsersIcon} label="مشتری" value={data.stats.customers} color="rose" />
        <StatPill icon={ShoppingBag} label="سفارش" value={data.stats.orders} color="indigo" />
        <StatPill icon={UsersIcon} label="کاربر" value={data.stats.users} color="teal" />
      </div>

      <div className="bg-gray-900 border border-white/5 rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={18} className="text-violet-300" />
          <h2 className="text-lg font-bold text-white">پلن فعلی</h2>
        </div>
        {data.activePlanName ? (
          <div className="text-sm text-gray-300">
            پلن فعال: <span className="font-bold text-white">{data.activePlanName}</span>
            {data.trialEndsAtUtc && <span className="mr-3 text-amber-300">پایان دوره آزمایشی: {fmtDate(data.trialEndsAtUtc)}</span>}
          </div>
        ) : (
          <div className="text-sm text-gray-500">پلن فعالی تخصیص داده نشده است.</div>
        )}
      </div>

      <div className="bg-gray-900 border border-white/5 rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <Layers size={16} className="text-violet-300" />
          <h2 className="text-sm font-bold text-white">تاریخچه اشتراک‌ها</h2>
          <span className="text-[11px] text-gray-500">({data.subscriptions.length})</span>
        </div>
        {data.subscriptions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">اشتراکی ثبت نشده است.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-right text-[11px] text-gray-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">پلن</th>
                <th className="px-4 py-2.5 font-medium">دوره</th>
                <th className="px-4 py-2.5 font-medium">وضعیت</th>
                <th className="px-4 py-2.5 font-medium">شروع</th>
                <th className="px-4 py-2.5 font-medium">پایان دوره</th>
                <th className="px-4 py-2.5 font-medium">مبلغ</th>
                <th className="px-4 py-2.5 font-medium">تمدید خودکار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.subscriptions.map(s => {
                const sm = subStatusMap[s.status];
                return (
                  <tr key={s.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-bold text-white">{s.planName}</td>
                    <td className="px-4 py-3 text-gray-300">{s.cycle === SubscriptionCycle.Yearly ? 'سالانه' : 'ماهانه'}</td>
                    <td className="px-4 py-3"><span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold', sm.c)}>{sm.l}</span></td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(s.startsAtUtc)}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(s.currentPeriodEndUtc)}</td>
                    <td className="px-4 py-3 text-gray-200 text-xs">{fmtMoney(s.priceRials)}</td>
                    <td className="px-4 py-3 text-xs">{s.autoRenew ? <span className="text-emerald-300">بله</span> : <span className="text-gray-500">خیر</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-gray-900 border border-white/5 rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2 flex-wrap">
          <Receipt size={16} className="text-violet-300" />
          <h2 className="text-sm font-bold text-white">فاکتورهای اخیر</h2>
          <span className="text-[11px] text-gray-500">({data.recentInvoices.length})</span>
          <span className="mr-auto text-[11px] text-emerald-300">مجموع پرداختی: {fmtMoney(totalPaid)}</span>
        </div>
        {data.recentInvoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">فاکتوری ثبت نشده است.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-right text-[11px] text-gray-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">شماره</th>
                <th className="px-4 py-2.5 font-medium">وضعیت</th>
                <th className="px-4 py-2.5 font-medium">صدور</th>
                <th className="px-4 py-2.5 font-medium">سررسید</th>
                <th className="px-4 py-2.5 font-medium">پرداخت</th>
                <th className="px-4 py-2.5 font-medium">مبلغ کل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.recentInvoices.map(i => {
                const im = invoiceStatusMap[i.status] ?? { l: '—', c: badge.gray };
                return (
                  <tr key={i.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{i.number}</td>
                    <td className="px-4 py-3"><span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold', im.c)}>{im.l}</span></td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(i.issuedAtUtc)}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(i.dueAtUtc)}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(i.paidAtUtc)}</td>
                    <td className="px-4 py-3 text-gray-100 text-xs font-bold">{fmtMoney(i.totalRials)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {assignOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAssignOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-md">
            <h3 className="text-lg font-extrabold text-white mb-1">تخصیص پلن</h3>
            <p className="text-xs text-gray-400 mb-5">یک اشتراک جدید برای این مستاجر صادر می‌شود.</p>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">پلن</label>
                <select value={planId} onChange={e => setPlanId(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500">
                  <option value="">— انتخاب کنید —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">دوره صورتحساب</label>
                <div className="flex gap-2">
                  <button onClick={() => setCycle(SubscriptionCycle.Monthly)}
                    className={clsx('flex-1 px-3 py-2 rounded-xl text-sm', cycle === SubscriptionCycle.Monthly ? 'bg-violet-600 text-white font-bold' : 'bg-white/5 text-gray-300')}>ماهانه</button>
                  <button onClick={() => setCycle(SubscriptionCycle.Yearly)}
                    className={clsx('flex-1 px-3 py-2 rounded-xl text-sm', cycle === SubscriptionCycle.Yearly ? 'bg-violet-600 text-white font-bold' : 'bg-white/5 text-gray-300')}>سالانه</button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={activateNow} onChange={e => setActivateNow(e.target.checked)} className="accent-violet-500" />
                فعال‌سازی فوری (بدون نیاز به پرداخت)
              </label>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button onClick={assign} disabled={!planId || assigning}
                className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold">
                {assigning ? 'در حال ثبت...' : 'تخصیص'}
              </button>
              <button onClick={() => setAssignOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm">انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantDetailView;
