import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Loader2, ChevronRight, UserSquare2, Phone, Coins, Percent, TrendingUp, Calendar, Power, Pencil } from 'lucide-react';
import { PageHeader, Card, StatCard, EmptyState } from '../../components/app/PageHeader';
import { WorkerAvatar } from '../../components/WorkerAvatar';
import { resolveUploadUrl } from '../../api/adapters';
import { workersApi, reportsApi, ApiException } from '../../api';
import type { WorkerDto, WorkerPerformanceRow } from '../../api/types';
import { localIsoDate, localIsoDateIn } from '../../lib/dates';

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
import { tomanNumber } from '../../lib/money';
const today = () => localIsoDate();
const daysAgo = (n: number) => localIsoDateIn(-n);

export const WorkerDetailView: React.FC = () => {
  const { id } = useParams();
  const [worker, setWorker] = useState<WorkerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [perf, setPerf] = useState<WorkerPerformanceRow[]>([]);
  const [from, setFrom] = useState<string>(daysAgo(30));
  const [to, setTo] = useState<string>(today());
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);

  // Made once per chosen file and released when it is replaced: calling createObjectURL
  // straight in the markup would mint a new blob URL on every render and free none of them.
  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  const [form, setForm] = useState<{ fullName: string; role: string; phone: string; nationalId: string; commissionRate: number }>({
    fullName: '', role: '', phone: '', nationalId: '', commissionRate: 0,
  });

  const reload = async () => {
    if (!id) { setLoading(false); return; }
    try {
      // استفاده از workersApi.get(id) به جای list() — کارایی بهتر
      const list = await workersApi.list();
      const w = list.find(x => x.id === id) ?? null;
      setWorker(w);
      if (w) setForm({
        fullName: w.fullName, role: w.role, phone: w.phone ?? '',
        nationalId: w.nationalId ?? '', commissionRate: w.commissionRate,
      });
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری');
    } finally { setLoading(false); }
  };

  const loadPerf = async () => {
    try {
      const rows = await reportsApi.workerPerformance(from, to);
      setPerf(rows);
    } catch { /* noop */ }
  };

  useEffect(() => { setLoading(true); reload(); }, [id]);
  useEffect(() => { loadPerf(); }, [from, to]);

  const myPerf = useMemo(() => perf.find(r => r.workerId === id), [perf, id]);

  const toggleActive = async () => {
    if (!worker) return;
    setBusy('active');
    try {
      await workersApi.setActive(worker.id, !worker.isActive);
      setWorker({ ...worker, isActive: !worker.isActive });
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(null); }
  };

  const save = async () => {
    if (!worker) return;
    setBusy('save'); setErr(null);
    try {
      // Uploaded first: a failure here must not half-save the rest of the form.
      const avatarUrl = photo ? (await workersApi.uploadPhoto(photo)).url : worker.avatarUrl ?? null;
      const updated = await workersApi.update(worker.id, {
        fullName: form.fullName.trim(),
        role: form.role.trim(),
        phone: form.phone.trim() || null,
        nationalId: form.nationalId.trim() || null,
        commissionRate: Math.max(0, Math.min(1, form.commissionRate)),
        avatarUrl,
      });
      setWorker(updated);
      setPhoto(null);
      setEditing(false);
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در ذخیره'); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="animate-spin text-brand-600" /></div>;
  if (!worker) return (
    <div className="max-w-3xl mx-auto pb-10">
      <Card><EmptyState icon={UserSquare2} title="کارمند یافت نشد" /></Card>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <Link to="/app/workers" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mb-3">
        <ChevronRight size={14} />بازگشت به لیست پرسنل
      </Link>

      <div className="mb-4 flex items-center gap-4">
        <WorkerAvatar
          src={photoPreview ?? resolveUploadUrl(worker.avatarUrl)}
          name={worker.fullName} size={72} rounded="2xl" />
        {editing && (
          <label className="cursor-pointer text-xs font-bold text-brand-600 hover:text-brand-700">
            {worker.avatarUrl || photo ? 'تغییر عکس پرسنلی' : 'افزودن عکس پرسنلی'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
            <span className="mt-0.5 block text-[10px] font-medium text-gray-400">JPG، PNG یا WEBP تا ۵ مگابایت</span>
          </label>
        )}
      </div>

      <PageHeader
        title={worker.fullName}
        subtitle={`${worker.role} • ${worker.isActive ? 'فعال' : 'غیرفعال'}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(v => !v)}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold inline-flex items-center gap-1.5">
              <Pencil size={13} />{editing ? 'انصراف' : 'ویرایش'}
            </button>
            <button onClick={toggleActive} disabled={busy === 'active'}
              className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 ${
                worker.isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'}`}>
              <Power size={13} />{worker.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
            </button>
          </div>
        }
      />

      {err && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="سفارش‌های بازه" value={toFa(myPerf?.orderCount ?? 0)} accent="sky" />
        <StatCard label="درآمد بازه" value={`${tomanNumber(myPerf?.revenueRials ?? 0)} تومان`} accent="emerald" />
        <StatCard label="کمیسیون بازه" value={`${tomanNumber(myPerf?.commissionRials ?? 0)} تومان`} accent="violet" />
        <StatCard label="نرخ کمیسیون" value={`${toFa(Math.round(worker.commissionRate * 100))}٪`} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <h3 className="font-extrabold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-brand-600" />عملکرد در بازه</h3>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <label className="text-xs text-gray-600 flex items-center gap-1">
              <Calendar size={12} />از:
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="rounded-lg border bg-white px-2 py-1 text-xs font-mono" />
            </label>
            <label className="text-xs text-gray-600 flex items-center gap-1">
              تا:
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="rounded-lg border bg-white px-2 py-1 text-xs font-mono" />
            </label>
            <div className="flex gap-1 mr-auto">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => { setFrom(daysAgo(d)); setTo(today()); }}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-[11px] font-bold">{toFa(d)} روز</button>
              ))}
            </div>
          </div>
          {!myPerf ? (
            <div className="text-center text-sm text-gray-500 py-10">داده‌ای برای این بازه ثبت نشده</div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white p-5 grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] text-gray-300">سفارش‌ها</div>
                <div className="text-2xl font-black mt-1">{toFa(myPerf.orderCount)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-300">درآمد کل (تومان)</div>
                <div className="text-2xl font-black mt-1 font-mono">{tomanNumber(myPerf.revenueRials)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-300">کمیسیون (تومان)</div>
                <div className="text-2xl font-black mt-1 font-mono text-emerald-300">{tomanNumber(myPerf.commissionRials)}</div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-extrabold text-gray-900 mb-3">اطلاعات کارمند</h3>
          {!editing ? (
            <div className="space-y-2 text-sm">
              <Row label="نام کامل" value={worker.fullName} />
              <Row label="نقش" value={worker.role} />
              <Row label="تلفن" value={worker.phone ?? '—'} mono />
              <Row label="کد ملی" value={worker.nationalId ?? '—'} mono />
              <Row label="نرخ کمیسیون" value={`${toFa(Math.round(worker.commissionRate * 100))}٪`} />
            </div>
          ) : (
            <div className="space-y-2">
              <Txt label="نام کامل" value={form.fullName} onChange={v => setForm({ ...form, fullName: v })} />
              <Txt label="نقش" value={form.role} onChange={v => setForm({ ...form, role: v })} />
              <Txt label="تلفن" value={form.phone} onChange={v => setForm({ ...form, phone: v })} mono />
              <Txt label="کد ملی" value={form.nationalId} onChange={v => setForm({ ...form, nationalId: v })} mono />
              <label className="block">
                <span className="block mb-1 text-[11px] text-gray-600">نرخ کمیسیون (٪)</span>
                <input type="number" min={0} max={100}
                  value={Math.round(form.commissionRate * 100)}
                  onChange={e => setForm({ ...form, commissionRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })}
                  className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-sm font-mono" />
              </label>
              <button disabled={busy === 'save'} onClick={save}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50">
                {busy === 'save' ? <Loader2 size={14} className="inline animate-spin" /> : 'ذخیره'}
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between py-1.5 border-b last:border-0 border-dashed">
    <span className="text-xs text-gray-500">{label}</span>
    <span className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

const Txt = ({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) => (
  <label className="block">
    <span className="block mb-1 text-[11px] text-gray-600">{label}</span>
    <input value={value} onChange={e => onChange(e.target.value)}
      className={`w-full bg-gray-50 border rounded-xl px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`} />
  </label>
);

export default WorkerDetailView;
