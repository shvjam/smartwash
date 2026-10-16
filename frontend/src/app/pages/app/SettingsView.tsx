import React, { useEffect, useState } from 'react';
import { Save, Palette, Award, Receipt, MessageSquare, CalendarClock, Check, Lock, Upload, X, Loader2 } from 'lucide-react';
import { settingsApi, filesApi, TenantSettingsDto, ApiException } from '../../api';
import { applyBrandColor, useBranding } from '../../lib/branding';
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
      className="mt-2 bg-gradient-to-br from-brand-500 to-brand-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-brand-500/30 hover:from-brand-600 hover:to-brand-800 transition-all">
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

  // Every hook is called before the loading state returns. Reading branding after that early
  // return meant React saw a different set of hooks once the settings arrived, which is the
  // kind of mismatch that makes a form lose what was typed into it.
  const { refresh: refreshBranding } = useBranding();

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
      if (tab === 'branding') refreshBranding();
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
                <ColorField value={data.primaryColor ?? null} onChange={v => set('primaryColor', v)} />
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
                className="bg-gradient-to-br from-brand-500 to-brand-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-brand-500/30">
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
/** Ready-made colours, so choosing one is a decision about taste rather than about hex codes. */
const PRESETS: Array<[hex: string, label: string]> = [
  ['#ef4444', 'قرمز'], ['#f97316', 'نارنجی'], ['#eab308', 'زرد'], ['#22c55e', 'سبز'],
  ['#14b8a6', 'فیروزه‌ای'], ['#3b82f6', 'آبی'], ['#6366f1', 'بنفش'], ['#ec4899', 'صورتی'],
  ['#64748b', 'خاکستری'],
];

/**
 * The panel's accent colour.
 *
 * The field used to be a text box captioned "for example #ef4444", which asked a carwash
 * owner to know what a hex code is. The swatches cover what almost everyone wants, the
 * native picker is there for a brand that has an exact colour to match, and the preview
 * shows the shades the app will actually build from it — the accent is spread across a
 * whole scale, not used at one strength, so a single dot would not tell the truth.
 */
const ColorField = ({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) => {
  const current = value?.trim() || null;
  const shades = [50, 100, 500, 600, 700, 900];
  const { primaryColor: saved } = useBranding();

  // Paint the picked colour across the panel while the field is open, so the choice is
  // judged against the real thing rather than a swatch. Leaving without saving puts the
  // stored colour back — the preview must not outlive the screen that offered it.
  useEffect(() => {
    applyBrandColor(current);
    return () => applyBrandColor(saved);
  }, [current, saved]);

  return (
    <label className="block sm:col-span-2">
      <span className="mb-2 block text-xs font-medium text-gray-600">رنگ اصلی برنامه</span>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(([hex, label]) => (
          <button
            key={hex}
            type="button"
            title={label}
            onClick={() => onChange(hex)}
            style={{ backgroundColor: hex }}
            className={clsx(
              'size-8 rounded-xl transition-transform hover:scale-110',
              current?.toLowerCase() === hex ? 'ring-2 ring-gray-900 ring-offset-2' : 'ring-1 ring-black/10',
            )}
          />
        ))}

        <span className="mx-1 h-6 w-px bg-gray-200" />

        <input
          type="color"
          value={current ?? '#ef4444'}
          onChange={e => onChange(e.target.value)}
          className="size-8 cursor-pointer rounded-xl border border-gray-200 bg-white p-0.5"
          title="انتخاب رنگ دلخواه"
        />

        {current && (
          <button type="button" onClick={() => onChange(null)}
            className="rounded-xl bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-100">
            بازگشت به پیش‌فرض
          </button>
        )}
      </div>

      {current && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex overflow-hidden rounded-xl ring-1 ring-black/5">
            {shades.map(s => (
              <span key={s} className="size-7" style={{ backgroundColor: `var(--color-brand-${s})` }} />
            ))}
          </div>
          <span className="font-mono text-[11px] text-gray-400" dir="ltr">{current}</span>
        </div>
      )}

      <p className="mt-2 text-[11px] leading-5 text-gray-500">
        این رنگ همین حالا روی دکمه‌ها، منو و فاکتور اعمال شده تا نتیجه را ببینید؛ تا وقتی ذخیره نکنید ماندگار نیست.
        رنگ پیام‌های خطا عمداً قرمز می‌ماند تا هشدارها دیده شوند.
      </p>
    </label>
  );
};

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
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand-200 bg-white p-3">
        <div className="size-14 overflow-hidden rounded-xl bg-brand-50 flex items-center justify-center text-[10px] text-brand-500 flex-shrink-0">
          {value ? <img src={resolveUploadUrl(value)} alt="لوگو" className="h-full w-full object-contain" /> : 'بدون لوگو'}
        </div>
        <div className="flex-1 min-w-0">
          <span className="cursor-pointer text-xs font-bold text-brand-600 flex items-center gap-1.5">
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
            className="text-gray-400 hover:text-brand-500 p-2 rounded-xl hover:bg-brand-50 transition-colors flex-shrink-0">
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
      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
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
