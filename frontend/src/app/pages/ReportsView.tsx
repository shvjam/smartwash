import React, { useEffect, useMemo, useState } from 'react';
import { useCarWash } from '../store';
import { reportsApi, type DashboardDto, type PeriodSummary } from '../api';
import { PunctualityTab } from './reports/PunctualityTab';
import { OrderArchive } from './reports/OrderArchive';
import { BayPerformanceTab, WaitingTab, StaffingTab, RevenueTab, ActivityLogTab } from './reports/OperationsTabs';
import { WorkerScorecards } from './reports/WorkerScorecards';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { motion } from 'motion/react';
import {
  CheckCircle, Wallet, Users, DollarSign, Award,
  Calendar, BarChart3, PieChart as PieIcon, UserCheck, Crown, ArrowUp, ArrowDown, Timer, ClipboardList, Archive, Gauge, Hourglass, Users2, ScrollText } from 'lucide-react';
import { clsx } from 'clsx';
import { PageHeader, Card, StatCard } from '../components/app/PageHeader';
import { WorkerAvatar } from '../components/WorkerAvatar';
import { tomanLabel, tomanNumber } from '../lib/money';
import { localIsoDate } from '../lib/dates';
import { jalaliMonth } from '../lib/persian';

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];
// Approximate Gregorian month -> Persian month label

const PIE_COLORS = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

type Tab = 'overview' | 'revenue' | 'archive' | 'bays' | 'waiting' | 'staffing'
  | 'workers' | 'scorecards' | 'punctuality' | 'activity' | 'customers' | 'monthly' | 'services';

