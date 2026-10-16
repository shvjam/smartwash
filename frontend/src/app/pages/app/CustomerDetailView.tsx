import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowRight, Loader2, Car, Wallet, Sparkles, Receipt, Plus, Trash2,
  TrendingUp, TrendingDown, Phone, Calendar, X, Pencil, Check,
} from 'lucide-react';
import { PageHeader, Card, StatCard, EmptyState } from '../../components/app/PageHeader';
import { customersApi, ApiException } from '../../api';
import { LoyaltyTier, type CustomerDto, type CustomerVehicleDto } from '../../api/types';
import type { WalletTxDto, LoyaltyTxDto, CustomerOrderSummary } from '../../api/modules';

const TIER_LABEL: Record<number, string> = { 0: 'برنزی', 1: 'نقره‌ای', 2: 'طلایی', 3: 'پلاتین', 4: 'الماس' };
const TIER_COLOR: Record<number, string> = {
  0: 'bg-amber-100 text-amber-700', 1: 'bg-gray-100 text-gray-700',
  2: 'bg-yellow-100 text-yellow-700', 3: 'bg-violet-100 text-violet-700',
  4: 'bg-sky-100 text-sky-700',
};
const ORDER_STATUS: Record<number, string> = {
  0: 'در حال انجام', 1: 'تکمیل', 2: 'لغو',
};
const WTX_TYPE: Record<number, string> = { 0: 'شارژ', 1: 'برداشت', 2: 'استرداد', 3: 'تنظیم' };
const LTX_TYPE: Record<number, string> = { 0: 'کسب', 1: 'استفاده', 2: 'انقضا', 3: 'تنظیم' };

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const formatRials = (n: number) => toFa(Math.round(n / 10).toLocaleString('fa-IR'));
const formatDate = (iso: string) => {
  try {
    return toFa(new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso)));
  } catch { return iso; }
};

type Tab = 'overview' | 'vehicles' | 'orders' | 'wallet' | 'loyalty';

