import React, { useEffect, useMemo, useState } from 'react';
import { useCarWash } from '../store';
import { reportsApi, type DashboardDto } from '../api';
import { PunctualityTab } from './reports/PunctualityTab';
import { WorkerScorecards } from './reports/WorkerScorecards';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { motion } from 'motion/react';
import {
  CheckCircle, Wallet, Users, DollarSign, Award,
  Calendar, BarChart3, PieChart as PieIcon, UserCheck, Crown, ArrowUp, ArrowDown, Timer, ClipboardList
} from 'lucide-react';
import { clsx } from 'clsx';
import { PageHeader, Card, StatCard } from '../components/app/PageHeader';

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];
// Approximate Gregorian month -> Persian month label
const MONTH_LABELS = ['دی', 'بهمن', 'اسفند', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر'];

const PIE_COLORS = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

type Tab = 'overview' | 'workers' | 'scorecards' | 'punctuality' | 'customers' | 'monthly' | 'services';

export const ReportsView = () => {
  const { orders, workers, services, customers, getOrderTotals, branchId } = useCarWash();
  const [tab, setTab] = useState<Tab>('overview');
  const [rangeMonths, setRangeMonths] = useState(9);
  // داده‌های دقیق از API (فقط برای tab=overview)
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  useEffect(() => {
    reportsApi.dashboard(branchId ?? undefined).then(setDashboard).catch(() => {});
  }, [branchId]);

  // fallback: اگر API هنوز لود نشده، از store استفاده می‌کنیم
  const ORDERS_CACHE_LIMIT = 100;
  const isCacheLimited = orders.filter(o => o.status === 'completed').length >= ORDERS_CACHE_LIMIT;

  // The punctuality report is computed server-side, so the page's range selector is
  // translated into the from/to dates that endpoint expects.
  const apiRange = useMemo(() => {
    const from = new Date();
    from.setMonth(from.getMonth() - rangeMonths);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { fromDate: iso(from), toDate: iso(new Date()) };
  }, [rangeMonths]);

  const completedOrders = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - rangeMonths);
    return orders.filter(o => o.status === 'completed' && new Date(o.createdAt) >= cutoff);
  }, [orders, rangeMonths]);

  // Aggregations
  const agg = useMemo(() => {
    const totals = { revenue: 0, tips: 0, discounts: 0, freeValue: 0, orders: 0, services: 0 };
    const byWorker: Record<string, { revenue: number; tips: number; orders: Set<string>; services: number }> = {};
    const byCustomer: Record<string, { revenue: number; orders: number; services: number }> = {};
    const byService: Record<string, { count: number; revenue: number }> = {};
    const byMonth: Record<string, { revenue: number; orders: number; tips: number }> = {};

    for (const o of completedOrders) {
      const t = getOrderTotals(o);
      totals.revenue += t.total - t.tips; // revenue without tips
      totals.tips += t.tips;
      totals.discounts += t.discount;
      totals.freeValue += t.freeDiscount;
      totals.orders += 1;
      totals.services += o.lineItems.length;

      const monthKey = new Date(o.createdAt).toISOString().slice(0, 7);
      if (!byMonth[monthKey]) byMonth[monthKey] = { revenue: 0, orders: 0, tips: 0 };
      byMonth[monthKey].revenue += t.total - t.tips;
      byMonth[monthKey].tips += t.tips;
      byMonth[monthKey].orders += 1;

      if (o.customerId) {
        if (!byCustomer[o.customerId]) byCustomer[o.customerId] = { revenue: 0, orders: 0, services: 0 };
        byCustomer[o.customerId].revenue += t.total;
        byCustomer[o.customerId].orders += 1;
        byCustomer[o.customerId].services += o.lineItems.length;
      }

      for (const li of o.lineItems) {
        if (!byService[li.serviceId]) byService[li.serviceId] = { count: 0, revenue: 0 };
        byService[li.serviceId].count += 1;
        if (!li.isFree) byService[li.serviceId].revenue += li.price;

        if (li.workerId) {
          if (!byWorker[li.workerId]) byWorker[li.workerId] = { revenue: 0, tips: 0, orders: new Set(), services: 0 };
          if (!li.isFree) byWorker[li.workerId].revenue += li.price;
          byWorker[li.workerId].tips += li.tipAmount;
          byWorker[li.workerId].orders.add(o.id);
          byWorker[li.workerId].services += 1;
        }
      }
    }

    return { totals, byWorker, byCustomer, byService, byMonth };
  }, [completedOrders, getOrderTotals]);

  const monthlySeries = useMemo(() => {
    const keys = Object.keys(agg.byMonth).sort();
    return keys.map(k => {
      const [y, m] = k.split('-');
      const idx = parseInt(m, 10) - 1;
      return {
        key: k,
        name: MONTH_LABELS[idx],
        درآمد: Math.round(agg.byMonth[k].revenue / 1000000 * 10) / 10,
        انعام: Math.round(agg.byMonth[k].tips / 1000000 * 10) / 10,
        سفارش: agg.byMonth[k].orders,
      };
    });
  }, [agg.byMonth]);

  const workerSeries = useMemo(() => {
    return workers.map(w => {
      const a = agg.byWorker[w.id] ?? { revenue: 0, tips: 0, orders: new Set(), services: 0 };
      return {
        ...w,
        revenue: a.revenue,
        tips: a.tips,
        orders: a.orders.size,
        services: a.services,
        avgPerOrder: a.orders.size > 0 ? Math.round(a.revenue / a.orders.size) : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [workers, agg.byWorker]);

  const customerSeries = useMemo(() => {
    return customers.map(c => ({
      ...c,
      monthRevenue: agg.byCustomer[c.id]?.revenue ?? 0,
      monthOrders: agg.byCustomer[c.id]?.orders ?? 0,
    })).sort((a, b) => b.monthRevenue - a.monthRevenue);
  }, [customers, agg.byCustomer]);

  const serviceSeries = useMemo(() => {
    return services.map(s => ({
      name: s.name,
      count: agg.byService[s.id]?.count ?? 0,
      revenue: agg.byService[s.id]?.revenue ?? 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [services, agg.byService]);

  const lastMonthDelta = useMemo(() => {
    if (monthlySeries.length < 2) return 0;
    const last = monthlySeries[monthlySeries.length - 1].درآمد;
    const prev = monthlySeries[monthlySeries.length - 2].درآمد;
    if (prev === 0) return 100;
    return Math.round(((last - prev) / prev) * 100);
  }, [monthlySeries]);

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6">
      <PageHeader
        title="گزارشات و تحلیل"
        subtitle="تحلیل عملکرد مالی، پرسنل، مشتریان و خدمات"
        actions={
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
            {[3, 6, 9, 12].map(m => (
              <button
                key={m}
                onClick={() => setRangeMonths(m)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  rangeMonths === m ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
                )}
              >{m} ماه</button>
            ))}
          </div>
        }
      />

      {isCacheLimited && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <BarChart3 size={14} className="flex-shrink-0" />
          <span>این گزارش بر اساس آخرین ۱۰۰ سفارش حافظه محاسبه شده — ممکن است ناقص باشد. برای گزارش کامل از <a href="/app/orders" className="font-bold underline">صفحه سفارش‌ها</a> استفاده کنید.</span>
        </div>
      )}

      {/* KPI cards — از API (دقیق) یا store (cache) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          accent="emerald"
          label="درآمد امروز"
          value={`${(dashboard?.todayRevenueRials ?? 0).toLocaleString('fa-IR')} ﷼`}
          hint={`${dashboard?.todayOrders ?? 0} سفارش امروز`}
        />
        <StatCard
          accent="sky"
          label="درآمد این ماه"
          value={`${(dashboard?.monthRevenueRials ?? agg.totals.revenue).toLocaleString('fa-IR')} ﷼`}
          hint={`${dashboard?.monthOrders ?? agg.totals.orders} سفارش`}
        />
        <StatCard
          accent="red"
          label="هزینه این ماه"
          value={`${(dashboard?.monthExpensesRials ?? 0).toLocaleString('fa-IR')} ﷼`}
          hint="هزینه‌های ثبت‌شده"
        />
        <StatCard
          accent="amber"
          label="سود خالص ماه"
          value={`${(dashboard?.monthNetRials ?? 0).toLocaleString('fa-IR')} ﷼`}
          hint="درآمد منهای هزینه"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
        {([
          { key: 'overview' as Tab, label: 'مرور کلی', icon: BarChart3 },
          { key: 'monthly' as Tab, label: 'ماهانه', icon: Calendar },
          { key: 'workers' as Tab, label: 'پرسنل', icon: UserCheck },
          { key: 'scorecards' as Tab, label: 'کارنامه پرسنل', icon: ClipboardList },
          { key: 'punctuality' as Tab, label: 'دقت زمان‌بندی', icon: Timer },
          { key: 'customers' as Tab, label: 'مشتریان', icon: Users },
          { key: 'services' as Tab, label: 'خدمات', icon: PieIcon },
        ]).map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'flex-1 min-w-[90px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all',
                active ? 'bg-red-500 text-white shadow-md shadow-red-500/30' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="روند درآمد ماهانه" subtitle="میلیون ﷼" className="lg:col-span-2">
            <div className="h-56 sm:h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySeries}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="درآمد" stroke="#dc2626" strokeWidth={2.5} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="ترکیب خدمات" subtitle="بر اساس درآمد">
            <div className="h-56 sm:h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceSeries.filter(s => s.revenue > 0)}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {serviceSeries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Number(v).toLocaleString('fa-IR')} ﷼`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="برترین پرسنل" subtitle="بر اساس درآمدزایی" className="lg:col-span-2">
            <div className="space-y-2">
              {workerSeries.slice(0, 5).map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="relative">
                    <img src={w.avatar} className="w-11 h-11 rounded-2xl object-cover" alt="" />
                    {i === 0 && <Crown size={14} className="absolute -top-1 -right-1 text-yellow-500 fill-yellow-400 drop-shadow" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{w.name}</div>
                    <div className="text-[11px] text-gray-500">{w.orders} سفارش • {w.services} خدمت</div>
                  </div>
                  <div className="text-left">
                    <div className="font-mono font-extrabold text-gray-900 text-sm">{w.revenue.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-gray-500">﷼</span></div>
                    {w.tips > 0 && <div className="text-[10px] text-blue-600 font-mono">+{w.tips.toLocaleString('fa-IR')} انعام</div>}
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="برترین مشتریان">
            <div className="space-y-2">
              {customerSeries.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-xs truncate">{c.name}</div>
                      <div className="text-[10px] text-gray-500">{c.monthOrders} سفارش</div>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold text-gray-900">{(c.monthRevenue / 1000).toFixed(0)}ک</div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {tab === 'monthly' && (
        <div className="space-y-4">
          <ChartCard title="مقایسه درآمد و انعام به تفکیک ماه" subtitle="میلیون ﷼">
            <div className="h-64 sm:h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="درآمد" fill="#dc2626" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="انعام" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="تعداد سفارش‌ها در ماه">
            <div className="h-52 sm:h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="سفارش" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="جدول جزئیات ماهانه">
            <Table head={['ماه', 'سفارش', 'درآمد', 'انعام', 'میانگین هر سفارش']}>
              {monthlySeries.slice().reverse().map(m => (
                <tr key={m.key} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 px-3 font-bold text-gray-900">{m.name}</td>
                  <td className="py-2.5 px-3 text-gray-700">{m.سفارش}</td>
                  <td className="py-2.5 px-3 font-mono text-gray-900">{(m.درآمد * 1000000).toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 font-mono text-blue-600">{(m.انعام * 1000000).toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 font-mono text-gray-600">{m.سفارش > 0 ? Math.round(m.درآمد * 1000000 / m.سفارش).toLocaleString('fa-IR') : '—'}</td>
                </tr>
              ))}
            </Table>
          </ChartCard>
        </div>
      )}

      {tab === 'scorecards' && (
        <WorkerScorecards fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'punctuality' && (
        <PunctualityTab fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'workers' && (
        <div className="space-y-4">
          <ChartCard title="درآمد پرسنل" subtitle="میلیون ﷼">
            <div className="h-56 sm:h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerSeries.map(w => ({ name: w.name, درآمد: w.revenue / 1000000, انعام: w.tips / 1000000 }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 11 }} width={70} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="درآمد" fill="#dc2626" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="انعام" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="جدول جامع پرسنل">
            <Table head={['پرسنل', 'سفارش', 'خدمات', 'درآمد', 'انعام', 'میانگین/سفارش']}>
              {workerSeries.map((w, i) => (
                <tr key={w.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      {i === 0 && <Crown size={14} className="text-yellow-500" />}
                      <img src={w.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                      <div>
                        <div className="font-bold text-xs">{w.name}</div>
                        <div className="text-[10px] text-gray-500">{w.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-gray-700">{w.orders}</td>
                  <td className="py-2.5 px-3 text-gray-700">{w.services}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{w.revenue.toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 font-mono text-blue-600">{w.tips.toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 font-mono text-gray-600">{w.avgPerOrder.toLocaleString('fa-IR')}</td>
                </tr>
              ))}
            </Table>
          </ChartCard>
        </div>
      )}

      {tab === 'customers' && (
        <ChartCard title="جدول جامع مشتریان">
          <Table head={['مشتری', 'پلاک', 'مراجعات', 'مجموع خرید', 'این بازه', 'وفاداری']}>
            {customerSeries.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white flex items-center justify-center text-xs font-bold">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        {c.name}
                        {c.isLoyal && <Crown size={11} className="text-yellow-500" />}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">{c.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-gray-600">{c.plate}</td>
                <td className="py-2.5 px-3 text-gray-700">{c.totalVisits}</td>
                <td className="py-2.5 px-3 font-mono text-gray-900 font-bold">{c.totalSpent.toLocaleString('fa-IR')}</td>
                <td className="py-2.5 px-3 font-mono text-emerald-600">{c.monthRevenue.toLocaleString('fa-IR')}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className={clsx('w-2 h-2 rounded-full',
                        i < (c.totalVisits % 3) ? 'bg-yellow-400' : 'bg-gray-200')} />
                    ))}
                    <span className="text-[10px] text-gray-500 mr-1">{c.freeServicesUsed}/{c.freeServicesEarned}</span>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </ChartCard>
      )}

      {tab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="پرفروش‌ترین خدمات">
            <div className="h-56 sm:h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceSeries.map(s => ({ name: s.name, درآمد: s.revenue / 1000000 }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 10 }} width={70} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="درآمد" fill="#dc2626" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="جدول خدمات">
            <Table head={['خدمت', 'تعداد', 'درآمد']}>
              {serviceSeries.map(s => (
                <tr key={s.name} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 px-3 font-bold text-gray-900 text-xs">{s.name}</td>
                  <td className="py-2.5 px-3 text-gray-700">{s.count}</td>
                  <td className="py-2.5 px-3 font-mono font-bold">{s.revenue.toLocaleString('fa-IR')}</td>
                </tr>
              ))}
            </Table>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px -6px rgba(0,0,0,0.15)', fontFamily: 'Vazirmatn', fontSize: 12 };

const ChartCard = ({ title, subtitle, children, className = '' }: any) => (
  <Card className={className}>
    <div className="mb-4">
      <h3 className="font-bold text-gray-900">{title}</h3>
      {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </Card>
);

const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => (
  <div className="overflow-x-auto -mx-2">
    <table className="w-full text-right text-xs" dir="rtl">
      <thead>
        <tr className="bg-gray-50">
          {head.map(h => <th key={h} className="py-2.5 px-3 text-[11px] font-bold text-gray-500 whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export default ReportsView;
