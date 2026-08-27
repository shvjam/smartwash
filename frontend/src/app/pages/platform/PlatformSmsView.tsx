import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, FileText, Gauge, KeyRound, Link2, Lock,
  MessageSquare, Plus, Radio, RefreshCw, Send, ShieldCheck, Trash2, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  platformSmsApi,
  type PlatformSmsTemplateDto, type SmsUsageRecordDto, type SmsProviderSettingsDto,
  type SmsDeskStatsDto, type TenantSmsQuotaDto, type TenantSmsAssignmentDto,
  type SmsTemplateCategory, type SmsUsageStatus,
} from '../../api';
import { Card, PageHeader, EmptyState, ErrorState, SkeletonRows } from '../../components/app/PageHeader';
import { useCan } from '../../lib/rbac';

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
/** مبالغ در API به ریال است و در رابط کاربری به تومان نمایش داده می‌شود. */
const money = (rials: number) => `${fa(Math.round(rials / 10))} تومان`;
const dt = (iso: string) =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

const CATEGORIES: { value: SmsTemplateCategory; label: string }[] = [
  { value: 0, label: 'تراکنشی' },
  { value: 1, label: 'یادآوری' },
  { value: 2, label: 'کمپین' },
  { value: 3, label: 'صورتحساب' },
];
const catLabel = (c: SmsTemplateCategory) => CATEGORIES.find(x => x.value === c)?.label ?? '—';

const STATUSES: { value: SmsUsageStatus; label: string; cls: string }[] = [
  { value: 0, label: 'در صف', cls: 'bg-gray-100 text-gray-600' },
  { value: 1, label: 'ارسال موفق', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 2, label: 'ناموفق', cls: 'bg-rose-100 text-rose-700' },
  { value: 3, label: 'صورتحساب‌شده', cls: 'bg-indigo-100 text-indigo-700' },
];

type Tab = 'connection' | 'templates' | 'usage' | 'quotas';
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'connection', label: 'اتصال تامین‌کننده', icon: Link2 },
  { key: 'templates', label: 'قالب‌های مرکزی', icon: FileText },
  { key: 'usage', label: 'دفتر ارسال', icon: Activity },
  { key: 'quotas', label: 'سهمیهٔ کارواش‌ها', icon: Gauge },
];

