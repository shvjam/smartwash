import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, FileText, Gauge, Info, MessageSquare, RefreshCw, Wallet, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  tenantSmsApi,
  type MySmsSummaryDto, type MySmsTemplateDto, type MySmsUsageDto,
  type SmsTemplateCategory, type SmsUsageStatus,
} from '../../api';
import { Card, PageHeader, EmptyState, ErrorState, SkeletonRows } from '../../components/app/PageHeader';

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
/** مبالغ از API به ریال می‌آید و در رابط کاربری به تومان نمایش داده می‌شود. */
const money = (rials: number) => `${fa(Math.round(rials / 10))} تومان`;
const dt = (iso: string) =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
const d = (iso: string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(iso));

const CAT: Record<SmsTemplateCategory, string> = { 0: 'تراکنشی', 1: 'یادآوری', 2: 'کمپین', 3: 'صورتحساب' };
const STATUS: Record<SmsUsageStatus, { label: string; cls: string }> = {
  0: { label: 'در صف', cls: 'bg-gray-100 text-gray-600' },
  1: { label: 'ارسال موفق', cls: 'bg-emerald-100 text-emerald-700' },
  2: { label: 'ناموفق', cls: 'bg-rose-100 text-rose-700' },
  3: { label: 'صورتحساب‌شده', cls: 'bg-indigo-100 text-indigo-700' },
};

