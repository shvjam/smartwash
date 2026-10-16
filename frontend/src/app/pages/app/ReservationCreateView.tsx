import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2, ChevronRight, ChevronLeft, Calendar, Clock, User, Car, Sparkles, Search, MessageSquare } from 'lucide-react';
import { PageHeader, Card } from '../../components/app/PageHeader';
import { branchesApi, baysApi, servicesApi, customersApi, reservationsApi, ApiException } from '../../api';
import type { BranchDto, BayDto, ServiceDto, CustomerDto } from '../../api/types';
import { localIsoDate, localIsoDateIn } from '../../lib/dates';

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const fmtRials = (n: number) => toFa(n.toLocaleString('fa-IR'));

type Step = 1 | 2 | 3 | 4;

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

export const ReservationCreateView: React.FC = () => {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [bays, setBays] = useState<BayDto[]>([]);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [bayId, setBayId] = useState<string>('');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [date, setDate] = useState<string>(() => localIsoDateIn(1));
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerDto[]>([]);
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [b, s] = await Promise.all([branchesApi.list(true), servicesApi.list(true)]);
        setBranches(b); setServices(s);
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
    setCustomer(c); setCustomerName(c.fullName); setCustomerPhone(c.phone);
    if (c.vehicles.length >= 1) {
      const v = c.vehicles[0];
      setVehiclePlate(v.plate); setVehicleBrand(v.brand); setVehicleModel(v.model);
    }
  };

  const total = useMemo(() =>
    serviceIds.reduce((s, id) => s + (services.find(x => x.id === id)?.priceRials ?? 0), 0),
    [serviceIds, services]);

  const totalDuration = useMemo(() =>
    serviceIds.reduce((s, id) => s + (services.find(x => x.id === id)?.durationMinutes ?? 0), 0),
    [serviceIds, services]);

  const scheduledLocal = () => {
    const d = new Date(date); d.setHours(hour, minute, 0, 0); return d;
  };

  const canNext = (): boolean => {
    if (step === 1) return !!branchId;
    if (step === 2) {
      const d = scheduledLocal();
      return d.getTime() > Date.now();
    }
    if (step === 3) return customerName.trim().length > 1 && customerPhone.trim().length >= 8 && vehiclePlate.trim().length > 1;
    return true;
  };

  const submit = async () => {
    if (!branchId || serviceIds.length === 0) return;
    setSaving(true); setErr(null);
    try {
      const created = await reservationsApi.create({
        branchId,
        customerId: customer?.id ?? null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        vehiclePlate: vehiclePlate.trim(),
        vehicleBrand: vehicleBrand.trim() || null,
        vehicleModel: vehicleModel.trim() || null,
        scheduledAtUtc: scheduledLocal().toISOString(),
        preferredBayId: bayId || null,
        notes: notes.trim() || null,
        services: serviceIds.map(id => ({ serviceId: id })),
      });
      nav(`/app/reservations/${created.id}`);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ثبت رزرو');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <Link to="/app/reservations" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mb-3">
        <ChevronRight size={14} />بازگشت
      </Link>

      <PageHeader title="رزرو جدید" subtitle={`گام ${toFa(step)} از ۴`} />

      <div className="flex items-center gap-2 mb-5">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= step ? 'bg-brand-500' : 'bg-gray-100'}`} />
        ))}
      </div>

      {err && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{err}</div>}

      <Card>
        {step === 1 && (
          <>
            <SectionTitle icon={Car} title="شعبه و جایگاه (اختیاری)" hint="انتخاب جایگاه ترجیحی" />
            <label className="block mb-3">
              <span className="block mb-1 text-xs text-gray-600">شعبه</span>
              <select value={branchId} onChange={e => { setBranchId(e.target.value); setBayId(''); }}
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (پیش‌فرض)' : ''}</option>)}
              </select>
            </label>
            <div>
              <span className="block mb-2 text-xs text-gray-600">جایگاه ترجیحی (اختیاری)</span>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setBayId('')}
                  className={`rounded-2xl border-2 p-3 text-center text-xs font-bold ${bayId === '' ? 'bg-brand-50 border-brand-500' : 'bg-white border-gray-200'}`}>
                  هر جایگاه آزاد
                </button>
                {bays.map(b => (
                  <button key={b.id} type="button" onClick={() => setBayId(b.id)}
                    className={`rounded-2xl border-2 p-3 text-center ${bayId === b.id ? 'bg-brand-50 border-brand-500' : 'bg-white border-gray-200'}`}>
                    <div className="text-[10px] text-gray-500">جایگاه</div>
                    <div className="font-extrabold text-lg text-gray-900">{toFa(b.number)}</div>
                    <div className="text-[10px] text-gray-500">{b.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <SectionTitle icon={Calendar} title="تاریخ و زمان" hint="حداقل یک ساعت بعد از حالا" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input type="date" value={date} min={localIsoDate()}
                onChange={e => setDate(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              <select value={hour} onChange={e => setHour(Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono">
                {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:۰۰</option>)}
              </select>
              <select value={minute} onChange={e => setMinute(Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono">
                {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')} دقیقه</option>)}
              </select>
            </div>
            <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 flex items-center gap-2">
              <Clock size={14} className="text-brand-600" />
              {scheduledLocal().toLocaleString('fa-IR', { dateStyle: 'full', timeStyle: 'short' })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <SectionTitle icon={User} title="مشتری و خودرو" hint="جستجو در پایگاه یا ورود دستی" />
            <div className="relative mb-2">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                placeholder="نام یا موبایل..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-3 py-2.5 text-sm" />
            </div>
            {customerResults.length > 0 && (
              <div className="rounded-xl border border-gray-100 mb-2 overflow-hidden">
                {customerResults.map(c => (
                  <button key={c.id} type="button" onClick={() => { pickCustomer(c); setCustomerResults([]); setCustomerSearch(''); }}
                    className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b last:border-0 flex items-center justify-between">
                    <span className="text-sm font-bold">{c.fullName}</span>
                    <span className="text-xs text-gray-500 font-mono">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {customer && (
              <div className="rounded-xl bg-emerald-50 text-emerald-800 px-3 py-2 text-xs mb-2 flex items-center justify-between">
                <span>مشتری: <b>{customer.fullName}</b></span>
                <button type="button" onClick={() => setCustomer(null)} className="underline">تغییر</button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <Txt label="نام مشتری" required value={customerName} onChange={setCustomerName} />
              <Txt label="موبایل" required value={customerPhone} onChange={setCustomerPhone} mono placeholder="0912..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Txt label="پلاک" required value={vehiclePlate} onChange={setVehiclePlate} mono />
              <Txt label="برند" value={vehicleBrand} onChange={setVehicleBrand} />
              <Txt label="مدل" value={vehicleModel} onChange={setVehicleModel} />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <SectionTitle icon={Sparkles} title="خدمات و یادداشت" hint={`جمع تخمینی: ${fmtRials(total)} ﷼ • ${toFa(totalDuration)} د`} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto mb-3">
              {services.map(s => {
                const active = serviceIds.includes(s.id);
                return (
                  <button key={s.id} type="button"
                    onClick={() => setServiceIds(prev => active ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                    className={`text-right rounded-xl border p-3 ${active ? 'bg-brand-50 border-brand-500' : 'bg-white border-gray-200'}`}>
                    <div className="font-bold text-sm">{s.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{fmtRials(s.priceRials)} ﷼ • {toFa(s.durationMinutes)}د</div>
                  </button>
                );
              })}
            </div>
            <label className="block">
              <span className="block mb-1 text-xs text-gray-600 flex items-center gap-1"><MessageSquare size={12} />یادداشت</span>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="درخواست خاص مشتری..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </label>
          </>
        )}
      </Card>

      <div className="mt-5 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setStep(s => Math.max(1, (s - 1) as Step))} disabled={step === 1}
          className="px-4 py-2.5 rounded-xl border text-sm font-bold disabled:opacity-40 inline-flex items-center gap-1">
          <ChevronRight size={14} />مرحله قبل
        </button>
        {step < 4 ? (
          <button type="button" disabled={!canNext()} onClick={() => setStep(s => (s + 1) as Step)}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1">
            ادامه<ChevronLeft size={14} />
          </button>
        ) : (
          <button type="button" disabled={saving || serviceIds.length === 0} onClick={submit}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}ثبت رزرو
          </button>
        )}
      </div>
    </div>
  );
};

const SectionTitle = ({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Icon size={18} /></div>
    <div>
      <div className="font-extrabold text-gray-900 text-sm">{title}</div>
      <div className="text-[11px] text-gray-500">{hint}</div>
    </div>
  </div>
);

const Txt = ({ label, value, onChange, required, mono, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; mono?: boolean; placeholder?: string;
}) => (
  <label className="block">
    <span className="block mb-1 text-[11px] text-gray-600">{label}{required && ' *'}</span>
    <input value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
      className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${mono ? 'font-mono' : ''}`} />
  </label>
);

export default ReservationCreateView;
