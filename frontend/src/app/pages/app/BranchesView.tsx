import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Building2, Star, MapPin, Phone, Power, Pencil, X, Car, Wrench } from 'lucide-react';
import { branchesApi, baysApi, type BranchDto, type BayDto, ApiException } from '../../api';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';

const emptyForm = () => ({ name: '', address: '', phone: '', isDefault: false });

export const BranchesView = () => {
  const [list, setList] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchDto | null>(null);
  const [bays, setBays] = useState<BayDto[]>([]);
  const [bayName, setBayName] = useState('جایگاه شست‌وشو');
  const [bayNumber, setBayNumber] = useState(1);

  const reload = async () => {
    try { setList(await branchesApi.list(false)); } catch { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);
  const loadBays = async (branch: BranchDto) => { setSelectedBranch(branch); setBays(await baysApi.list(branch.id)); setBayNumber((await baysApi.list(branch.id)).length + 1); };

  const openCreate = () => { setMode('create'); setEditingId(null); setForm(emptyForm()); setErr(null); };
  const openEdit = (b: BranchDto) => {
    setMode('edit'); setEditingId(b.id);
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '', isDefault: b.isDefault });
    setErr(null);
  };
  const closeForm = () => { setMode('none'); setEditingId(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      if (mode === 'create') {
        await branchesApi.create({ name: form.name.trim(), address: form.address.trim() || null, phone: form.phone.trim() || null, isDefault: form.isDefault });
      } else if (mode === 'edit' && editingId) {
        await branchesApi.update(editingId, { name: form.name.trim(), address: form.address.trim() || null, phone: form.phone.trim() || null });
        if (form.isDefault) await branchesApi.setDefault(editingId);
      }
      closeForm();
      reload();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ثبت شعبه');
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="شعبه‌ها"
        subtitle="مدیریت شعبه‌های کارواش — ویرایش، فعال‌سازی و تعیین پیش‌فرض"
        actions={
          <button onClick={openCreate}
            className="bg-gradient-to-br from-red-500 to-red-700 text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-red-500/30">
            <Plus size={16} />شعبه جدید
          </button>
        }
      />

      {selectedBranch && (
        <Card className="mb-6 border-red-100 bg-red-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h3 className="font-extrabold">مدیریت جایگاه‌های «{selectedBranch.name}»</h3><p className="text-xs text-gray-500 mt-1">تعداد، نام و وضعیت جایگاه‌ها را از اینجا کنترل کنید.</p></div><button onClick={() => setSelectedBranch(null)} className="text-xs text-gray-500">بستن</button></div>
          <form onSubmit={async e => { e.preventDefault(); try { await baysApi.create({ branchId: selectedBranch.id, name: bayName.trim() || `جایگاه ${bayNumber}`, number: bayNumber }); await loadBays(selectedBranch); } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در ایجاد جایگاه'); } }} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_auto] gap-2 mb-4">
            <input value={bayName} onChange={e => setBayName(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" placeholder="نوع یا نام جایگاه؛ مثلاً اتوماتیک" />
            <input value={bayNumber} onChange={e => setBayNumber(Number(e.target.value) || 1)} type="number" min="1" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <button className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"><Plus size={15} className="inline ml-1" />افزودن</button>
          </form>
          {err && <p className="mb-3 text-xs text-red-600">{err}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{bays.map(b => <div key={b.id} className="flex items-center justify-between rounded-2xl bg-white border border-gray-100 p-3"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600"><Car size={17}/></span><div><b className="text-sm">{b.name}</b><p className="text-[11px] text-gray-500">جایگاه {b.number}</p></div></div><button onClick={async () => { await baysApi.maintenance(b.id, 'غیرفعال‌سازی از پنل مدیریت'); await loadBays(selectedBranch); }} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50" title="تعمیرات"><Wrench size={16}/></button></div>)}</div>
        </Card>
      )}

      {mode !== 'none' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{mode === 'create' ? 'شعبه جدید' : 'ویرایش شعبه'}</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-gray-600 mb-2 block">نام شعبه</span>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-gray-600 mb-2 block">نشانی</span>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-2 block">تلفن</span>
                <input dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                  className="w-4 h-4 accent-red-600" />
                <span className="text-sm">شعبه پیش‌فرض</span>
              </label>
              {err && <div className="sm:col-span-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{err}</div>}
              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" disabled={busy} className="bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold disabled:opacity-60">
                  {busy ? '…' : 'ذخیره'}
                </button>
                <button type="button" onClick={closeForm} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-sm">انصراف</button>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-10">در حال بارگذاری…</div>
      ) : list.length === 0 ? (
        <EmptyState icon={Building2} title="هنوز شعبه‌ای ثبت نشده" hint="برای شروع، اولین شعبه‌تان را اضافه کنید." />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(b => (
            <Card key={b.id} className="group hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div className="flex items-center gap-2">
                  {b.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                      <Star size={10} className="fill-amber-500 text-amber-500" />پیش‌فرض
                    </span>
                  )}
                  <button onClick={() => openEdit(b)}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all" title="ویرایش شعبه">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              <div className="font-extrabold text-lg mb-1">{b.name}</div>
              {b.address && <div className="text-xs text-gray-500 mb-2 flex items-center gap-1.5"><MapPin size={12} />{b.address}</div>}
              {b.phone && <div className="text-xs text-gray-500 flex items-center gap-1.5" dir="ltr"><Phone size={12} />{b.phone}</div>}
              <button onClick={() => loadBays(b)}
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition-colors">
                <Car size={14} /> مدیریت جایگاه‌های این شعبه
              </button>
              <div className="flex items-center gap-2 mt-3 pt-4 border-t border-gray-50">
                {!b.isDefault && (
                  <button onClick={() => branchesApi.setDefault(b.id).then(reload)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-bold hover:bg-amber-100">
                    تعیین به‌عنوان پیش‌فرض
                  </button>
                )}
                <button onClick={() => branchesApi.setActive(b.id, !b.isActive).then(reload)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-gray-50 text-gray-700 font-bold hover:bg-gray-100 flex items-center gap-1">
                  <Power size={12} />{b.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchesView;