export const ReportsView = () => {
  const { workers, services, branchId } = useCarWash();
  const [tab, setTab] = useState<Tab>('overview');
  const [rangeMonths, setRangeMonths] = useState(9);
  // داده‌های دقیق از API (فقط برای tab=overview)
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  useEffect(() => {
    reportsApi.dashboard(branchId ?? undefined).then(setDashboard).catch(() => {});
  }, [branchId]);

  // The selected range, as the dates the report endpoints expect.
  const apiRange = useMemo(() => {
    const from = new Date();
    from.setMonth(from.getMonth() - rangeMonths);
    const iso = (d: Date) => localIsoDate(d);
    return { fromDate: iso(from), toDate: iso(new Date()) };
  }, [rangeMonths]);

  /*
    Everything on the overview, monthly, worker, customer and service tabs comes from the
    server's period summary. These tabs used to be computed in the browser from the orders the
    panel had in memory — the two hundred most recent — so on a busy floor "the last nine
    months" meant the last few days, and nothing on the page said so.
  */
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSummaryError(null);
    reportsApi.periodSummary(apiRange.fromDate, apiRange.toDate, branchId ?? undefined)
      .then(r => { if (alive) setSummary(r); })
      .catch(e => { if (alive) setSummaryError(e?.message ?? 'دریافت گزارش انجام نشد'); });
    return () => { alive = false; };
  }, [apiRange.fromDate, apiRange.toDate, branchId]);

  const agg = useMemo(() => ({
    totals: { revenue: summary?.revenueRials ?? 0, orders: summary?.orders ?? 0 },
  }), [summary]);

  // Grouped by the Jalali month each day falls in, not by the Gregorian month renamed.
  const monthlySeries = useMemo(() => {
    const byMonth = new Map<string, { label: string; revenue: number; tips: number; orders: number }>();
    for (const d of summary?.days ?? []) {
      const m = jalaliMonth(d.date);
      const row = byMonth.get(m.key) ?? { label: m.label, revenue: 0, tips: 0, orders: 0 };
      row.revenue += d.revenueRials; row.tips += d.tipsRials; row.orders += d.orders;
      byMonth.set(m.key, row);
    }
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, m]) => ({
      key,
      name: m.label,
      درآمد: Math.round(m.revenue / 10_000_000 * 10) / 10,
      انعام: Math.round(m.tips / 10_000_000 * 10) / 10,
      سفارش: m.orders,
      // Exact figures for the table; the chart values above are rounded to a tenth of a million.
      revenueRials: m.revenue,
      tipsRials: m.tips,
    }));
  }, [summary]);

  const workerSeries = useMemo(() => {
    const byId = new Map((summary?.workers ?? []).map(w => [w.workerId, w]));
    return workers.map(w => {
      const a = byId.get(w.id);
      const orders = a?.orders ?? 0;
      return {
        ...w,
        revenue: a?.revenueRials ?? 0,
        tips: a?.tipsRials ?? 0,
        orders,
        services: a?.services ?? 0,
        avgPerOrder: orders > 0 ? Math.round((a?.revenueRials ?? 0) / orders) : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [workers, summary]);

  const customerSeries = useMemo(() => (summary?.customers ?? []).map(c => ({
    id: c.customerId,
    name: c.fullName,
    phone: c.phone,
    plate: c.plate ?? '',
    totalVisits: c.totalVisits,
    totalSpent: c.lifetimeSpendRials,
    isLoyal: c.totalVisits >= 10,
    monthRevenue: c.revenueRials,
    monthOrders: c.orders,
    freeServicesEarned: c.freeServicesEarned,
    freeServicesUsed: c.freeServicesUsed,
  })), [summary]);

  const serviceSeries = useMemo(() => {
    const sold = new Map((summary?.serviceRows ?? []).map(r => [r.serviceId, r]));
    const rows = services.map(s => ({ name: s.name, count: sold.get(s.id)?.count ?? 0, revenue: sold.get(s.id)?.revenueRials ?? 0 }));
    // A service sold in the period but since deleted from the menu still earned that money.
    for (const r of summary?.serviceRows ?? []) {
      if (!services.some(s => s.id === r.serviceId)) rows.push({ name: r.serviceName, count: r.count, revenue: r.revenueRials });
    }
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [services, summary]);

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

      {summaryError && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <BarChart3 size={14} className="flex-shrink-0" />
          <span>گزارش این بازه دریافت نشد: {summaryError}</span>
        </div>
      )}

      {/* KPI cards — از API (دقیق) یا store (cache) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          accent="emerald"
          label="درآمد امروز"
          value={`${tomanLabel(dashboard?.todayRevenueRials ?? 0)}`}
          hint={`${(dashboard?.todayOrders ?? 0).toLocaleString('fa-IR')} سفارش امروز`}
        />
        <StatCard
          accent="sky"
          label="درآمد این ماه"
          value={`${tomanLabel(dashboard?.monthRevenueRials ?? agg.totals.revenue)}`}
          hint={`${(dashboard?.monthOrders ?? agg.totals.orders).toLocaleString('fa-IR')} سفارش`}
        />
        <StatCard
          accent="red"
          label="هزینه این ماه"
          value={`${tomanLabel(dashboard?.monthExpensesRials ?? 0)}`}
          hint="هزینه‌های ثبت‌شده"
        />
        <StatCard
          accent="amber"
          label="سود خالص ماه"
          value={`${tomanLabel(dashboard?.monthNetRials ?? 0)}`}
          hint="درآمد منهای هزینه"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
        {([
          { key: 'overview' as Tab, label: 'مرور کلی', icon: BarChart3 },
          { key: 'revenue' as Tab, label: 'درآمد', icon: Wallet },
          { key: 'archive' as Tab, label: 'آرشیو سفارش‌ها', icon: Archive },
          { key: 'bays' as Tab, label: 'عملکرد جایگاه‌ها', icon: Gauge },
          { key: 'waiting' as Tab, label: 'انتظار و گلوگاه', icon: Hourglass },
          { key: 'staffing' as Tab, label: 'نیروی انسانی', icon: Users2 },
          { key: 'monthly' as Tab, label: 'ماهانه', icon: Calendar },
          { key: 'workers' as Tab, label: 'پرسنل', icon: UserCheck },
          { key: 'scorecards' as Tab, label: 'کارنامه پرسنل', icon: ClipboardList },
          { key: 'punctuality' as Tab, label: 'دقت زمان‌بندی', icon: Timer },
          { key: 'activity' as Tab, label: 'عملکرد کاربران', icon: ScrollText },
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
                active ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="روند درآمد ماهانه" subtitle="میلیون تومان" className="lg:col-span-2">
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => tomanLabel(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="برترین پرسنل" subtitle="بر اساس درآمدزایی" className="lg:col-span-2">
            <div className="space-y-2">
              {workerSeries.slice(0, 5).map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="relative">
                    <WorkerAvatar src={w.avatar} name={w.name} size={44} rounded="2xl" />
                    {i === 0 && <Crown size={14} className="absolute -top-1 -right-1 text-yellow-500 fill-yellow-400 drop-shadow" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{w.name}</div>
                    <div className="text-[11px] text-gray-500">{w.orders.toLocaleString('fa-IR')} سفارش • {w.services.toLocaleString('fa-IR')} خدمت</div>
                  </div>
                  <div className="text-left">
                    <div className="font-mono font-extrabold text-gray-900 text-sm">{tomanNumber(w.revenue)} <span className="text-[10px] font-normal text-gray-500">تومان</span></div>
                    {w.tips > 0 && <div className="text-[10px] text-blue-600 font-mono">+{tomanNumber(w.tips)} انعام</div>}
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
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-xs truncate">{c.name}</div>
                      <div className="text-[10px] text-gray-500">{c.monthOrders.toLocaleString('fa-IR')} سفارش</div>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold text-gray-900">{Math.round(c.monthRevenue / 10_000).toLocaleString('fa-IR')} هزار ت</div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {tab === 'monthly' && (
        <div className="space-y-4">
          <ChartCard title="مقایسه درآمد و انعام به تفکیک ماه" subtitle="میلیون تومان">
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
            <Table head={['ماه', 'سفارش', 'درآمد (تومان)', 'انعام (تومان)', 'میانگین هر سفارش']}>
              {monthlySeries.slice().reverse().map(m => (
                <tr key={m.key} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 px-3 font-bold text-gray-900">{m.name}</td>
                  <td className="py-2.5 px-3 text-gray-700">{m.سفارش.toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 font-mono text-gray-900">{tomanNumber(m.revenueRials)}</td>
                  <td className="py-2.5 px-3 font-mono text-blue-600">{tomanNumber(m.tipsRials)}</td>
                  <td className="py-2.5 px-3 font-mono text-gray-600">{m.سفارش > 0 ? tomanNumber(m.revenueRials / m.سفارش) : '—'}</td>
                </tr>
              ))}
            </Table>
          </ChartCard>
        </div>
      )}

      {tab === 'revenue' && (
        <RevenueTab fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'bays' && (
        <BayPerformanceTab fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'waiting' && (
        <WaitingTab fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'staffing' && (
        <StaffingTab fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'activity' && (
        <ActivityLogTab fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'archive' && (
        <OrderArchive fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'scorecards' && (
        <WorkerScorecards fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'punctuality' && (
        <PunctualityTab fromDate={apiRange.fromDate} toDate={apiRange.toDate} />
      )}

      {tab === 'workers' && (
        <div className="space-y-4">
          <ChartCard title="درآمد پرسنل" subtitle="میلیون تومان">
            <div className="h-56 sm:h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerSeries.map(w => ({ name: w.name, درآمد: w.revenue / 10_000_000, انعام: w.tips / 10_000_000 }))} layout="vertical">
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
            <Table head={['پرسنل', 'سفارش', 'خدمات', 'درآمد (تومان)', 'انعام (تومان)', 'میانگین/سفارش']}>
              {workerSeries.map((w, i) => (
                <tr key={w.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      {i === 0 && <Crown size={14} className="text-yellow-500" />}
                      <WorkerAvatar src={w.avatar} name={w.name} size={28} />
                      <div>
                        <div className="font-bold text-xs">{w.name}</div>
                        <div className="text-[10px] text-gray-500">{w.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-gray-700">{w.orders.toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 text-gray-700">{w.services.toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{tomanNumber(w.revenue)}</td>
                  <td className="py-2.5 px-3 font-mono text-blue-600">{tomanNumber(w.tips)}</td>
                  <td className="py-2.5 px-3 font-mono text-gray-600">{tomanNumber(w.avgPerOrder)}</td>
                </tr>
              ))}
            </Table>
          </ChartCard>
        </div>
      )}

      {tab === 'customers' && (
        <ChartCard title="جدول جامع مشتریان">
          <Table head={['مشتری', 'پلاک', 'مراجعات', 'مجموع خرید (تومان)', 'این بازه (تومان)', 'وفاداری']}>
            {customerSeries.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-xs font-bold">
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
                <td className="py-2.5 px-3 text-gray-700">{c.totalVisits.toLocaleString('fa-IR')}</td>
                <td className="py-2.5 px-3 font-mono text-gray-900 font-bold">{tomanNumber(c.totalSpent)}</td>
                <td className="py-2.5 px-3 font-mono text-emerald-600">{tomanNumber(c.monthRevenue)}</td>
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
                <BarChart data={serviceSeries.map(s => ({ name: s.name, درآمد: s.revenue / 10_000_000 }))} layout="vertical">
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
            <Table head={['خدمت', 'تعداد', 'درآمد (تومان)']}>
              {serviceSeries.map(s => (
                <tr key={s.name} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 px-3 font-bold text-gray-900 text-xs">{s.name}</td>
                  <td className="py-2.5 px-3 text-gray-700">{s.count.toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 font-mono font-bold">{tomanNumber(s.revenue)}</td>
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
