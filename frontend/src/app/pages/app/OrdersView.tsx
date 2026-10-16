import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Loader2, Plus, Search, Receipt, X, ChevronLeft, ChevronRight, User, Car, Sparkles, Wallet, ShoppingBag } from 'lucide-react';
import { PageHeader, Card, EmptyState, StatCard } from '../../components/app/PageHeader';
import { ordersApi, branchesApi, baysApi, customersApi, servicesApi, ApiException } from '../../api';
import { ensureCustomerAndVehicle } from '../../lib/customerRecords';
import {
  OrderStatus, OrderSource, BayStatus,
  type OrderDto, type BranchDto, type BayDto, type CustomerDto, type ServiceDto,
} from '../../api/types';
import type { CreateOrderLineInput } from '../../api/modules';

const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  [OrderStatus.InProgress]: { label: 'در حال انجام', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  [OrderStatus.Completed]: { label: 'تکمیل شده', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  [OrderStatus.Cancelled]: { label: 'لغو شده', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
// Rials from the API, shown in tomans like every other screen.
const fmtRials = (n: number) => toFa(Math.round(n / 10).toLocaleString('fa-IR'));
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });

export const OrdersView: React.FC = () => {
  const [items, setItems] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);

  const reload = async (p = page) => {
    setLoading(true); setErr(null);
    try {
      const res = await ordersApi.search({
        status: status === 'all' ? undefined : status,
        search: search.trim() || undefined,
        page: p, pageSize: 20,
      });
      setItems(res.items);
      setTotalPages(res.totalPages || 1);
      setPage(res.page);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری');
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(1); }, [status]);

  const stats = useMemo(() => ({
    total: items.length,
    inProgress: items.filter(o => o.status === OrderStatus.InProgress).length,
    completed: items.filter(o => o.status === OrderStatus.Completed).length,
    cancelled: items.filter(o => o.status === OrderStatus.Cancelled).length,
    revenue: items.filter(o => o.status === OrderStatus.Completed).reduce((s, o) => s + o.totalRials, 0),
  }), [items]);

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <PageHeader
        title="سفارش‌ها"
        subtitle="ثبت سفارش، فیلتر بر اساس وضعیت و مدیریت چرخه‌ی صندوق"
        actions={
          <button onClick={() => setWizardOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-brand-700">
            <Plus size={16} />سفارش جدید
          </button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label="سفارش‌های صفحه" value={toFa(stats.total)} accent="sky" />
        <StatCard label="در حال انجام" value={toFa(stats.inProgress)} accent="violet" />
        <StatCard label="تکمیل شده" value={toFa(stats.completed)} accent="emerald" />
        <StatCard label="لغو شده" value={toFa(stats.cancelled)} accent="amber" />
        <StatCard label="درآمد صفحه" value={`${fmtRials(stats.revenue)} تومان`} accent="red" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterChip active={status === 'all'} onClick={() => setStatus('all')}>همه</FilterChip>
        {[OrderStatus.InProgress, OrderStatus.Completed, OrderStatus.Cancelled].map(s => (
          <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL[s].label}</FilterChip>
        ))}
        <form className="mr-auto flex items-center gap-2" onSubmit={e => { e.preventDefault(); reload(1); }}>
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="پلاک، نام مشتری یا شماره سفارش"
              className="bg-white border border-gray-200 rounded-xl pl-3 pr-9 py-2 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          </div>
          <button type="submit" className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">جستجو</button>
        </form>
      </div>

      {err && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{err}</div>}

      {loading ? (
        <div className="min-h-[30vh] grid place-items-center"><Loader2 className="animate-spin text-brand-600" /></div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={Receipt} title="سفارشی یافت نشد" hint="با کلیک «سفارش جدید» اولین سفارش را ثبت کنید." /></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-[11px] font-bold">
                <tr>
                  <th className="text-right px-4 py-3">شماره</th>
                  <th className="text-right px-4 py-3">مشتری</th>
                  <th className="text-right px-4 py-3">پلاک</th>
                  <th className="text-right px-4 py-3">وضعیت</th>
                  <th className="text-right px-4 py-3">مبلغ</th>
                  <th className="text-right px-4 py-3">شروع</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(o => {
                  const st = STATUS_LABEL[o.status];
                  return (
                    <tr key={o.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">{o.number}</td>
                      <td className="px-4 py-3">{o.customerName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.vehiclePlate}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${st.cls}`}>{st.label}</span></td>
                      <td className="px-4 py-3 font-mono">{fmtRials(o.totalRials)} تومان</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(o.startedAtUtc)}</td>
                      <td className="px-4 py-3 text-left">
                        <Link to={`/app/orders/${o.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-bold hover:bg-gray-700">
                          جزییات<ChevronLeft size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
              <button disabled={page <= 1} onClick={() => reload(page - 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-xs font-bold inline-flex items-center gap-1">
                <ChevronRight size={14} />قبلی
              </button>
              <span className="text-xs text-gray-500 font-mono">صفحه {toFa(page)} از {toFa(totalPages)}</span>
              <button disabled={page >= totalPages} onClick={() => reload(page + 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-xs font-bold inline-flex items-center gap-1">
                بعدی<ChevronLeft size={14} />
              </button>
            </div>
          )}
        </Card>
      )}

      {wizardOpen && <CreateOrderWizard onClose={() => setWizardOpen(false)} onCreated={() => { setWizardOpen(false); reload(1); }} />}
    </div>
  );
};

const FilterChip = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
      active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{children}</button>
);

// ============ Wizard ============

type WizardStep = 1 | 2 | 3 | 4;

const CreateOrderWizard: React.FC<{ onClose: () => void; onCreated: (id: string) => void }> = ({ onClose, onCreated }) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [bays, setBays] = useState<BayDto[]>([]);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [bayId, setBayId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerDto[]>([]);
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [lines, setLines] = useState<CreateOrderLineInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [b, s] = await Promise.all([branchesApi.list(true), servicesApi.list(true)]);
        setBranches(b);
        setServices(s);
        if (b.length) setBranchId(b.find(x => x.isDefault)?.id ?? b[0].id);
      } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری'); }
    })();
  }, []);

  useEffect(() => {
    if (!branchId) return;
    baysApi.list(branchId, true).then(setBays).catch(() => {});
  }, [branchId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!customerSearch.trim()) { setCustomerResults([]); return; }
      try {
        const res = await customersApi.search({ search: customerSearch.trim(), pageSize: 8 });
        setCustomerResults(res.items);
      } catch { /* noop */ }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const pickCustomer = (c: CustomerDto) => {
    setCustomer(c);
    setCustomerName(c.fullName);
    setCustomerPhone(c.phone);
    if (c.vehicles.length === 1) {
      const v = c.vehicles[0];
      setVehiclePlate(v.plate); setVehicleBrand(v.brand); setVehicleModel(v.model); setVehicleId(v.id);
    }
  };

  const toggleLine = (sid: string) => {
    setLines(prev => prev.some(l => l.serviceId === sid)
      ? prev.filter(l => l.serviceId !== sid)
      : [...prev, { serviceId: sid, quantity: 1, workerId: null }]);
  };
  const setQty = (sid: string, q: number) =>
    setLines(prev => prev.map(l => l.serviceId === sid ? { ...l, quantity: Math.max(1, q) } : l));

  const subtotal = useMemo(() =>
    lines.reduce((s, l) => s + (services.find(x => x.id === l.serviceId)?.priceRials ?? 0) * l.quantity, 0),
    [lines, services]);

  const canNext = (): boolean => {
    if (step === 1) return !!branchId && !!bayId;
    if (step === 2) return customerName.trim().length > 1 && vehiclePlate.trim().length > 1;
    if (step === 3) return lines.length > 0;
    return true;
  };

  const submit = async () => {
    if (!branchId || !bayId || lines.length === 0) return;
    setSaving(true); setErr(null);
    try {
      // Anyone with a phone number becomes a customer with their car on file, exactly as when
      // booking from the bay board — otherwise this form quietly made them a guest.
      let resolvedCustomerId = customer?.id ?? null;
      let resolvedVehicleId = vehicleId;
      try {
        const ensured = await ensureCustomerAndVehicle({
          known: customer, phone: customerPhone, name: customerName,
          plate: vehiclePlate, brand: vehicleBrand, model: vehicleModel,
        });
        resolvedCustomerId = ensured.customer?.id ?? resolvedCustomerId;
        resolvedVehicleId = resolvedVehicleId ?? ensured.vehicleId;
      } catch { /* the order still goes through as a guest order */ }

      const created = await ordersApi.create({
        branchId, bayId,
        customerId: resolvedCustomerId,
        vehicleId: resolvedVehicleId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        vehiclePlate: vehiclePlate.trim(),
        vehicleBrand: vehicleBrand.trim() || null,
        vehicleModel: vehicleModel.trim() || null,
        source: OrderSource.WalkIn,
        reservationId: null,
        lines,
      });
      onCreated(created.id);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ثبت سفارش');
    } finally { setSaving(false); }
  };

  const freeBays = bays.filter(b => b.status === BayStatus.Free);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/40" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="relative w-full md:max-w-2xl bg-white rounded-t-[2rem] md:rounded-[2rem] shadow-2xl max-h-[92vh] overflow-y-auto">
        <header className="sticky top-0 bg-white/90 backdrop-blur px-6 pt-5 pb-3 border-b z-10 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-gray-900">سفارش جدید</h2>
            <p className="text-xs text-gray-500 mt-0.5">گام {toFa(step)} از ۴</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-50 hover:bg-gray-100"><X size={18} /></button>
        </header>

        <div className="px-6 pt-4 flex items-center gap-2">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= step ? 'bg-brand-500' : 'bg-gray-100'}`} />
          ))}
        </div>

        <div className="p-6 space-y-4">
          {err && <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{err}</div>}

          {step === 1 && (
            <>
              <StepHeader icon={Car} title="شعبه و جایگاه" hint="جایگاه آزاد برای پذیرش خودرو" />
              <label className="block">
                <span className="block mb-1 text-xs text-gray-600">شعبه</span>
                <select value={branchId} onChange={e => { setBranchId(e.target.value); setBayId(''); }}
                  className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (پیش‌فرض)' : ''}</option>)}
                </select>
              </label>
              <div>
                <span className="block mb-2 text-xs text-gray-600">جایگاه آزاد</span>
                {freeBays.length === 0 ? (
                  <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-xs">هیچ جایگاه آزادی در این شعبه نیست.</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {freeBays.map(b => (
                      <button key={b.id} type="button" onClick={() => setBayId(b.id)}
                        className={`rounded-2xl border-2 p-3 text-center transition ${
                          bayId === b.id ? 'bg-brand-50 border-brand-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                        <div className="text-[10px] text-gray-500">جایگاه</div>
                        <div className="font-extrabold text-lg text-gray-900 mt-0.5">{toFa(b.number)}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{b.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepHeader icon={User} title="مشتری و خودرو" hint="جستجو در پایگاه مشتریان یا ورود مهمان" />
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="جستجو با نام یا موبایل..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              </div>
              {customerResults.length > 0 && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  {customerResults.map(c => (
                    <button key={c.id} type="button" onClick={() => { pickCustomer(c); setCustomerResults([]); setCustomerSearch(''); }}
                      className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">{c.fullName}</span>
                      <span className="text-xs text-gray-500 font-mono">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {customer && (
                <div className="rounded-xl bg-emerald-50 text-emerald-800 px-3 py-2 text-xs flex items-center justify-between">
                  <span>مشتری شناسایی شد: <b>{customer.fullName}</b> ({toFa(customer.totalVisits)} مراجعه)</span>
                  <button type="button" onClick={() => { setCustomer(null); setVehicleId(null); }} className="underline">پاک کردن</button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <TxtField label="نام مشتری" required value={customerName} onChange={setCustomerName} />
                <TxtField label="موبایل" value={customerPhone} onChange={setCustomerPhone} placeholder="0912..." mono />
              </div>
              {customer && customer.vehicles.length > 1 && (
                <div>
                  <span className="block mb-1 text-xs text-gray-600">انتخاب خودرو</span>
                  <div className="grid grid-cols-2 gap-2">
                    {customer.vehicles.map(v => (
                      <button key={v.id} type="button"
                        onClick={() => { setVehicleId(v.id); setVehiclePlate(v.plate); setVehicleBrand(v.brand); setVehicleModel(v.model); }}
                        className={`rounded-xl border-2 p-2 text-right ${vehicleId === v.id ? 'bg-brand-50 border-brand-500' : 'bg-white border-gray-200'}`}>
                        <div className="font-mono font-bold text-xs">{v.plate}</div>
                        <div className="text-[10px] text-gray-500">{v.brand} {v.model}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <TxtField label="پلاک" required value={vehiclePlate} onChange={setVehiclePlate} mono />
                <TxtField label="برند" value={vehicleBrand} onChange={setVehicleBrand} />
                <TxtField label="مدل" value={vehicleModel} onChange={setVehicleModel} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepHeader icon={Sparkles} title="خدمات" hint="یک یا چند خدمت انتخاب کنید" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
                {services.map(s => {
                  const line = lines.find(l => l.serviceId === s.id);
                  return (
                    <div key={s.id}
                      className={`rounded-xl border p-3 transition ${line ? 'bg-brand-50 border-brand-500' : 'bg-white border-gray-200'}`}>
                      <button type="button" onClick={() => toggleLine(s.id)} className="w-full text-right">
                        <div className="font-bold text-sm text-gray-900">{s.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">{fmtRials(s.priceRials)} تومان • {toFa(s.durationMinutes)}د</div>
                      </button>
                      {line && (
                        <div className="flex items-center gap-1 mt-2">
                          <button type="button" onClick={() => setQty(s.id, line.quantity - 1)} className="w-7 h-7 rounded-lg bg-white border text-sm">−</button>
                          <span className="flex-1 text-center font-mono font-bold">{toFa(line.quantity)}</span>
                          <button type="button" onClick={() => setQty(s.id, line.quantity + 1)} className="w-7 h-7 rounded-lg bg-white border text-sm">+</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {subtotal > 0 && (
                <div className="rounded-xl bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
                  <span className="text-xs">جمع کل تخمینی</span>
                  <span className="font-mono font-extrabold">{fmtRials(subtotal)} تومان</span>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <StepHeader icon={ShoppingBag} title="بازبینی و ثبت" hint="پیش از ثبت مرور کنید" />
              <Review label="شعبه" value={branches.find(b => b.id === branchId)?.name ?? '—'} />
              <Review label="جایگاه" value={`${toFa(bays.find(b => b.id === bayId)?.number ?? 0)} — ${bays.find(b => b.id === bayId)?.name ?? ''}`} />
              <Review label="مشتری" value={`${customerName}${customerPhone ? ` (${customerPhone})` : ''}`} />
              <Review label="خودرو" value={`${vehiclePlate}${vehicleBrand ? ` — ${vehicleBrand} ${vehicleModel}` : ''}`} />
              <Review label="خدمات" value={lines.map(l => {
                const s = services.find(x => x.id === l.serviceId);
                return `${s?.name ?? '?'} ×${toFa(l.quantity)}`;
              }).join('، ')} />
              <Review label="جمع تخمینی" value={`${fmtRials(subtotal)} تومان`} />
            </>
          )}
        </div>

        <footer className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setStep(s => Math.max(1, (s - 1) as WizardStep))}
            disabled={step === 1}
            className="px-4 py-2.5 rounded-xl border text-sm font-bold disabled:opacity-40 inline-flex items-center gap-1">
            <ChevronRight size={14} />مرحله قبل
          </button>
          {step < 4 ? (
            <button type="button" disabled={!canNext()} onClick={() => setStep(s => (s + 1) as WizardStep)}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1">
              ادامه<ChevronLeft size={14} />
            </button>
          ) : (
            <button type="button" disabled={saving} onClick={submit}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}ثبت سفارش
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

const StepHeader = ({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) => (
  <div className="flex items-center gap-3 mb-1">
    <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Icon size={18} /></div>
    <div>
      <div className="font-extrabold text-gray-900 text-sm">{title}</div>
      <div className="text-[11px] text-gray-500">{hint}</div>
    </div>
  </div>
);

const TxtField = ({ label, value, onChange, required, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; placeholder?: string; mono?: boolean;
}) => (
  <label className="block">
    <span className="block mb-1 text-[11px] text-gray-600">{label}{required && ' *'}</span>
    <input value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
      className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${mono ? 'font-mono' : ''}`} />
  </label>
);

const Review = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-dashed last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm text-gray-900 font-medium text-left">{value}</span>
  </div>
);

export default OrdersView;
