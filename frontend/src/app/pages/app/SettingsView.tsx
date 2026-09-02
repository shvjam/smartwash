import React, { useEffect, useState } from 'react';
import { Save, Palette, Award, Receipt, MessageSquare, CalendarClock, Check, Lock, Upload, X, Loader2 } from 'lucide-react';
import { settingsApi, filesApi, TenantSettingsDto, ApiException } from '../../api';
import { resolveUploadUrl } from '../../api/adapters';
import { PageHeader, Card } from '../../components/app/PageHeader';
import { clsx } from 'clsx';
import { useFeatures } from '../../lib/features';

type Tab = 'branding' | 'loyalty' | 'receipt' | 'sms' | 'reservation';

// Tab definitions with optional feature key. If feature is set and not enabled,
// the tab is shown as locked with an upgrade prompt.
const tabDefs: { v: Tab; l: string; i: any; feature?: string }[] = [
  { v: 'branding',    l: 'برندینگ',       i: Palette,       feature: 'branding' },
  { v: 'loyalty',     l: 'وفاداری',        i: Award,         feature: 'loyalty' },
  { v: 'receipt',     l: 'فاکتور',         i: Receipt },
  { v: 'sms',         l: 'پیامک',          i: MessageSquare, feature: 'sms' },
  { v: 'reservation', l: 'رزرواسیون',      i: CalendarClock, feature: 'reservations' },
];