export const SmsView = () => {
  const [summary, setSummary] = useState<MySmsSummaryDto | null>(null);
  const [templates, setTemplates] = useState<MySmsTemplateDto[]>([]);
  const [usage, setUsage] = useState<MySmsUsageDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<SmsUsageStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, u] = await Promise.all([
        tenantSmsApi.summary(),
        tenantSmsApi.templates(),
        tenantSmsApi.usage({ status: statusFilter === '' ? undefined : statusFilter, page, pageSize: 20 }),
      ]);
      setSummary(s); setTemplates(t); setUsage(u.items); setTotal(u.totalCount); setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'دریافت اطلاعات پیامک ناموفق بود.');
    } finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (t: MySmsTemplateDto) => {
    setBusy(t.id);
    try {
      await tenantSmsApi.setTemplate(t.id, !t.isEnabled);
      await load();
      toast.success(t.isEnabled ? 'قالب غیرفعال شد' : 'قالب فعال شد');
    } catch (e: any) { toast.error(e?.message ?? 'تغییر وضعیت قالب ناموفق بود'); }
    finally { setBusy(null); }
  };

  const pages = Math.max(1, Math.ceil(total / 20));
  const pct = summary && summary.includedUnits > 0
    ? Math.min(100, Math.round((summary.usedUnits / summary.includedUnits) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <PageHeader
        title="پیامک"
        subtitle="سهمیهٔ دورهٔ جاری، قالب‌های مجاز و دفتر ارسال‌های کارواش شما"
        actions={
          <button onClick={load} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
            <RefreshCw size={16} />بازخوانی
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {summary && !summary.canSend && summary.blockReason && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          <AlertTriangle size={16} className="mt-1 shrink-0" />
          <span>{summary.blockReason}</span>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading && !summary ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-28 animate-pulse bg-gray-100"><span /></Card>)
        ) : summary ? (
          <>
            <Metric icon={Gauge} label="مصرف این دوره" value={`${fa(summary.usedUnits)} واحد`}
              hint={summary.includedUnits > 0 ? `از ${fa(summary.includedUnits)} واحد سهمیه` : 'پلن شما سهمیهٔ رایگان ندارد'} />
            <Metric icon={MessageSquare} label="مازاد بر سهمیه" value={`${fa(summary.overageUnits)} واحد`}
              hint={summary.overageUnitPriceRials > 0 ? `نرخ هر پیامک ${money(summary.overageUnitPriceRials)}` : 'نرخ مازاد در پلن تعریف نشده'} />
            <Metric icon={Wallet} label="هزینهٔ مازاد" value={money(summary.overageAmountRials)}
              hint="فقط ارسال‌های موفق محاسبه می‌شود" />
            <Metric icon={FileText} label="قالب‌های فعال" value={`${fa(summary.activeTemplateCount)} از ${fa(summary.templateLimit)}`}
              hint="سقف قالب‌ها از پلن اشتراک شما" />
          </>
        ) : null}
      </div>

      {summary && (
        <Card className="mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <b>دورهٔ جاری</b>
            <span className="text-xs text-gray-500">{d(summary.periodStartUtc)} — {d(summary.periodEndUtc)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className={`h-full ${summary.overageUnits > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            قالب‌ها، خط ارسال و اتصال سرویس پیامک توسط پلتفرم مدیریت می‌شود. تنها ارسال‌های موفقِ مازاد بر سهمیه در فاکتور پایان دوره محاسبه می‌شوند و ارسال‌های ناموفق هزینه‌ای ندارند
            {summary.failedUnitsThisPeriod > 0 && ` (${fa(summary.failedUnitsThisPeriod)} واحد ناموفق در این دوره).`}
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 font-extrabold">
            <FileText size={18} className="text-brand-600" />قالب‌های مجاز شما
          </div>
          {loading && templates.length === 0 ? <div className="p-5"><SkeletonRows rows={4} /></div>
            : templates.length === 0 ? <EmptyState icon={MessageSquare} title="قالبی در اختیار شما نیست" hint="برای دریافت قالب‌های پیامکی با پشتیبانی پلتفرم تماس بگیرید." />
            : (
              <div className="divide-y divide-gray-100">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <b className="text-sm">{t.displayName}</b>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">{CAT[t.category]}</span>
                      </div>
                      {t.parameters.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500" dir="ltr">{t.parameters.join(' · ')}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">{fa(t.sentUnitsThisPeriod)} واحد در این دوره</p>
                    </div>
                    <button
                      disabled={busy === t.id}
                      onClick={() => toggle(t)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-40 ${
                        t.isEnabled ? 'border border-rose-200 text-rose-600 hover:bg-rose-50' : 'bg-gray-900 text-white'
                      }`}
                    >
                      {t.isEnabled ? <><XCircle size={13} />غیرفعال</> : <><CheckCircle2 size={13} />فعال‌سازی</>}
                    </button>
                  </div>
                ))}
              </div>
            )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2 font-extrabold"><MessageSquare size={18} className="text-brand-600" />دفتر ارسال</div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value === '' ? '' : Number(e.target.value) as SmsUsageStatus); setPage(1); }}
              className="ms-auto rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
            >
              <option value="">همهٔ وضعیت‌ها</option>
              {(Object.keys(STATUS) as unknown as SmsUsageStatus[]).map(k => (
                <option key={k} value={k}>{STATUS[Number(k) as SmsUsageStatus].label}</option>
              ))}
            </select>
          </div>

          {loading && usage.length === 0 ? <div className="p-5"><SkeletonRows rows={5} /></div>
            : usage.length === 0 ? <EmptyState icon={MessageSquare} title="ارسالی ثبت نشده" hint="هر پیامک ارسالی کارواش شما اینجا ثبت می‌شود." />
            : (
              <div className="divide-y divide-gray-100">
                {usage.map(r => {
                  const st = STATUS[r.status];
                  return (
                    <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" dir="ltr">{r.recipient}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{r.templateCode ?? r.purpose} · {fa(r.units)} واحد</p>
                        {r.error && <p className="mt-1 text-xs text-rose-600">{r.error}</p>}
                      </div>
                      <div className="text-end text-xs text-gray-500">
                        <div className="font-bold text-gray-800">
                          {r.billableAmountRials > 0 ? money(r.billableAmountRials) : 'بدون هزینه'}
                        </div>
                        <div className="mt-1">{dt(r.occurredAtUtc)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl border border-gray-200 px-3 py-1.5 font-bold text-gray-600 disabled:opacity-40">قبلی</button>
              <span className="text-xs text-gray-500">صفحهٔ {fa(page)} از {fa(pages)}</span>
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-xl border border-gray-200 px-3 py-1.5 font-bold text-gray-600 disabled:opacity-40">بعدی</button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) => (
  <Card className="border-0 bg-gray-900 text-white">
    <Icon size={18} className="mb-4 text-brand-300" />
    <div className="text-xl font-black">{value}</div>
    <div className="mt-1 text-sm font-bold">{label}</div>
    <div className="mt-1 text-[11px] text-gray-400">{hint}</div>
  </Card>
);

export default SmsView;
