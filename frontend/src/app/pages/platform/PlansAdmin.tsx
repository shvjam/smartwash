import React, { useEffect, useState } from 'react';
import { Plus, Power, X, Pencil, Trash2 } from 'lucide-react';
import { platformPlansApi, PlanDto, PlanFeatureDto, PlanBillingModel, ApiException } from '../../api';
import { toToman, toRials, parseToman, tomanLabel } from '../../lib/money';
import { clsx } from 'clsx';

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

type Editing =
  | { mode: 'create' }
  | { mode: 'edit'; plan: PlanDto };

type FormState = {
  code: string;
  displayName: string;
  description: string;
  billingModel: PlanBillingModel;
  setupFeeRials: string;
  monthlyPriceRials: string;
  yearlyPriceRials: string;
  perCarPriceRials: string;
  sortOrder: number;
  isPublic: boolean;
  includedSmsPerMonth: string;
  includedSmsTemplateCount: string;
  smsOverageUnitPriceRials: string;
  features: PlanFeatureDto[];
};

const emptyForm = (): FormState => ({
  code: '', displayName: '', description: '',
  billingModel: PlanBillingModel.Subscription,
  setupFeeRials: '', monthlyPriceRials: '', yearlyPriceRials: '', perCarPriceRials: '',
  sortOrder: 1, isPublic: true,
  includedSmsPerMonth: '0', includedSmsTemplateCount: '0', smsOverageUnitPriceRials: '0',
  features: [],
});

const fromPlan = (p: PlanDto): FormState => ({
  code: p.code, displayName: p.displayName, description: p.description ?? '',
  billingModel: p.billingModel,
  // The money fields hold what the operator types, in tomans; rials exist only on the wire.
  setupFeeRials: String(toToman(p.setupFeeRials)), monthlyPriceRials: String(toToman(p.monthlyPriceRials)),
  yearlyPriceRials: String(toToman(p.yearlyPriceRials)), perCarPriceRials: String(toToman(p.perCarPriceRials)),
  sortOrder: p.sortOrder, isPublic: p.isPublic,
  includedSmsPerMonth: String(p.includedSmsPerMonth ?? 0),
  includedSmsTemplateCount: String(p.includedSmsTemplateCount ?? 0),
  smsOverageUnitPriceRials: String(toToman(p.smsOverageUnitPriceRials ?? 0)),
  features: p.features.map(f => ({ key: f.key, value: f.value })),
});

/*
  These keys are read verbatim by the API, so a label that is right and a key that is wrong
  produces a plan whose limit is simply never enforced — nothing fails, the ceiling just is
  not there. Two of them were wrong: the server reads limit.branches and limit.vehicles,
  while this list offered max_branches and max_vehicles, so every plan built on this screen
  had unlimited branches and unlimited vehicles per customer whatever the operator typed.
*/
const FEATURE_PRESETS: Array<{ key: string; label: string; example: string }> = [
  { key: 'max_bays', label: 'حداکثر جایگاه', example: '5' },
  { key: 'max_users', label: 'حداکثر کاربر', example: '10' },
  { key: 'limit.branches', label: 'حداکثر شعبه', example: '3' },
  { key: 'limit.vehicles', label: 'حداکثر خودرو برای هر مشتری', example: '10' },
  { key: 'reservations', label: 'رزرو آنلاین', example: 'true' },
  { key: 'sms', label: 'پیامک', example: 'true' },
  { key: 'loyalty', label: 'وفاداری', example: 'true' },
  { key: 'campaigns', label: 'کمپین‌ها', example: 'true' },
  { key: 'wallet', label: 'کیف پول', example: 'true' },
  { key: 'branding', label: 'برندینگ سفارشی', example: 'true' },
];

