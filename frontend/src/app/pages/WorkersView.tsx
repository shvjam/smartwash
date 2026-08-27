import React, { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Trash2, UserPlus, ChevronLeft, Phone } from 'lucide-react';
import { useCarWash } from '../store';
import { workersApi } from '../api';
import { PageHeader, Card, EmptyState } from '../components/app/PageHeader';

export const WorkersView = () => {
  const { workers, addWorker, removeWorker } = useCarWash();
  const [showWorkerForm, setShowWorkerForm] = useState(false);

  const [workerForm, setWorkerForm] = useState({ name: '', role: 'متخصص شستشو', phone: '', commissionRate: 10 });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    const avatarUrl = avatarFile ? (await workersApi.uploadPhoto(avatarFile)).url : undefined;
    await addWorker({
      fullName: workerForm.name,
      role: workerForm.role,
      phone: workerForm.phone.trim() || undefined,
      commissionRate: (workerForm.commissionRate || 10) / 100, avatarUrl,
    });
    setAvatarFile(null);
    setWorkerForm({ name: '', role: 'متخصص شستشو', phone: '', commissionRate: 10 });
    setShowWorkerForm(false);
  };


  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader title="پرسنل" subtitle="مدیریت اطلاعات، نقش و کمیسیون کارکنان کارواش" />

      <Card className="p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">پرسنل ({workers.length})</h2>
            <button
              onClick={() => setShowWorkerForm(s => !s)}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            >
              <UserPlus size={14} /> افزودن پرسنل
            </button>
          </div>

          {showWorkerForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleAddWorker}
              className="p-5 bg-gray-50 border-b border-gray-100 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input required value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} placeholder="نام و نام خانوادگی" className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20" />
                <input value={workerForm.role} onChange={e => setWorkerForm({ ...workerForm, role: e.target.value })} placeholder="سمت (مثلاً: متخصص شستشو)" className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20" />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-red-200 bg-white p-3">
                <div className="size-11 overflow-hidden rounded-xl bg-red-50 text-center leading-[2.75rem] text-xs text-red-500">{avatarFile ? <img src={URL.createObjectURL(avatarFile)} className="h-full w-full object-cover" /> : 'عکس'}</div>
                <label className="cursor-pointer text-xs font-bold text-red-600">انتخاب عکس پرسنلی<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setAvatarFile(e.target.files?.[0] ?? null)} /></label><span className="text-[10px] text-gray-400">JPG، PNG یا WEBP تا ۵ مگابایت</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={workerForm.phone} onChange={e => setWorkerForm({ ...workerForm, phone: e.target.value })} placeholder="شماره تماس (اختیاری)" dir="ltr" className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20" />
                <div className="relative">
                  <input type="number" min="0" max="100" value={workerForm.commissionRate} onChange={e => setWorkerForm({ ...workerForm, commissionRate: Number(e.target.value) })} placeholder="کمیسیون (%)" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">٪</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-bold">ذخیره</button>
                <button type="button" onClick={() => setShowWorkerForm(false)} className="px-4 bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm">انصراف</button>
              </div>
            </motion.form>
          )}

          <div className="divide-y divide-gray-50">
            {workers.map(w => (
              <div key={w.id} className="p-4 flex items-center gap-3 group hover:bg-gray-50/50 transition-colors">
                <img src={w.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name)}&background=fee2e2&color=dc2626&bold=true`}
                  alt={w.name} className="w-11 h-11 rounded-2xl object-cover flex-shrink-0"
                  onError={e => { const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name)}&background=fee2e2&color=dc2626&bold=true`; if (e.currentTarget.src !== fb) e.currentTarget.src = fb; }} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 truncate">{w.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                    <span>{w.role}</span>
                    {w.phone && <span className="flex items-center gap-1"><Phone size={10} />{w.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/app/workers/${w.id}`}
                    className="text-gray-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-colors">
                    <ChevronLeft size={16} />
                  </Link>
                  <button onClick={() => removeWorker(w.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors">
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
