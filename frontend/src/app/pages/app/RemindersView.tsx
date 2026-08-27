import React, { useEffect, useState } from 'react';
import { BellRing, Plus, X, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';
import { remindersApi, customersApi, ApiException } from '../../api';
import type { ReminderDto, ReminderStatus, ReminderType } from '../../api/modules';
import type { CustomerDto } from '../../api/types';

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });

const STATUS_META: Record<number, { label: string; cls: string }> = {
  0: { label: 'در انتظار', cls: 'bg-amber-100 text-amber-700' },
  1: { label: 'ارسال‌شده', cls: 'bg-emerald-100 text-emerald-700' },
  2: { label: 'لغو‌شده', cls: 'bg-gray-100 text-gray-600' },
};

const TYPE_META: Record<number, string> = {
  0: 'شستشوی بعدی',
  1: 'پولیش',
  2: 'دیتیلینگ',
  99: 'سفارشی',
};

export const RemindersView: React.FC = () => {
  const [items, setItems] = useState<ReminderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | ReminderStatus>(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async (p = page) => {
    setLoading(true); setErr(null);
    try {
      const r = await remindersApi.list({ status: status === '' ? undefined : status, page: p, pageSize: 25 });
      setItems(r.items);
      setTotalPages(r.totalPages || 1);
      setPage(r.page);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری');
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(1); }, [status]);

  const cancel = async (id: string) => {
    if (!confirm('یادآور لغو شود؟')) return;
    setBusy(id);
    try { await remindersApi.cancel(id); await reload(); }
    catch (e) { alert(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(null); }
  };

  const sendNow = async (id: string) => {
    if (!confirm('پیامک یادآور الان ارسال شود؟')) return;
    setBusy(id);
    try { await remindersApi.sendNow(id); await reload(); }
    catch (e) { alert(e instanceof ApiException ? e.message : 'خطا در ارسال پیامک'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="یادآور خدمات"
        subtitle="یادآورهای شستشو و خدمات بعدی مشتریان"
        actions={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2">
            <Plus size={16} /> یادآور جدید
          </button>
        }
      />

      <Card>
        <div className="flex gap-2 mb-4">
          {[
            { v: 0, l: 'در انتظار' },
            { v: 1, l: 'ارسال‌شده' },
            { v: 2, l: 'لغو‌شده' },
            { v: '', l: 'همه' },
          ].map(t => (
            <button key={String(t.v)} onClick={() => setStatus(t.v as any)}
              className={`px-3 py-1.5 rounded-lg border ${status === t.v ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 hover:bg-gray-50'}`}>
              {t.l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500"><Loader2 className="animate-spin" /></div>
        ) : err ? (
          <div className="py-10 text-center text-rose-600">{err}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={BellRing} title="یادآوری یافت نشد" hint="با کلیک روی «یادآور جدید» اولین یادآور را بسازید." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-right text-gray-500 text-sm border-b">
                <tr>
                  <th className="py-2 px-3">مشتری</th>
                  <th className="py-2 px-3">خودرو</th>
                  <th className="py-2 px-3">عنوان</th>
                  <th className="py-2 px-3">نوع</th>
                  <th className="py-2 px-3">سررسید</th>
                  <th className="py-2 px-3">وضعیت</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => {
                  const s = STATUS_META[r.status];
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-3">
                        <div>{r.customerName}</div>
                        <div className="text-xs text-gray-500">{toFa(r.customerPhone)}</div>
                      </td>
                      <td className="py-2 px-3 text-sm">{r.vehiclePlate ? toFa(r.vehiclePlate) : '—'}</td>
                      <td className="py-2 px-3">{r.title}</td>
                      <td className="py-2 px-3 text-sm">{TYPE_META[r.type]}</td>
                      <td className="py-2 px-3 text-sm">{fmtDateTime(r.dueAtUtc)}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="py-2 px-3 text-left">
                        {r.status === 0 && (
                          <div className="flex items-center gap-1">
                            <button disabled={busy === r.id} onClick={() => sendNow(r.id)}
                              className="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded text-sm disabled:opacity-50">
                              ارسال پیامک
                            </button>
                            <button disabled={busy === r.id} onClick={() => cancel(r.id)}
                              className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded text-sm disabled:opacity-50">
                              لغو
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 text-sm">
            <button onClick={() => reload(page - 1)} disabled={page <= 1} className="p-1 disabled:opacity-30"><ChevronRight size={16} /></button>
            <span>صفحه {toFa(page)} از {toFa(totalPages)}</span>
            <button onClick={() => reload(page + 1)} disabled={page >= totalPages} className="p-1 disabled:opacity-30"><ChevronLeft size={16} /></button>
          </div>
        )}
      </Card>

      {showCreate && <CreateReminderModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />}
    </div>
  );
};

const CreateReminderModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerDto[]>([]);
  const [selected, setSelected] = useState<CustomerDto | null>(null);
  const [vehicleId, setVehicleId] = useState<string>('');
  const [title, setTitle] = useState('یادآور شستشوی بعدی');
  const [type, setType] = useState<ReminderType>(0);
  const [dueAt, setDueAt] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); return; }
      try {
        const r = await customersApi.search({ search: query, page: 1, pageSize: 8 });
        setResults(r.items);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const submit = async () => {
    if (!selected) { setErr('یک مشتری انتخاب کنید'); return; }
    setSaving(true); setErr(null);
    try {
      await remindersApi.create({
        customerId: selected.id,
        vehicleId: vehicleId || null,
        title: title.trim(),
        dueAtUtc: new Date(dueAt).toISOString(),
        type,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ذخیره');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3>یادآور جدید</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {!selected ? (
          <div>
            <label className="block text-sm text-gray-600 mb-1">جستجوی مشتری</label>
            <div className="relative">
              <Search size={16} className="absolute right-3 top-3 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="نام یا شماره موبایل"
                className="w-full border rounded-lg px-3 py-2 pr-9" />
            </div>
            <div className="mt-2 max-h-60 overflow-y-auto">
              {results.map(c => (
                <button key={c.id} onClick={() => setSelected(c)}
                  className="w-full text-right p-2 hover:bg-gray-50 rounded flex justify-between items-center border-b">
                  <span>{c.fullName}</span>
                  <span className="text-xs text-gray-500">{toFa(c.phone)}</span>
                </button>
              ))}
              {results.length === 0 && query.length >= 2 && (
                <div className="text-sm text-gray-500 p-2">نتیجه‌ای یافت نشد</div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-violet-50 rounded">
              <div>
                <div>{selected.fullName}</div>
                <div className="text-xs text-gray-500">{toFa(selected.phone)}</div>
              </div>
              <button onClick={() => { setSelected(null); setVehicleId(''); }} className="text-sm text-violet-600">تغییر</button>
            </div>

            {selected.vehicles && selected.vehicles.length > 0 && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">خودرو (اختیاری)</label>
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  <option value="">— بدون خودرو خاص —</option>
                  {selected.vehicles.map(v => (
                    <option key={v.id} value={v.id}>{toFa(v.plate)} — {v.brand} {v.model}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-600 mb-1">نوع</label>
              <select value={type} onChange={e => setType(Number(e.target.value) as ReminderType)} className="w-full border rounded-lg px-3 py-2">
                <option value={0}>شستشوی بعدی</option>
                <option value={1}>پولیش</option>
                <option value={2}>دیتیلینگ</option>
                <option value={99}>سفارشی</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">عنوان</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">تاریخ سررسید</label>
              <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </div>

            {err && <div className="text-rose-600 text-sm">{err}</div>}

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">انصراف</button>
              <button onClick={submit} disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
