import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Trash2, UserPlus, ChevronLeft, Phone, Pencil } from 'lucide-react';
import { useCarWash } from '../store';
import { workersApi } from '../api';
import { PageHeader, Card, EmptyState } from '../components/app/PageHeader';
import { WorkerAvatar } from '../components/WorkerAvatar';

export const WorkersView = () => {
  const { workers, addWorker, removeWorker, reloadAll } = useCarWash();
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  // null while adding; the worker's id while editing. The API has supported PUT all along —
  // only the screen was missing, so a typo in a name meant deleting the person and re-adding.
  const [editingId, setEditingId] = useState<string | null>(null);

  const [workerForm, setWorkerForm] = useState({ name: '', role: 'متخصص شستشو', phone: '', commissionRate: 10 });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarPreview = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile]);
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  const resetForm = () => {
    setAvatarFile(null);
    setWorkerForm({ name: '', role: 'متخصص شستشو', phone: '', commissionRate: 10 });
    setEditingId(null);
    setShowWorkerForm(false);
  };

  const startEdit = (w: { id: string; name: string; role: string; phone?: string; commissionRate?: number }) => {
    setEditingId(w.id);
    setWorkerForm({
      name: w.name,
      role: w.role,
      phone: w.phone ?? '',
      // Stored as a fraction, shown as a percentage.
      commissionRate: Math.round((w.commissionRate ?? 0.1) * 100),
    });
    setAvatarFile(null);
    setShowWorkerForm(true);
  };

  const handleSubmitWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    const avatarUrl = avatarFile ? (await workersApi.uploadPhoto(avatarFile)).url : undefined;
    const payload = {
      fullName: workerForm.name,
      role: workerForm.role,
      phone: workerForm.phone.trim() || undefined,
      commissionRate: (workerForm.commissionRate || 10) / 100,
      avatarUrl,
    };
    if (editingId) {
      await workersApi.update(editingId, payload);
      await reloadAll();
    } else {
      await addWorker(payload);
    }
    resetForm();
  };


  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader title="پرسنل" subtitle="مدیریت اطلاعات، نقش و کمیسیون کارکنان کارواش" />

      <Card className="p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">پرسنل ({workers.length})</h2>
            <button
              onClick={() => (showWorkerForm ? resetForm() : setShowWorkerForm(true))}
              className="flex items-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            >
              <UserPlus size={14} /> افزودن پرسنل
            </button>
          </div>

          {showWorkerForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleSubmitWorker}
              className="p-5 bg-gray-50 border-b border-gray-100 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input required value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} placeholder="نام و نام خانوادگی" className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                <input value={workerForm.role} onChange={e => setWorkerForm({ ...workerForm, role: e.target.value })} placeholder="سمت (مثلاً: متخصص شستشو)" className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand-200 bg-white p-3">
                <WorkerAvatar src={avatarPreview} name={workerForm.name} size={44} rounded="xl" />
                <label className="cursor-pointer text-xs font-bold text-brand-600">انتخاب عکس پرسنلی<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setAvatarFile(e.target.files?.[0] ?? null)} /></label><span className="text-[10px] text-gray-400">JPG، PNG یا WEBP تا ۵ مگابایت</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={workerForm.phone} onChange={e => setWorkerForm({ ...workerForm, phone: e.target.value })} placeholder="شماره تماس (اختیاری)" dir="ltr" className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                <div className="relative">
                  <input type="number" min="0" max="100" value={workerForm.commissionRate} onChange={e => setWorkerForm({ ...workerForm, commissionRate: Number(e.target.value) })} placeholder="کمیسیون (%)" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">٪</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-xl text-sm font-bold">{editingId ? 'ذخیره تغییرات' : 'ذخیره'}</button>
                <button type="button" onClick={resetForm} className="px-4 bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm">انصراف</button>
              </div>
            </motion.form>
          )}

          <div className="divide-y divide-gray-50">
            {workers.map(w => (
              <div key={w.id} className="p-4 flex items-center gap-3 group hover:bg-gray-50/50 transition-colors">
                <WorkerAvatar src={w.avatar} name={w.name} size={44} rounded="2xl" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 truncate">{w.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                    <span>{w.role}</span>
                    {w.phone && <span className="flex items-center gap-1"><Phone size={10} />{w.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/app/workers/${w.id}`}
                    className="text-gray-400 hover:text-brand-600 p-2 rounded-xl hover:bg-brand-50 transition-colors">
                    <ChevronLeft size={16} />
                  </Link>
                  <button onClick={() => startEdit(w)} title="ویرایش"
                    className="text-gray-400 hover:text-brand-600 p-2 rounded-xl hover:bg-brand-50 transition-colors">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => removeWorker(w.id)} title="حذف" className="text-gray-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {workers.length === 0 && (
              <div className="p-4">
                <EmptyState icon={UserPlus} title="هنوز پرسنلی ثبت نشده" hint="اولین کارمند خود را اضافه کنید." />
              </div>
            )}
          </div>
        </Card>
    </div>
  );
};