export const PlansAdmin = () => {
  const [list, setList] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    try { setList(await platformPlansApi.list()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const openCreate = () => { setEditing({ mode: 'create' }); setForm(emptyForm()); setErr(null); };
  const openEdit = (p: PlanDto) => { setEditing({ mode: 'edit', plan: p }); setForm(fromPlan(p)); setErr(null); };
  const close = () => { setEditing(null); setErr(null); };

  const addFeatureRow = () => setForm(f => ({ ...f, features: [...f.features, { key: '', value: '' }] }));
  const setFeature = (idx: number, patch: Partial<PlanFeatureDto>) =>
    setForm(f => ({ ...f, features: f.features.map((x, i) => i === idx ? { ...x, ...patch } : x) }));
  const removeFeature = (idx: number) =>
    setForm(f => ({ ...f, features: f.features.filter((_, i) => i !== idx) }));
  const addPreset = (preset: typeof FEATURE_PRESETS[number]) => {
    setForm(f => f.features.some(x => x.key === preset.key)
      ? f
      : { ...f, features: [...f.features, { key: preset.key, value: preset.example }] });
  };

  const submit = async () => {
    if (!editing) return;
    setErr(null); setBusy(true);
    try {
      const features = form.features
        .map(f => ({ key: f.key.trim(), value: f.value.trim() }))
        .filter(f => f.key);
      const numeric = {
        setupFeeRials: toRials(parseToman(form.setupFeeRials)),
        monthlyPriceRials: toRials(parseToman(form.monthlyPriceRials)),
        yearlyPriceRials: toRials(parseToman(form.yearlyPriceRials)),
        perCarPriceRials: toRials(parseToman(form.perCarPriceRials)),
        // سهمیه‌ی پیامک همیشه فرستاده می‌شود؛ خالی‌گذاشتنِ آن یعنی صفر، و صفر یعنی
        // هیچ پیامکی از این پلن ارسال نمی‌شود.
        includedSmsPerMonth: Number(form.includedSmsPerMonth) || 0,
        includedSmsTemplateCount: Number(form.includedSmsTemplateCount) || 0,
        smsOverageUnitPriceRials: toRials(parseToman(form.smsOverageUnitPriceRials)),
      };
      if (editing.mode === 'create') {
        await platformPlansApi.create({
          code: form.code.trim().toLowerCase(),
          displayName: form.displayName.trim(),
          description: form.description.trim() || null,
          billingModel: form.billingModel,
          ...numeric,
          sortOrder: form.sortOrder, isPublic: form.isPublic,
          features,
        });
      } else {
        await platformPlansApi.update(editing.plan.id, {
          displayName: form.displayName.trim(),
          description: form.description.trim() || null,
          ...numeric,
          sortOrder: form.sortOrder, isPublic: form.isPublic,
          features,
        });
      }
      close(); reload();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ذخیره پلن');
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-1">پلن‌ها</h1>
          <p className="text-gray-400 text-sm">قیمت‌گذاری و امکانات پلن‌های موجود</p>
        </div>
        <button onClick={openCreate}
          className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-1.5">
          <Plus size={16} />پلن جدید
        </button>
      </header>

      {loading ? <div className="text-center text-gray-500 py-10">در حال بارگذاری…</div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(p => (
            <div key={p.id} className="bg-gray-900 border border-white/5 rounded-3xl p-6 hover:border-violet-500/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-1 rounded" dir="ltr">{p.code}</div>
                <div className="flex gap-1.5">
                  {!p.isActive && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">غیرفعال</span>}
                  {!p.isPublic && <span className="text-[10px] font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">پنهان</span>}
                </div>
              </div>
              <div className="font-extrabold text-white text-lg mb-1">{p.displayName}</div>
              <div className="text-xs text-gray-500 leading-6 mb-4 min-h-[3em] line-clamp-2">{p.description || '—'}</div>
              <div className="space-y-1.5 mb-4 text-sm">
                <Row label="ماهانه" value={tomanLabel(p.monthlyPriceRials)} />
                <Row label="سالانه" value={tomanLabel(p.yearlyPriceRials)} />
                {p.setupFeeRials > 0 && <Row label="راه‌اندازی" value={tomanLabel(p.setupFeeRials)} />}
                <Row label="ویژگی‌ها" value={`${p.features.length} مورد`} />
              </div>
              {p.features.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {p.features.slice(0, 6).map(f => (
                    <span key={f.key} className="text-[10px] font-mono bg-white/5 text-gray-300 px-1.5 py-0.5 rounded">{f.key}={f.value}</span>
                  ))}
                  {p.features.length > 6 && <span className="text-[10px] text-gray-500">+{p.features.length - 6}</span>}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => openEdit(p)}
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 font-bold text-violet-300 flex items-center justify-center gap-1.5">
                  <Pencil size={12} />ویرایش
                </button>
                <button onClick={() => platformPlansApi.setActive(p.id, !p.isActive).then(reload)}
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-gray-300 flex items-center justify-center gap-1.5">
                  <Power size={12} />{p.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={close}>
          <div onClick={e => e.stopPropagation()} className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-3xl my-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-extrabold text-white">{editing.mode === 'create' ? 'پلن جدید' : `ویرایش پلن: ${editing.plan.displayName}`}</h3>
              <button onClick={close} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300"><X size={16} /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="کد یکتا" value={form.code} onChange={v => setForm({ ...form, code: v })} dir="ltr" disabled={editing.mode === 'edit'} />
              <Input label="نام نمایشی" value={form.displayName} onChange={v => setForm({ ...form, displayName: v })} />
              <Input label="توضیحات" value={form.description} onChange={v => setForm({ ...form, description: v })} className="sm:col-span-2" />
              <Input label="هزینه راه‌اندازی (تومان)" type="number" value={form.setupFeeRials} onChange={v => setForm({ ...form, setupFeeRials: v })} />
              <Input label="ماهانه (تومان)" type="number" value={form.monthlyPriceRials} onChange={v => setForm({ ...form, monthlyPriceRials: v })} />
              <Input label="سالانه (تومان)" type="number" value={form.yearlyPriceRials} onChange={v => setForm({ ...form, yearlyPriceRials: v })} />
              <Input label="به ازای هر خودرو (تومان)" type="number" value={form.perCarPriceRials} onChange={v => setForm({ ...form, perCarPriceRials: v })} />
              <Input label="ترتیب نمایش" type="number" value={String(form.sortOrder)} onChange={v => setForm({ ...form, sortOrder: Number(v) || 0 })} />

              {/* سهمیه‌ی پیامک: سرور پیش از هر ارسال همین را می‌خواند. اگر صفر بماند،
                  هیچ پیامکی برای مستاجرانِ این پلن ارسال نمی‌شود. */}
              <Input label="پیامک شامل در ماه" type="number" value={form.includedSmsPerMonth}
                onChange={v => setForm({ ...form, includedSmsPerMonth: v })} />
              <Input label="تعداد قالب پیامک" type="number" value={form.includedSmsTemplateCount}
                onChange={v => setForm({ ...form, includedSmsTemplateCount: v })} />
              <Input label="نرخ هر پیامک مازاد (تومان)" type="number" value={form.smsOverageUnitPriceRials}
                onChange={v => setForm({ ...form, smsOverageUnitPriceRials: v })} className="sm:col-span-2" />
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isPublic} onChange={e => setForm({ ...form, isPublic: e.target.checked })} className="accent-violet-600 w-4 h-4" />
                <span className="text-sm text-gray-300">نمایش در صفحه قیمت‌گذاری عمومی</span>
              </label>
            </div>

            <div className="mt-6 border-t border-white/5 pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-white">ویژگی‌ها (Features)</div>
                <button onClick={addFeatureRow}
                  className="text-xs px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 font-bold flex items-center gap-1">
                  <Plus size={12} />سطر جدید
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {FEATURE_PRESETS.map(p => {
                  const exists = form.features.some(x => x.key === p.key);
                  return (
                    <button key={p.key} type="button" onClick={() => addPreset(p)} disabled={exists}
                      className={clsx('text-[11px] px-2.5 py-1 rounded-lg font-medium',
                        exists ? 'bg-white/5 text-gray-500' : 'bg-white/10 text-gray-300 hover:bg-violet-500/20 hover:text-violet-200')}>
                      + {p.label}
                    </button>
                  );
                })}
              </div>

              {form.features.length === 0 ? (
                <div className="text-xs text-gray-500 bg-black/30 rounded-xl p-4 text-center">ویژگی‌ای تعریف نشده. از preset‌های بالا یا «سطر جدید» استفاده کنید.</div>
              ) : (
                <div className="space-y-2">
                  {form.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={f.key} onChange={e => setFeature(i, { key: e.target.value })}
                        placeholder="key"
                        dir="ltr"
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
                      <input value={f.value} onChange={e => setFeature(i, { value: e.target.value })}
                        placeholder="value"
                        dir="ltr"
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
                      <button onClick={() => removeFeature(i)}
                        className="p-2 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {err && <div className="mt-4 bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-2xl">{err}</div>}

            <div className="mt-6 flex gap-2">
              <button onClick={submit} disabled={busy}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-2xl text-sm font-bold">
                {busy ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
              <button onClick={close}
                className="px-5 py-2.5 rounded-2xl border border-white/10 text-sm text-gray-300">انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Input = ({ label, value, onChange, type = 'text', dir, className = '', disabled = false }:
  { label: string; value: string; onChange: (v: string) => void; type?: string; dir?: 'ltr'; className?: string; disabled?: boolean }) => (
  <label className={`block ${className}`}>
    <span className="text-xs text-gray-400 mb-2 block">{label}</span>
    <input type={type} value={value} dir={dir} disabled={disabled} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-950 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 disabled:opacity-60" />
  </label>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-gray-500">{label}</span><span className="text-gray-200 font-bold">{value}</span>
  </div>
);

export default PlansAdmin;