const UpgradeNotice = ({ feature }: { feature: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
      <Lock size={28} className="text-gray-400" />
    </div>
    <h3 className="font-bold text-gray-700 text-lg">این قابلیت در پلن شما فعال نیست</h3>
    <p className="text-sm text-gray-500 max-w-sm leading-6">
      برای دسترسی به تنظیمات <strong>{feature}</strong>، پلن اشتراک خود را ارتقا دهید.
    </p>
    <a href="/app/billing"
      className="mt-2 bg-gradient-to-br from-red-500 to-red-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-red-500/30 hover:from-red-600 hover:to-red-800 transition-all">
      مشاهده پلن‌ها و ارتقا
    </a>
  </div>
);

export const SettingsView = () => {
  const { has: hasFeature, loading: featuresLoading } = useFeatures();
  const [tab, setTab] = useState<Tab>('receipt');
  const [data, setData] = useState<TenantSettingsDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Set initial tab to first available (non-locked) tab
  useEffect(() => {
    if (featuresLoading) return;
    const firstAvailable = tabDefs.find(t => !t.feature || hasFeature(t.feature));
    if (firstAvailable) setTab(firstAvailable.v);
  }, [featuresLoading]);

  useEffect(() => { settingsApi.get().then(setData).catch(() => { }); }, []);
  if (!data) return <div className="text-center text-gray-400 py-10">در حال بارگذاری…</div>;

  const set = <K extends keyof TenantSettingsDto>(k: K, v: TenantSettingsDto[K]) => setData(d => d ? { ...d, [k]: v } : d);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (tab === 'branding')    await settingsApi.branding({ logoUrl: data.logoUrl ?? null, primaryColor: data.primaryColor ?? null, tagline: data.tagline ?? null, theme: data.theme });
      else if (tab === 'loyalty')    await settingsApi.loyalty({ enabled: data.loyaltyEnabled, pointsPerRial: data.loyaltyPointsPerRial, pointValue: data.loyaltyPointValueRials, expiryDays: data.loyaltyExpiryDays });
      else if (tab === 'receipt')    await settingsApi.receipt({ header: data.receiptHeader, footer: data.receiptFooter ?? null, invoicePrefix: data.invoicePrefix ?? null });
      else if (tab === 'sms')        await settingsApi.sms({ enabled: data.smsEnabled });
      else if (tab === 'reservation') await settingsApi.reservation({ enabled: data.reservationEnabled, leadMinutes: data.reservationLeadMinutes, maxAdvanceDays: data.reservationMaxAdvanceDays });
      setToast('تنظیمات با موفقیت ذخیره شد');
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ذخیره تنظیمات');
    } finally { setBusy(false); }
  };

  const currentTabDef = tabDefs.find(t => t.v === tab)!;
  const currentTabLocked = !!(currentTabDef.feature && !hasFeature(currentTabDef.feature));

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader title="تنظیمات" subtitle="پیکربندی برندینگ، باشگاه مشتریان، فاکتور، پیامک و رزرواسیون" />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabDefs.map(t => {
          const Icon = t.i;
          const locked = !!(t.feature && !hasFeature(t.feature));
          return (
            <button key={t.v} onClick={() => setTab(t.v)}
              title={locked ? 'این قابلیت در پلن شما فعال نیست' : undefined}
              className={clsx(
                'px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 flex-shrink-0 transition-all',
                tab === t.v
                  ? locked
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-900 text-white'
                  : locked
                    ? 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-300',
              )}>
              <Icon size={16} />
              {t.l}
              {locked && <Lock size={12} className="opacity-60" />}
            </button>
          );
        })}
      </div>

      <Card>
        {toast && <div className="mb-4 bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-2xl flex items-center gap-2"><Check size={16} />{toast}</div>}
        {err && <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{err}</div>}

        {/* Show upgrade notice if tab is locked */}
        {currentTabLocked ? (
          <UpgradeNotice feature={currentTabDef.l} />
        ) : (
          <>
            {tab === 'branding' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <LogoField value={data.logoUrl ?? null} onChange={v => set('logoUrl', v)} />
                <Input label="رنگ اصلی (مثلاً #ef4444)" value={data.primaryColor ?? ''} onChange={v => set('primaryColor', v || null)} dir="ltr" />
                <Input label="شعار برند" value={data.tagline ?? ''} onChange={v => set('tagline', v || null)} className="sm:col-span-2" />
                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium text-gray-600 mb-2 block">قالب نمایشی</span>
                  <div className="flex gap-2">
                    {['light', 'dark', 'auto'].map(t => (
                      <button key={t} onClick={() => set('theme', t)}
                        className={clsx('px-4 py-2 rounded-xl text-sm font-bold', data.theme === t ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600')}>
                        {t === 'light' ? 'روشن' : t === 'dark' ? 'تیره' : 'خودکار'}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
            )}

            {tab === 'loyalty' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <ToggleRow label="فعال‌سازی باشگاه وفاداری" value={data.loyaltyEnabled} onChange={v => set('loyaltyEnabled', v)} />
                <Input label="امتیاز به ازای هر ریال" type="number" value={String(data.loyaltyPointsPerRial)} onChange={v => set('loyaltyPointsPerRial', Number(v) || 0)} />
                <Input label="ارزش هر امتیاز (ریال)" type="number" value={String(data.loyaltyPointValueRials)} onChange={v => set('loyaltyPointValueRials', Number(v) || 0)} />
                <Input label="انقضای امتیاز (روز)" type="number" value={String(data.loyaltyExpiryDays)} onChange={v => set('loyaltyExpiryDays', Number(v) || 0)} />
              </div>
            )}

            {tab === 'receipt' && (
              <div className="space-y-4">
                <Input label="عنوان بالای فاکتور" value={data.receiptHeader} onChange={v => set('receiptHeader', v)} />
                <Input label="متن پایین فاکتور" value={data.receiptFooter ?? ''} onChange={v => set('receiptFooter', v || null)} />
                <Input label="پیشوند شماره فاکتور" value={data.invoicePrefix ?? ''} onChange={v => set('invoicePrefix', v || null)} dir="ltr" />
              </div>
            )}

            {tab === 'sms' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-xs text-emerald-800 leading-6">
                  <div className="font-bold mb-1">سرویس پیامک، متمرکز است</div>
                  سامانه‌ی ارسال، کلید API، خط ارسال و الگوهای پیامکی توسط مدیر ارشد پلتفرم تنظیم
                  و مدیریت می‌شوند. شما فقط می‌توانید ارسال پیامک را برای کارواش خود روشن یا خاموش
                  کنید. سهمیه‌ی ماهانه و نرخ مازاد بر اساس پلنِ شما محاسبه می‌شود و تنها
                  ارسال‌های موفق محاسبه می‌شوند.
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <ToggleRow label="فعال‌سازی ارسال پیامک" value={data.smsEnabled} onChange={v => set('smsEnabled', v)} />
                  <ReadOnlyRow label="خط ارسال (تنظیم‌شده توسط پلتفرم)" value={data.smsSenderNumber} />
                  <ReadOnlyRow label="سامانه پیامکی (تنظیم‌شده توسط پلتفرم)" value={data.smsProvider} />
                </div>
              </div>
            )}

            {tab === 'reservation' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <ToggleRow label="فعال‌سازی رزرواسیون" value={data.reservationEnabled} onChange={v => set('reservationEnabled', v)} />
                <Input label="حداقل زمان پیش‌رزرو (دقیقه)" type="number" value={String(data.reservationLeadMinutes)} onChange={v => set('reservationLeadMinutes', Number(v) || 0)} />
                <Input label="حداکثر روز پیش‌رزرو" type="number" value={String(data.reservationMaxAdvanceDays)} onChange={v => set('reservationMaxAdvanceDays', Number(v) || 0)} />
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-50">
              <button onClick={save} disabled={busy}
                className="bg-gradient-to-br from-red-500 to-red-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-red-500/30">
                <Save size={16} />ذخیره تغییرات
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

/**
 * Picks a logo file and stores the URL the upload returns.
 *
 * This was a plain text box asking for a URL, which meant the person had to host the image
 * somewhere themselves and paste a link — for a field whose whole purpose is "show me your
 * logo". The upload endpoint already existed.
 */
const LogoField = ({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const { url } = await filesApi.upload(file, 'branding');
      onChange(url);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'بارگذاری لوگو ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="block sm:col-span-2">
      <span className="text-xs font-medium text-gray-600 mb-2 block">لوگوی کارواش</span>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-red-200 bg-white p-3">
        <div className="size-14 overflow-hidden rounded-xl bg-red-50 flex items-center justify-center text-[10px] text-red-500 flex-shrink-0">
          {value ? <img src={resolveUploadUrl(value)} alt="لوگو" className="h-full w-full object-contain" /> : 'بدون لوگو'}
        </div>
        <div className="flex-1 min-w-0">
          <span className="cursor-pointer text-xs font-bold text-red-600 flex items-center gap-1.5">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {busy ? 'در حال بارگذاری…' : value ? 'انتخاب لوگوی دیگر' : 'انتخاب فایل لوگو'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              disabled={busy} onChange={e => pick(e.target.files?.[0])} />
          </span>
          <span className="mt-1 block text-[10px] text-gray-400">JPG، PNG یا WEBP تا ۵ مگابایت</span>
          {error && <span className="mt-1 block text-[10px] text-red-600">{error}</span>}
        </div>
        {value && !busy && (
          <button type="button" onClick={() => onChange(null)} title="حذف لوگو"
            className="text-gray-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors flex-shrink-0">
            <X size={15} />
          </button>
        )}
      </div>
    </label>
  );
};

const Input = ({ label, value, onChange, type = 'text', dir, className = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; dir?: 'ltr' | 'rtl'; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="text-xs font-medium text-gray-600 mb-2 block">{label}</span>
    <input type={type} value={value} dir={dir} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
  </label>
);

const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-2xl sm:col-span-2">
    <span className="text-sm font-medium">{label}</span>
    <button onClick={() => onChange(!value)}
      className={clsx('relative w-11 h-6 rounded-full transition-colors', value ? 'bg-emerald-500' : 'bg-gray-300')}>
      <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all', value ? 'right-0.5' : 'right-[22px]')} />
    </button>
  </div>
);

/** مقداری که پلتفرم تعیین کرده — نمایش داده می‌شود اما قابل ویرایش نیست. */
const ReadOnlyRow = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="bg-gray-50 border border-dashed border-gray-200 px-4 py-3 rounded-2xl">
    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
      <Lock className="w-3 h-3" />
      {label}
    </div>
    <div dir="ltr" className="text-sm font-mono text-gray-700 text-left">
      {value?.trim() ? value : '—'}
    </div>
  </div>
);

export default SettingsView;