export const PlatformSmsView = () => {
  const canManageProvider = useCan('platform.sms.provider');
  const canWrite = useCan('platform.sms.write');

  const [tab, setTab] = useState<Tab>(canManageProvider ? 'connection' : 'templates');
  const [stats, setStats] = useState<SmsDeskStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try { setStats(await platformSmsApi.stats()); setError(null); }
    catch (e: any) { setError(e?.message ?? 'دریافت آمار سرویس پیامک ناموفق بود.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="mx-auto max-w-7xl pb-10">
      <PageHeader
        title="سرویس پیامک پلتفرم"
        subtitle="اتصال تامین‌کننده، قالب‌های مرکزی، دفتر ارسال و سهمیهٔ کارواش‌ها — همه در اختیار پلتفرم"
        actions={
          <button
            onClick={loadStats}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />بازخوانی
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={loadStats} />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-28 animate-pulse bg-gray-100"><span /></Card>)
        ) : (
          <>
            <Metric icon={MessageSquare} label="ارسال موفق" value={fa(stats.sentUnits)} hint="واحد پیامک در ۳۰ روز گذشته" />
            <Metric icon={AlertTriangle} label="ارسال ناموفق" value={fa(stats.failedUnits)} hint="ثبت‌شده اما بدون هزینه" />
            <Metric icon={Wallet} label="مبلغ قابل صورتحساب" value={money(stats.billableAmountRials)} hint="فقط مازاد بر سهمیه" />
            <Metric icon={Radio} label="قالب فعال" value={fa(stats.activeTemplates)} hint={`${fa(stats.tenantAvailableTemplates)} قالب در اختیار کارواش‌ها`} />
          </>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.filter(t => t.key !== 'connection' || canManageProvider).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
              tab === t.key ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <t.icon size={16} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'connection' && canManageProvider && <ConnectionPanel />}
      {tab === 'templates' && <TemplatesPanel canWrite={canWrite} onMutated={loadStats} />}
      {tab === 'usage' && <UsagePanel />}
      {tab === 'quotas' && <QuotasPanel canWrite={canWrite} />}
    </div>
  );
};

// ---------------- اتصال تامین‌کننده (فقط مدیر ارشد) ----------------

const ConnectionPanel = () => {
  const [settings, setSettings] = useState<SmsProviderSettingsDto | null>(null);
  const [form, setForm] = useState({ provider: 'sms.ir', baseUrl: 'https://api.sms.ir/v1/', apiKey: '', lineNumber: '', isEnabled: false });
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const apply = (s: SmsProviderSettingsDto) => {
    setSettings(s);
    setForm({ provider: s.provider, baseUrl: s.baseUrl, apiKey: '', lineNumber: s.lineNumber ?? '', isEnabled: s.isEnabled });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { apply(await platformSmsApi.settings()); }
    catch (e: any) { toast.error(e?.message ?? 'دریافت تنظیمات ناموفق بود'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<SmsProviderSettingsDto>, ok: string) => {
    setBusy(true);
    try { apply(await fn()); toast.success(ok); }
    catch (e: any) { toast.error(e?.message ?? 'عملیات ناموفق بود'); }
    finally { setBusy(false); }
  };

  if (loading) return <Card><SkeletonRows rows={4} /></Card>;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <Card>
        <h3 className="mb-1 flex items-center gap-2 text-base font-extrabold">
          <KeyRound size={18} className="text-red-600" />اتصال تامین‌کننده
        </h3>
        <p className="mb-5 text-xs leading-5 text-gray-500">
          کلید API هرگز از سرور بازگردانده نمی‌شود. برای حفظ کلید فعلی، فیلد را خالی بگذارید.
        </p>

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={e => {
            e.preventDefault();
            run(() => platformSmsApi.updateSettings({
              provider: form.provider.trim(),
              baseUrl: form.baseUrl.trim(),
              apiKey: form.apiKey.trim() ? form.apiKey.trim() : null,
              lineNumber: form.lineNumber.trim() ? form.lineNumber.trim() : null,
              isEnabled: form.isEnabled,
            }), 'تنظیمات اتصال ذخیره شد');
          }}
        >
          <Field label="تامین‌کننده" value={form.provider} onChange={provider => setForm({ ...form, provider })} />
          <Field label="آدرس سرویس" value={form.baseUrl} onChange={baseUrl => setForm({ ...form, baseUrl })} ltr />
          <Field
            label={settings?.hasApiKey ? `کلید API (فعلی: ${settings.apiKeyMask ?? '••••'})` : 'کلید API'}
            value={form.apiKey}
            onChange={apiKey => setForm({ ...form, apiKey })}
            required={false}
            ltr
            placeholder={settings?.hasApiKey ? 'برای تغییر، کلید جدید را وارد کنید' : 'کلید API را وارد کنید'}
          />
          <Field label="خط ارسال" value={form.lineNumber} onChange={lineNumber => setForm({ ...form, lineNumber })} required={false} ltr />

          <label className="md:col-span-2 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-3 text-sm font-bold text-gray-700">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={e => setForm({ ...form, isEnabled: e.target.checked })}
              className="size-4 accent-red-600"
            />
            سرویس پیامک فعال باشد
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button disabled={busy} className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white disabled:opacity-50">
              ذخیره تنظیمات
            </button>
            {settings?.hasApiKey && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => platformSmsApi.clearApiKey(), 'کلید API حذف شد')}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={15} />حذف کلید
              </button>
            )}
          </div>
        </form>
      </Card>

      <div className="space-y-5">
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-extrabold">
            <Send size={18} className="text-red-600" />ارسال آزمایشی
          </h3>
          <p className="mb-4 text-xs leading-5 text-gray-500">
            ارسال آزمایشی به هیچ کارواشی تعلق نمی‌گیرد و در دفتر مصرف ثبت و صورتحساب نمی‌شود.
          </p>
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              run(() => platformSmsApi.sendTest(testTo.trim()), 'ارسال آزمایشی انجام شد');
            }}
          >
            <input
              required
              dir="ltr"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              placeholder="09123456789"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            />
            <button disabled={busy} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              ارسال
            </button>
          </form>

          {settings?.lastTestedAtUtc && (
            <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-3 text-xs leading-5 ${
              settings.lastTestSucceeded ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}>
              {settings.lastTestSucceeded ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
              <span>
                آخرین آزمون: {dt(settings.lastTestedAtUtc)}
                {settings.lastTestMessage ? ` — ${settings.lastTestMessage}` : ''}
              </span>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-extrabold">
            <ShieldCheck size={18} className="text-red-600" />قاعدهٔ حاکمیت سرویس
          </h3>
          <ul className="space-y-3 text-sm leading-6 text-gray-600">
            <li>کلید API، خط ارسال و آدرس سرویس تنها در همین صفحه و توسط مدیر ارشد پلتفرم تنظیم می‌شود.</li>
            <li>کارواش فقط قالب‌های مجازش را می‌بیند و به تنظیمات اتصال دسترسی ندارد.</li>
            <li>هر تلاش ارسال — موفق یا ناموفق — به‌عنوان رویداد قابل ممیزی ثبت می‌شود.</li>
            <li>تنها ارسال‌های موفقِ مازاد بر سهمیه، با نرخ لحظهٔ ارسال، به فاکتور می‌روند.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

// ---------------- قالب‌های مرکزی ----------------

const emptyTemplate = { code: '', displayName: '', providerTemplateId: '', category: 0 as SmsTemplateCategory, parameters: '', isTenantAvailable: true, isActive: true };

const TemplatesPanel = ({ canWrite, onMutated }: { canWrite: boolean; onMutated: () => void }) => {
  const [items, setItems] = useState<PlatformSmsTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlatformSmsTemplateDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyTemplate);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await platformSmsApi.templates()); }
    catch (e: any) { toast.error(e?.message ?? 'دریافت قالب‌ها ناموفق بود'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyTemplate); setCreating(true); };
  const openEdit = (t: PlatformSmsTemplateDto) => {
    setEditing(t);
    setCreating(true);
    setForm({
      code: t.code, displayName: t.displayName, providerTemplateId: String(t.providerTemplateId),
      category: t.category, parameters: t.parameters.join(', '),
      isTenantAvailable: t.isTenantAvailable, isActive: t.isActive,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parameters = form.parameters.split(',').map(x => x.trim()).filter(Boolean);
    const providerTemplateId = Number(form.providerTemplateId);
    setBusy(true);
    try {
      if (editing) {
        await platformSmsApi.updateTemplate(editing.id, {
          displayName: form.displayName.trim(), providerTemplateId, category: form.category,
          parameters, isTenantAvailable: form.isTenantAvailable, isActive: form.isActive,
        });
        toast.success('قالب به‌روزرسانی شد');
      } else {
        await platformSmsApi.createTemplate({
          code: form.code.trim(), displayName: form.displayName.trim(), providerTemplateId,
          category: form.category, parameters, isTenantAvailable: form.isTenantAvailable,
        });
        toast.success('قالب جدید ثبت شد');
      }
      setCreating(false);
      setEditing(null);
      await load();
      onMutated();
    } catch (e: any) {
      toast.error(e?.message ?? 'ذخیره قالب ناموفق بود');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      {canWrite && (
        <div className="flex justify-end">
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white">
            <Plus size={16} />قالب جدید
          </button>
        </div>
      )}

      {creating && canWrite && (
        <Card>
          <h3 className="mb-4 text-base font-extrabold">{editing ? `ویرایش «${editing.displayName}»` : 'قالب جدید'}</h3>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <Field label="کد داخلی" value={form.code} onChange={code => setForm({ ...form, code })} ltr disabled={!!editing} />
            <Field label="نام نمایشی" value={form.displayName} onChange={displayName => setForm({ ...form, displayName })} />
            <Field label="شناسه قالب در تامین‌کننده" value={form.providerTemplateId} onChange={providerTemplateId => setForm({ ...form, providerTemplateId })} ltr />
            <label>
              <span className="mb-1 block text-xs font-bold text-gray-600">دسته‌بندی</span>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: Number(e.target.value) as SmsTemplateCategory })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <Field label="متغیرها (جدا با کاما)" value={form.parameters} onChange={parameters => setForm({ ...form, parameters })} required={false} ltr />
            <div className="flex flex-col justify-end gap-2 text-sm font-bold text-gray-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isTenantAvailable} onChange={e => setForm({ ...form, isTenantAvailable: e.target.checked })} className="size-4 accent-red-600" />
                در اختیار کارواش‌ها باشد
              </label>
              {editing && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="size-4 accent-red-600" />
                  فعال
                </label>
              )}
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button disabled={busy} className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white disabled:opacity-50">ذخیره قالب</button>
              <button type="button" onClick={() => { setCreating(false); setEditing(null); }} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-600">
                انصراف
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 font-extrabold">
          <Radio size={18} className="text-red-600" />قالب‌های مرکزی
        </div>
        {loading ? <div className="p-5"><SkeletonRows rows={5} /></div>
          : items.length === 0 ? <EmptyState icon={MessageSquare} title="هنوز قالبی ثبت نشده" hint="قالب‌ها تنها توسط مدیر پلتفرم تعریف می‌شوند." />
          : (
            <div className="divide-y divide-gray-100">
              {items.map(t => (
                <div key={t.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-sm">{t.displayName}</b>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">{catLabel(t.category)}</span>
                      {!t.isTenantAvailable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          <Lock size={10} />فقط پلتفرم
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500" dir="ltr">{t.code} · #{t.providerTemplateId}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {fa(t.assignedTenantCount)} کارواش فعال · {fa(t.sentUnitsThisMonth)} واحد ارسال این ماه
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${t.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                    {canWrite && (
                      <button onClick={() => openEdit(t)} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
                        ویرایش
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
};

// ---------------- دفتر ارسال ----------------

const UsagePanel = () => {
  const [rows, setRows] = useState<SmsUsageRecordDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SmsUsageStatus | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformSmsApi.usage({
        status: status === '' ? undefined : status,
        search: search.trim() || undefined,
        page, pageSize: 25,
      });
      setRows(res.items); setTotal(res.totalCount);
    } catch (e: any) { toast.error(e?.message ?? 'دریافت دفتر ارسال ناموفق بود'); }
    finally { setLoading(false); }
  }, [status, search, page]);
  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2 font-extrabold"><Activity size={18} className="text-red-600" />دفتر ارسال</div>
        <div className="ms-auto flex flex-wrap gap-2">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="شماره گیرنده یا کارواش…"
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={e => { setStatus(e.target.value === '' ? '' : Number(e.target.value) as SmsUsageStatus); setPage(1); }}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            <option value="">همهٔ وضعیت‌ها</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="p-5"><SkeletonRows rows={6} /></div>
        : rows.length === 0 ? <EmptyState icon={MessageSquare} title="ارسالی ثبت نشده" hint="با تغییر فیلترها دوباره تلاش کنید." />
        : (
          <div className="divide-y divide-gray-100">
            {rows.map(r => {
              const st = STATUSES.find(s => s.value === r.status);
              return (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-sm">{r.tenantName ?? '—'}</b>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st?.cls}`}>{st?.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500" dir="ltr">
                      {r.recipient} · {r.templateCode ?? r.purpose}
                    </p>
                    {r.error && <p className="mt-1 text-xs text-rose-600">{r.error}</p>}
                  </div>
                  <div className="text-end text-xs text-gray-500">
                    <div className="font-bold text-gray-800">{fa(r.units)} واحد</div>
                    <div className="mt-1">{r.billableAmountRials > 0 ? money(r.billableAmountRials) : 'بدون هزینه'}</div>
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
  );
};

// ---------------- سهمیهٔ کارواش‌ها ----------------

const QuotasPanel = ({ canWrite }: { canWrite: boolean }) => {
  const [rows, setRows] = useState<TenantSmsQuotaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTenant, setOpenTenant] = useState<TenantSmsQuotaDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await platformSmsApi.quotas()); }
    catch (e: any) { toast.error(e?.message ?? 'دریافت سهمیه‌ها ناموفق بود'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.85fr]">
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 font-extrabold">
          <Gauge size={18} className="text-red-600" />سهمیهٔ دورهٔ جاری
        </div>
        {loading ? <div className="p-5"><SkeletonRows rows={5} /></div>
          : rows.length === 0 ? <EmptyState icon={Gauge} title="اشتراک فعالی یافت نشد" hint="سهمیه از پلن اشتراک فعال هر کارواش خوانده می‌شود." />
          : (
            <div className="divide-y divide-gray-100">
              {rows.map(q => {
                const pct = q.includedUnits > 0 ? Math.min(100, Math.round((q.usedUnits / q.includedUnits) * 100)) : 100;
                return (
                  <button
                    key={q.tenantId}
                    onClick={() => setOpenTenant(q)}
                    className={`w-full p-4 text-start transition hover:bg-gray-50 ${openTenant?.tenantId === q.tenantId ? 'bg-gray-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <b className="text-sm">{q.tenantName}</b>
                      <span className="text-xs text-gray-500">
                        {fa(q.usedUnits)} / {q.includedUnits > 0 ? fa(q.includedUnits) : '۰'} واحد
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full ${q.overageUnits > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {fa(q.activeTemplateCount)} از {fa(q.templateLimit)} قالب فعال
                      {q.overageUnits > 0 && ` · مازاد: ${fa(q.overageUnits)} واحد (${money(q.overageAmountRials)})`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
      </Card>

      {openTenant
        ? <TenantAssignments tenant={openTenant} canWrite={canWrite} onMutated={load} />
        : <Card><EmptyState icon={FileText} title="کارواشی انتخاب نشده" hint="برای مدیریت قالب‌های مجاز، یک کارواش را انتخاب کنید." /></Card>}
    </div>
  );
};

const TenantAssignments = ({ tenant, canWrite, onMutated }: { tenant: TenantSmsQuotaDto; canWrite: boolean; onMutated: () => void }) => {
  const [rows, setRows] = useState<TenantSmsAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await platformSmsApi.tenantTemplates(tenant.tenantId)); }
    catch (e: any) { toast.error(e?.message ?? 'دریافت قالب‌های کارواش ناموفق بود'); }
    finally { setLoading(false); }
  }, [tenant.tenantId]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (templateId: string, enabled: boolean) => {
    setBusy(templateId);
    try {
      await platformSmsApi.setTenantTemplate(tenant.tenantId, templateId, enabled);
      await load();
      onMutated();
      toast.success(enabled ? 'قالب برای این کارواش فعال شد' : 'قالب غیرفعال شد');
    } catch (e: any) { toast.error(e?.message ?? 'عملیات ناموفق بود'); }
    finally { setBusy(null); }
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="font-extrabold">قالب‌های «{tenant.tenantName}»</div>
        <p className="mt-1 text-xs text-gray-500">
          سقف پلن: {fa(tenant.templateLimit)} قالب · نرخ مازاد هر پیامک:{' '}
          {tenant.overageUnitPriceRials > 0 ? money(tenant.overageUnitPriceRials) : 'تعریف نشده'}
        </p>
      </div>
      {loading ? <div className="p-5"><SkeletonRows rows={4} /></div>
        : rows.length === 0 ? <EmptyState icon={FileText} title="قالبی در دسترس نیست" hint="ابتدا قالب‌ها را در اختیار کارواش‌ها قرار دهید." />
        : (
          <div className="divide-y divide-gray-100">
            {rows.map(a => (
              <div key={a.templateId} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <b className="text-sm">{a.displayName}</b>
                  <p className="mt-1 text-xs text-gray-500" dir="ltr">{a.code}</p>
                  <p className="mt-1 text-xs text-gray-500">{fa(a.sentUnitsThisPeriod)} واحد در این دوره</p>
                </div>
                {canWrite ? (
                  <button
                    disabled={busy === a.templateId || !a.isTenantAvailable}
                    onClick={() => toggle(a.templateId, !a.isEnabled)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-40 ${
                      a.isEnabled ? 'border border-rose-200 text-rose-600 hover:bg-rose-50' : 'bg-gray-900 text-white'
                    }`}
                  >
                    {a.isEnabled ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                ) : (
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${a.isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {a.isEnabled ? 'فعال' : 'غیرفعال'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
    </Card>
  );
};

// ---------------- primitives ----------------

const Metric = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) => (
  <Card className="border-0 bg-gray-900 text-white">
    <Icon size={18} className="mb-4 text-red-300" />
    <div className="text-2xl font-black">{value}</div>
    <div className="mt-1 text-sm font-bold">{label}</div>
    <div className="mt-1 text-[11px] text-gray-400">{hint}</div>
  </Card>
);

const Field = ({ label, value, onChange, required = true, ltr = false, disabled = false, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; ltr?: boolean; disabled?: boolean; placeholder?: string;
}) => (
  <label>
    <span className="mb-1 block text-xs font-bold text-gray-600">{label}</span>
    <input
      required={required}
      disabled={disabled}
      dir={ltr ? 'ltr' : undefined}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm disabled:opacity-60"
    />
  </label>
);

export default PlatformSmsView;
