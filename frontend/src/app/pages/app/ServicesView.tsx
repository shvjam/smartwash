import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Plus, Pencil, Power, Loader2, X, Clock, Coins, Layers } from 'lucide-react';
import { BayType } from '../../api/types';
import { BAY_TYPE_LABEL } from '../../lib/orderStages';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';
import { servicesApi, ApiException } from '../../api';
import { ServiceCategory, type ServiceDto } from '../../api/types';

// منطبق با ServiceCategory: Main=0, Side=1, Detailing=2, Polish=3, Interior=4, Engine=5
const CATEGORY_LABEL: Record<number, string> = {
  [ServiceCategory.Main]: 'اصلی', [ServiceCategory.Side]: 'جانبی', [ServiceCategory.Detailing]: 'دیتیلینگ',
  [ServiceCategory.Polish]: 'پولیش', [ServiceCategory.Interior]: 'داخل خودرو', [ServiceCategory.Engine]: 'موتورشویی',
};
const CATEGORIES: ServiceCategory[] = [0, 1, 2, 3, 4, 5];

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const formatRials = (n: number) => toFa(Math.round(n / 10).toLocaleString('fa-IR'));

type FormState = {
  id: string | null;
  name: string;
  description: string;
  category: ServiceCategory;
  priceRials: number;
  durationMinutes: number;
  workerCommissionRate: number;
  requiredBayType: BayType | null;
};

const emptyForm = (): FormState => ({
  id: null, name: '', description: '', category: 0,
  priceRials: 0, durationMinutes: 30, workerCommissionRate: 0.1,
  requiredBayType: null,
});

export const ServicesView: React.FC = () => {
  const [items, setItems] = useState<ServiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<ServiceCategory | 'all'>('all');
  const [onlyActive, setOnlyActive] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    try {
      const list = await servicesApi.list(onlyActive);
      setItems([...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa')));
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری');
    } finally { setLoading(false); }
  };
  useEffect(() => { setLoading(true); reload(); }, [onlyActive]);

  const filtered = useMemo(
    () => filter === 'all' ? items : items.filter(s => s.category === filter),
    [items, filter],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true); setErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        priceRials: Math.max(0, Math.floor(form.priceRials)),
        durationMinutes: Math.max(1, Math.floor(form.durationMinutes)),
        workerCommissionRate: Math.max(0, Math.min(1, form.workerCommissionRate)),
        requiredBayType: form.requiredBayType,
      };
      if (form.id) {
        const cur = items.find(x => x.id === form.id);
        await servicesApi.update(form.id, {
          ...payload,
          sortOrder: cur?.sortOrder ?? 0,
          iconKey: cur?.iconKey ?? null,
        });
      } else {
        await servicesApi.create(payload);
      }
      setForm(null);
      await reload();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ذخیره');
    } finally { setSaving(false); }
  };

  const toggleActive = async (s: ServiceDto) => {
    try {
      await servicesApi.setActive(s.id, !s.isActive);
      setItems(prev => prev.map(x => x.id === s.id ? { ...x, isActive: !s.isActive } : x));
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در تغییر وضعیت');
    }
  };

  if (loading) return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="animate-spin text-brand-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="خدمات کارواش"
        subtitle="کتگوری، قیمت‌گذاری، مدت زمان و کمیسیون کارمند"
        actions={
          <button onClick={() => setForm(emptyForm())}
            className="px-4 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-brand-700 transition-colors">
            <Plus size={16} />خدمت جدید
          </button>
        }
      />

      {err && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3">{err}</div>}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>همه</FilterChip>
        {CATEGORIES.map(c => (
          <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>{CATEGORY_LABEL[c]}</FilterChip>
        ))}
        <label className="mr-auto flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} />
          فقط فعال‌ها
        </label>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Sparkles} title="خدمتی برای نمایش نیست"
          action={<button onClick={() => setForm(emptyForm())}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold">افزودن خدمت</button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <Card key={s.id} className={`relative ${!s.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold">
                      {CATEGORY_LABEL[s.category]}
                    </span>
                    {!s.isActive && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">غیرفعال</span>}
                  </div>
                  <div className="font-extrabold text-gray-900">{s.name}</div>
                  {s.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</div>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat icon={Coins} label="قیمت" value={`${formatRials(s.priceRials)} تومان`} />
                <Stat icon={Clock} label="مدت" value={`${toFa(s.durationMinutes)} د`} />
                <Stat icon={Layers} label="جایگاه" value={s.requiredBayType === null || s.requiredBayType === undefined ? 'آزاد' : BAY_TYPE_LABEL[s.requiredBayType]} />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setForm({
                  id: s.id, name: s.name, description: s.description ?? '',
                  category: s.category, priceRials: s.priceRials,
                  durationMinutes: s.durationMinutes, workerCommissionRate: s.workerCommissionRate,
                  requiredBayType: s.requiredBayType ?? null,
                })}
                  className="flex-1 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Pencil size={13} />ویرایش
                </button>
                <button onClick={() => toggleActive(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
                    s.isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                               : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'}`}>
                  <Power size={13} />{s.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {form && (
        <Modal onClose={() => setForm(null)} title={form.id ? 'ویرایش خدمت' : 'خدمت جدید'}>
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="نام خدمت" required value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <label className="block">
              <span className="block mb-1 text-sm text-gray-700">توضیحات</span>
              <textarea className="w-full rounded-md border bg-background px-3 py-2" rows={2}
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="block">
              <span className="block mb-1 text-sm text-gray-700">کتگوری</span>
              <select className="w-full rounded-md border bg-background px-3 py-2"
                value={form.category} onChange={e => setForm({ ...form, category: Number(e.target.value) as ServiceCategory })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <NumField label="قیمت (تومان)" value={Math.round(form.priceRials / 10)} onChange={v => setForm({ ...form, priceRials: v * 10 })} step={5_000} />
              <NumField label="مدت (دقیقه)" value={form.durationMinutes} onChange={v => setForm({ ...form, durationMinutes: v })} />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">جایگاه موردنیاز</span>
                <select
                  value={form.requiredBayType ?? ''}
                  onChange={e => setForm({ ...form, requiredBayType: e.target.value === '' ? null : Number(e.target.value) as BayType })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
                  <option value="">هر جایگاهی</option>
                  {Object.entries(BAY_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setForm(null)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-bold">انصراف</button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50">
                {saving ? <Loader2 className="inline animate-spin" size={16} /> : 'ذخیره'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const FilterChip = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
      active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
    {children}
  </button>
);

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="bg-gray-50 rounded-xl p-2 text-center">
    <Icon size={14} className="mx-auto text-gray-400 mb-1" />
    <div className="text-[10px] text-gray-500">{label}</div>
    <div className="font-bold text-gray-900 text-xs mt-0.5">{value}</div>
  </div>
);

const Field = ({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) => (
  <label className="block">
    <span className="block mb-1 text-sm text-gray-700">{label}</span>
    <input className="w-full rounded-md border bg-background px-3 py-2"
      value={value} onChange={e => onChange(e.target.value)} required={required} />
  </label>
);

const NumField = ({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) => (
  <label className="block">
    <span className="block mb-1 text-xs text-gray-700">{label}</span>
    <input type="number" min={0} step={step ?? 1}
      className="w-full rounded-md border bg-background px-3 py-2"
      value={value} onChange={e => onChange(Number(e.target.value) || 0)} />
  </label>
);

const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
);

export default ServicesView;
