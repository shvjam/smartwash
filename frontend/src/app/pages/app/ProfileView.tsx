import React, { useState } from 'react';
import { Shield, User, Lock, LogOut, X } from 'lucide-react';
import { useCarWash } from '../../store';
import { useNavigate } from 'react-router';
import { PageHeader, Card } from '../../components/app/PageHeader';
import { authApi, ApiException } from '../../api';

export const ProfileView = () => {
  const { user, logout } = useCarWash();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <PageHeader title="پروفایل من" subtitle="اطلاعات حساب کاربری و دسترسی‌ها" />

      <Card className="mb-4">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center font-black text-3xl">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-xl">{user.name}</div>
            <div className="text-sm text-gray-500 truncate">{user.username}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {user.isPlatformAdmin && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-bold">ادمین پلتفرم</span>}
              {user.role === 'admin' && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold">مدیر کارواش</span>}
              {user.role === 'user' && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">کاربر</span>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card>
          <h3 className="font-bold mb-3 flex items-center gap-2"><User size={16} />اطلاعات شخصی</h3>
          <Row label="نام" value={user.name} />
          <Row label="ایمیل" value={user.username} dir="ltr" />
          <Row label="شناسه کاربر" value={user.userId} dir="ltr" mono />
        </Card>
        <Card>
          <h3 className="font-bold mb-3 flex items-center gap-2"><Shield size={16} />دسترسی‌ها</h3>
          <div className="text-xs text-gray-500 mb-2">نقش‌ها و مجوزها در سامانه</div>
          <div className="flex flex-wrap gap-1.5">
            {user.permissions.length === 0 && <span className="text-xs text-gray-400">— دسترسی خاصی ثبت نشده —</span>}
            {user.permissions.slice(0, 12).map(p => (
              <span key={p} className="px-2 py-1 rounded-lg bg-gray-50 text-gray-700 text-[10px] font-mono" dir="ltr">{p}</span>
            ))}
            {user.permissions.length > 12 && <span className="px-2 py-1 rounded-lg bg-gray-50 text-gray-500 text-[10px]">+{user.permissions.length - 12} مورد دیگر</span>}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold mb-3 flex items-center gap-2"><Lock size={16} />امنیت</h3>
        <div className="space-y-2">
          <button onClick={() => setShowPwd(true)}
            className="w-full text-right p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium">
            تغییر رمز عبور
          </button>
          <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="w-full text-right p-4 rounded-2xl bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-sm font-bold flex items-center gap-2">
            <LogOut size={16} />خروج از همه دستگاه‌ها
          </button>
        </div>
      </Card>

      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}
    </div>
  );
};

const ChangePasswordModal = ({ onClose }: { onClose: () => void }) => {
  const [curr, setCurr] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!curr) { setErr('گذرواژه فعلی را وارد کنید.'); return; }
    if (next.length < 8) { setErr('گذرواژه جدید باید حداقل ۸ کاراکتر باشد.'); return; }
    if (!/[A-Z]/.test(next)) { setErr('گذرواژه جدید باید حداقل یک حرف بزرگ داشته باشد.'); return; }
    if (!/\d/.test(next)) { setErr('گذرواژه جدید باید حداقل یک رقم داشته باشد.'); return; }
    if (next !== confirm) { setErr('گذرواژه جدید و تکرار آن یکسان نیستند.'); return; }
    setLoading(true);
    try {
      await authApi.changeMyPassword(curr, next);
      setOk(true);
      setTimeout(onClose, 900);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'تغییر گذرواژه ناموفق بود.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2"><Lock size={18} />تغییر گذرواژه</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="گذرواژه فعلی" value={curr} onChange={setCurr} autoComplete="current-password" />
          <Field label="گذرواژه جدید" value={next} onChange={setNext} autoComplete="new-password" />
          <Field label="تکرار گذرواژه جدید" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {err && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-xl">{err}</div>}
          {ok && <div className="bg-emerald-50 text-emerald-700 text-xs px-3 py-2 rounded-xl">گذرواژه با موفقیت تغییر کرد.</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-3 rounded-2xl">
              {loading ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-3 rounded-2xl border border-gray-200 text-sm">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete?: string }) => (
  <label className="block">
    <span className="text-xs text-gray-600 mb-1.5 block">{label}</span>
    <input type="password" value={value} onChange={e => onChange(e.target.value)}
      autoComplete={autoComplete ?? 'new-password'}
      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300" />
  </label>
);

const Row = ({ label, value, dir, mono }: { label: string; value: string; dir?: 'ltr'; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <span className={`text-xs font-bold ${mono ? 'font-mono text-[10px]' : ''} ${dir === 'ltr' ? '' : ''} truncate`} dir={dir}>{value}</span>
  </div>
);

export default ProfileView;