export const CustomerDetailView: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const reload = async () => {
    try { setCustomer(await customersApi.get(id)); }
    catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری'); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [id]);

  if (loading) return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="animate-spin text-brand-600" /></div>;
  if (!customer) return (
    <div className="max-w-4xl mx-auto pb-10">
      <Card><EmptyState icon={Phone} title="مشتری یافت نشد" hint={err ?? undefined}
        action={<button onClick={() => navigate('/app/crm')} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold">بازگشت</button>} /></Card>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <Link to="/app/crm" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 mb-3">
        <ArrowRight size={14} />بازگشت به باشگاه مشتریان
      </Link>
      <PageHeader title={customer.fullName} subtitle={customer.phone}
        actions={
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${TIER_COLOR[customer.tier]}`}>{TIER_LABEL[customer.tier]}</span>
        } />

      {err && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3">{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="کیف پول" value={`${formatRials(customer.walletBalanceRials)} تومان`} accent="emerald" />
        <StatCard label="امتیاز وفاداری" value={toFa(customer.loyaltyPoints)} accent="violet" />
        <StatCard label="تعداد بازدید" value={toFa(customer.totalVisits)} accent="sky" />
        <StatCard label="مجموع خرید" value={`${formatRials(customer.lifetimeSpendRials)} تومان`} accent="amber" />
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>نمای کلی</TabBtn>
        <TabBtn active={tab === 'vehicles'} onClick={() => setTab('vehicles')}>خودروها ({toFa(customer.vehicles.length)})</TabBtn>
        <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')}>سفارش‌ها</TabBtn>
        <TabBtn active={tab === 'wallet'} onClick={() => setTab('wallet')}>کیف پول</TabBtn>
        <TabBtn active={tab === 'loyalty'} onClick={() => setTab('loyalty')}>وفاداری</TabBtn>
      </div>

      {tab === 'overview' && <OverviewTab customer={customer} onChanged={reload} />}
      {tab === 'vehicles' && <VehiclesTab customer={customer} onChanged={reload} />}
      {tab === 'orders' && <OrdersTab customerId={customer.id} />}
      {tab === 'wallet' && <WalletTab customer={customer} onChanged={reload} />}
      {tab === 'loyalty' && <LoyaltyTab customer={customer} onChanged={reload} />}
    </div>
  );
};

const TabBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick}
    className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
      active ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
    {children}
  </button>
);

const OverviewTab: React.FC<{ customer: CustomerDto; onChanged: () => void }> = ({ customer, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: customer.fullName, phone: customer.phone,
    email: customer.email ?? '', nationalId: customer.nationalId ?? '',
    address: customer.address ?? '', notes: customer.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await customersApi.update(customer.id, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        nationalId: form.nationalId.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        gender: customer.gender,
        birthDate: customer.birthDate ?? null,
      });
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ذخیره');
    } finally { setBusy(false); }
  };

  if (editing) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-gray-700">ویرایش اطلاعات مشتری</h3>
          <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        {err && <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{err}</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'نام', key: 'fullName', required: true },
            { label: 'تلفن', key: 'phone', required: true, dir: 'ltr' as const },
            { label: 'ایمیل', key: 'email', dir: 'ltr' as const },
            { label: 'کد ملی', key: 'nationalId', dir: 'ltr' as const },
            { label: 'نشانی', key: 'address' },
            { label: 'یادداشت', key: 'notes' },
          ].map(f => (
            <label key={f.key} className="block">
              <span className="text-xs text-gray-500 mb-1 block">{f.label}</span>
              <input dir={f.dir} required={f.required} value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={save} disabled={busy}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 disabled:opacity-60">
            <Check size={14} />{busy ? '…' : 'ذخیره'}
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">انصراف</button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm text-gray-700">اطلاعات پایه</h3>
        <button onClick={() => setEditing(true)}
          className="text-xs flex items-center gap-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 px-2 py-1 rounded-lg transition-colors">
          <Pencil size={12} />ویرایش
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <Row label="نام" value={customer.fullName} />
        <Row label="تلفن" value={customer.phone} />
        <Row label="ایمیل" value={customer.email ?? '—'} />
        <Row label="کد ملی" value={customer.nationalId ?? '—'} />
        <Row label="نشانی" value={customer.address ?? '—'} />
        <Row label="آخرین بازدید" value={customer.lastVisitAtUtc ? formatDate(customer.lastVisitAtUtc) : '—'} />
        <Row label="یادداشت" value={customer.notes ?? '—'} />
        <Row label="وضعیت" value={customer.isActive ? 'فعال' : 'غیرفعال'} />
      </div>
    </Card>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-b border-gray-100 pb-2">
    <div className="text-[11px] text-gray-500 mb-1">{label}</div>
    <div className="text-gray-900">{value}</div>
  </div>
);

const VehiclesTab: React.FC<{ customer: CustomerDto; onChanged: () => void }> = ({ customer, onChanged }) => {
  const [form, setForm] = useState<{ plate: string; brand: string; model: string; color: string; year: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setErr(null);
    try {
      await customersApi.addVehicle(customer.id, {
        plate: form.plate.trim(), brand: form.brand.trim(), model: form.model.trim(),
        color: form.color.trim() || null,
        year: form.year ? parseInt(form.year, 10) : null,
      });
      setForm(null); onChanged();
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در افزودن'); }
    finally { setBusy(false); }
  };

  const remove = async (v: CustomerVehicleDto) => {
    if (!confirm(`خودرو ${v.plate} حذف شود؟`)) return;
    try { await customersApi.removeVehicle(customer.id, v.id); onChanged(); }
    catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در حذف'); }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-gray-900 flex items-center gap-2"><Car size={18} />خودروها</h3>
        <button onClick={() => setForm({ plate: '', brand: '', model: '', color: '', year: '' })}
          className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5">
          <Plus size={14} />خودرو جدید
        </button>
      </div>
      {err && <div className="mb-3 rounded-md bg-destructive/10 text-destructive p-2 text-xs">{err}</div>}
      {customer.vehicles.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-8">خودرویی ثبت نشده.</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {customer.vehicles.map(v => (
            <div key={v.id} className="border border-gray-100 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Car size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 truncate">{v.plate}</div>
                <div className="text-xs text-gray-500 truncate">{v.brand} {v.model}{v.color ? ` · ${v.color}` : ''}{v.year ? ` · ${toFa(v.year)}` : ''}</div>
              </div>
              <button onClick={() => remove(v)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title="افزودن خودرو" onClose={() => setForm(null)}>
          <form onSubmit={add} className="space-y-3">
            <TextInput label="پلاک" required value={form.plate} onChange={v => setForm({ ...form, plate: v })} />
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="برند" required value={form.brand} onChange={v => setForm({ ...form, brand: v })} />
              <TextInput label="مدل" required value={form.model} onChange={v => setForm({ ...form, model: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="رنگ" value={form.color} onChange={v => setForm({ ...form, color: v })} />
              <TextInput label="سال (شمسی)" value={form.year} onChange={v => setForm({ ...form, year: v })} />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-bold">انصراف</button>
              <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50">
                {busy ? <Loader2 className="inline animate-spin" size={16} /> : 'افزودن'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
};

const OrdersTab: React.FC<{ customerId: string }> = ({ customerId }) => {
  const [items, setItems] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { const r = await customersApi.orders(customerId, 1, 50); setItems(r.items); }
      catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [customerId]);

  if (loading) return <Card><div className="grid place-items-center py-8"><Loader2 className="animate-spin text-brand-600" /></div></Card>;
  if (items.length === 0) return <Card><EmptyState icon={Receipt} title="سفارشی برای این مشتری ثبت نشده" /></Card>;

  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-right text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="px-4 py-2">شماره</th>
            <th className="px-4 py-2">پلاک</th>
            <th className="px-4 py-2">تاریخ</th>
            <th className="px-4 py-2">مبلغ</th>
            <th className="px-4 py-2">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          {items.map(o => (
            <tr key={o.id} className="border-t">
              <td className="px-4 py-3 font-mono">{o.number}</td>
              <td className="px-4 py-3">{o.vehiclePlate}</td>
              <td className="px-4 py-3">{formatDate(o.createdAtUtc)}</td>
              <td className="px-4 py-3">{formatRials(o.totalRials)} تومان</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold">{ORDER_STATUS[o.status] ?? '—'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const WalletTab: React.FC<{ customer: CustomerDto; onChanged: () => void }> = ({ customer, onChanged }) => {
  const [items, setItems] = useState<WalletTxDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(''); const [desc, setDesc] = useState(''); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await customersApi.walletTransactions(customer.id, 1, 50); setItems(r.items); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [customer.id]);

  const submit = async (sign: 1 | -1) => {
    const v = parseInt(amount, 10);
    if (!Number.isFinite(v) || v <= 0) { setErr('مبلغ نامعتبر'); return; }
    setBusy(true); setErr(null);
    try {
      await customersApi.adjustWallet(customer.id, sign * v * 10, desc.trim() || null);
      setAmount(''); setDesc(''); await load(); onChanged();
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-extrabold text-gray-900 mb-3 flex items-center gap-2"><Wallet size={18} />شارژ / برداشت دستی</h3>
        {err && <div className="mb-2 rounded-md bg-destructive/10 text-destructive p-2 text-xs">{err}</div>}
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-600 mb-1">مبلغ (تومان)</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min={0}
              className="w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <div className="flex-[2] min-w-[180px]">
            <label className="block text-xs text-gray-600 mb-1">توضیح</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <button type="button" disabled={busy} onClick={() => submit(1)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
            <TrendingUp size={14} />شارژ
          </button>
          <button type="button" disabled={busy} onClick={() => submit(-1)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
            <TrendingDown size={14} />برداشت
          </button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-brand-600" /></div>
          : items.length === 0 ? <div className="text-center text-sm text-gray-500 py-8">تراکنشی ثبت نشده.</div>
          : (
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">نوع</th>
                <th className="px-4 py-2">مبلغ</th>
                <th className="px-4 py-2">مانده</th>
                <th className="px-4 py-2">توضیح</th>
                <th className="px-4 py-2">زمان</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">{WTX_TYPE[t.type] ?? '—'}</td>
                  <td className={`px-4 py-3 font-bold ${t.amountRials >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {t.amountRials >= 0 ? '+' : ''}{formatRials(t.amountRials)}
                  </td>
                  <td className="px-4 py-3">{formatRials(t.balanceAfterRials)}</td>
                  <td className="px-4 py-3 text-gray-600">{t.description ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(t.occurredAtUtc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

const LoyaltyTab: React.FC<{ customer: CustomerDto; onChanged: () => void }> = ({ customer, onChanged }) => {
  const [items, setItems] = useState<LoyaltyTxDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(''); const [desc, setDesc] = useState(''); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await customersApi.loyaltyTransactions(customer.id, 1, 50); setItems(r.items); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [customer.id]);

  const submit = async (sign: 1 | -1) => {
    const v = parseInt(points, 10);
    if (!Number.isFinite(v) || v <= 0) { setErr('امتیاز نامعتبر'); return; }
    setBusy(true); setErr(null);
    try {
      await customersApi.adjustLoyalty(customer.id, sign * v, desc.trim() || null);
      setPoints(''); setDesc(''); await load(); onChanged();
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-extrabold text-gray-900 mb-3 flex items-center gap-2"><Sparkles size={18} />تنظیم امتیاز</h3>
        {err && <div className="mb-2 rounded-md bg-destructive/10 text-destructive p-2 text-xs">{err}</div>}
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-600 mb-1">امتیاز</label>
            <input value={points} onChange={e => setPoints(e.target.value)} type="number" min={0}
              className="w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <div className="flex-[2] min-w-[180px]">
            <label className="block text-xs text-gray-600 mb-1">توضیح</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <button type="button" disabled={busy} onClick={() => submit(1)}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
            <TrendingUp size={14} />افزودن
          </button>
          <button type="button" disabled={busy} onClick={() => submit(-1)}
            className="px-4 py-2 rounded-xl bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
            <TrendingDown size={14} />کسر
          </button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-brand-600" /></div>
          : items.length === 0 ? <div className="text-center text-sm text-gray-500 py-8">تراکنشی ثبت نشده.</div>
          : (
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">نوع</th>
                <th className="px-4 py-2">امتیاز</th>
                <th className="px-4 py-2">مانده</th>
                <th className="px-4 py-2">توضیح</th>
                <th className="px-4 py-2">زمان</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">{LTX_TYPE[t.type] ?? '—'}</td>
                  <td className={`px-4 py-3 font-bold ${t.points >= 0 ? 'text-violet-600' : 'text-gray-600'}`}>
                    {t.points >= 0 ? '+' : ''}{toFa(t.points)}
                  </td>
                  <td className="px-4 py-3">{toFa(t.balanceAfter)}</td>
                  <td className="px-4 py-3 text-gray-600">{t.description ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(t.occurredAtUtc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

const TextInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; required?: boolean }> = ({ label, value, onChange, required }) => (
  <label className="block">
    <span className="block mb-1 text-sm text-gray-700">{label}</span>
    <input className="w-full rounded-md border bg-background px-3 py-2"
      value={value} onChange={e => onChange(e.target.value)} required={required} />
  </label>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
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

export default CustomerDetailView;
