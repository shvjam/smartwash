import React, { useEffect, useState } from 'react';
import { UserPlus, Power, RotateCcw, Loader2, Shield, Check, UserCog } from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';
import { usersApi, type TenantUserDto, ApiException } from '../../api';
import { clsx } from 'clsx';

const ROLE_OPTIONS = [
  { value: 'tenant:owner',      label: 'مدیر ارشد',     desc: 'دسترسی کامل به همه امکانات' },
  { value: 'tenant:manager',    label: 'مدیر',           desc: 'مدیریت عملیات بدون billing و users' },
  { value: 'tenant:cashier',    label: 'صندوقدار',       desc: 'سفارش، مشتری، کیف پول، شیفت' },
  { value: 'tenant:operator',   label: 'اپراتور',        desc: 'جایگاه، سفارش، رزرو' },
  { value: 'tenant:accountant', label: 'حسابدار',        desc: 'گزارش، هزینه، billing' },
  { value: 'tenant:marketing',  label: 'بازاریابی',      desc: 'کمپین، مشتری، وفاداری' },
  { value: 'tenant:viewer',     label: 'مشاهده‌گر',      desc: 'فقط مشاهده گزارش و سفارش' },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));

const toFa = (s: string) => s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<TenantUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<TenantUserDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const reload = async () => {
    try { setUsers(await usersApi.list()); }
    catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری'); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const toggleActive = async (u: TenantUserDto) => {
    setBusy(u.id); setErr(null);
    try {
      await usersApi.setActive(u.id, !u.isActive);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
      flash(u.isActive ? 'کاربر غیرفعال شد' : 'کاربر فعال شد');
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(null); }
  };

  const handleResetPassword = async (u: TenantUserDto) => {
    const pwd = window.prompt(`رمز عبور جدید برای ${u.displayName} (حداقل ۸ کاراکتر):`);
    if (!pwd || pwd.length < 8) { if (pwd !== null) setErr('رمز عبور باید حداقل ۸ کاراکتر باشد'); return; }
    setBusy(`reset-${u.id}`); setErr(null);
    try {
      await usersApi.resetPassword(u.id, pwd);
      flash('رمز عبور بازنشانی شد');
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(null); }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10" dir="rtl">
      <PageHeader
        title="مدیریت کاربران"
        subtitle="دعوت، نقش‌بندی و مدیریت کارکنان کارواش"
        actions={
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors">
            <UserPlus size={16} />دعوت کاربر جدید
          </button>
        }
      />

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm">
          <Check size={16} />{successMsg}
        </div>
      )}
      {err && <div className="mb-4 border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-sm">{err}</div>}

      {loading ? (
        <div className="grid place-items-center min-h-[30vh]"><Loader2 className="animate-spin text-red-600" /></div>
      ) : users.length === 0 ? (
        <Card><EmptyState icon={UserPlus} title="کاربری ثبت نشده" hint="با دعوت کارکنان، آن‌ها می‌توانند وارد سیستم شوند." /></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="min-w-[720px] w-full text-right text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 font-bold text-gray-600 text-xs">کاربر</th>
                <th className="px-5 py-3 font-bold text-gray-600 text-xs">نقش</th>
                <th className="px-5 py-3 font-bold text-gray-600 text-xs">وضعیت</th>
                <th className="px-5 py-3 font-bold text-gray-600 text-xs">آخرین ورود</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-gray-900">{u.displayName}</div>
                    <div className="text-xs text-gray-500 font-mono">{u.email}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map(r => (
                        <span key={r} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                          {ROLE_LABEL[r] ?? r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold',
                      u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                      {u.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-500">{fmtDate(u.lastLoginAtUtc)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        disabled={busy === u.id}
                        onClick={() => toggleActive(u)}
                        title={u.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                        className={clsx('p-2 rounded-xl transition-colors text-xs',
                          u.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50')}>
                        <Power size={15} />
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => setEditRoleUser(u)}
                        title="تغییر نقش"
                        className="p-2 rounded-xl text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                        <UserCog size={15} />
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => handleResetPassword(u)}
                        title="بازنشانی رمز عبور"
                        className="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <RotateCcw size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); reload(); flash('کاربر جدید با موفقیت دعوت شد'); }}
        />
      )}
      {editRoleUser && (
        <ChangeRoleModal
          user={editRoleUser}
          onClose={() => setEditRoleUser(null)}
          onChanged={(userId, newRole) => {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: [newRole] } : u));
            setEditRoleUser(null);
            flash('نقش کاربر تغییر کرد');
          }}
        />
      )}
    </div>
  );
};

const InviteModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ email: '', displayName: '', phone: '', password: '', role: 'tenant:cashier' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!form.displayName.trim() || form.displayName.trim().length < 2) { setErr('نام باید حداقل ۲ کاراکتر باشد'); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) { setErr('ایمیل نامعتبر است'); return; }
    if (form.phone && !/^09\d{9}$/.test(form.phone.trim())) { setErr('شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود'); return; }
    if (form.password.length < 8) { setErr('رمز عبور باید حداقل ۸ کاراکتر باشد'); return; }
    if (!/[A-Z]/.test(form.password)) { setErr('رمز عبور باید حداقل یک حرف بزرگ داشته باشد'); return; }
    if (!/\d/.test(form.password)) { setErr('رمز عبور باید حداقل یک رقم داشته باشد'); return; }
    setLoading(true);
    try {
      await usersApi.invite({
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
        role: form.role,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در دعوت کاربر');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-3 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex min-h-full items-start justify-center sm:items-center">
        <div className="my-2 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:my-0 sm:p-8" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="invite-user-title">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <UserPlus size={20} />
          </div>
          <div>
            <h2 id="invite-user-title" className="font-extrabold text-gray-900">دعوت کاربر جدید</h2>
            <p className="text-xs text-gray-500">کاربر با ایمیل و رمز ساخته می‌شود</p>
          </div>
        </div>

        {err && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl">{err}</div>}

        <form onSubmit={submit} className="space-y-4">
          <Field label="نام و نام خانوادگی *" value={form.displayName} onChange={v => setForm({ ...form, displayName: v })} required autoComplete="off" />
          <Field label="ایمیل *" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" required dir="ltr" autoComplete="off" />
          <Field label="شماره تماس" value={form.phone} onChange={v => setForm({ ...form, phone: v })} dir="ltr" placeholder="09123456789" autoComplete="off" />
          <Field label="رمز عبور * (حداقل ۸ کاراکتر، یک حرف بزرگ، یک رقم)" value={form.password} onChange={v => setForm({ ...form, password: v })} type="password" required autoComplete="new-password" />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
              <Shield size={12} />نقش کاربری *
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLE_OPTIONS.map(r => (
                <label key={r.value} className={clsx(
                  'flex items-start gap-3 rounded-2xl border-2 p-3 cursor-pointer transition-all',
                  form.role === r.value ? 'bg-red-50 border-red-500' : 'bg-white border-gray-200 hover:border-gray-300'
                )}>
                  <input type="radio" value={r.value} checked={form.role === r.value}
                    onChange={() => setForm({ ...form, role: r.value })}
                    className="mt-0.5 accent-red-600" />
                  <div>
                    <div className="font-bold text-sm text-gray-900">{r.label}</div>
                    <div className="text-[11px] text-gray-500">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="sticky bottom-0 -mx-1 flex gap-2 border-t border-gray-100 bg-white px-1 pt-4 pb-1">
            <button type="button" onClick={onClose}
              className="px-4 py-3 rounded-2xl border border-gray-200 text-sm hover:bg-gray-50 transition-colors">
              انصراف
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 text-sm">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              دعوت کاربر
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

const ChangeRoleModal: React.FC<{ user: TenantUserDto; onClose: () => void; onChanged: (userId: string, newRole: string) => void }> = ({ user, onClose, onChanged }) => {
  const currentRole = user.roles[0] ?? 'tenant:cashier';
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (role === currentRole) { onClose(); return; }
    setLoading(true); setErr(null);
    try {
      // remove old roles, assign new one
      for (const r of user.roles) await usersApi.removeRole(user.id, r).catch(() => {});
      await usersApi.assignRole(user.id, role);
      onChanged(user.id, role);
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-3 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex min-h-full items-start justify-center sm:items-center">
        <div className="my-2 max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:my-0 sm:p-6" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="change-role-title">
        <h2 id="change-role-title" className="font-extrabold text-gray-900 mb-1">تغییر نقش</h2>
        <p className="text-xs text-gray-500 mb-4">{user.displayName} — {user.email}</p>
        {err && <div className="mb-3 bg-red-50 text-red-700 text-xs px-3 py-2 rounded-xl">{err}</div>}
        <div className="space-y-2 mb-5">
          {ROLE_OPTIONS.map(r => (
            <label key={r.value} className={clsx(
              'flex items-center gap-3 rounded-2xl border-2 p-3 cursor-pointer transition-all',
              role === r.value ? 'bg-red-50 border-red-500' : 'bg-white border-gray-200 hover:border-gray-300'
            )}>
              <input type="radio" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="accent-red-600" />
              <div>
                <div className="font-bold text-sm">{r.label}</div>
                <div className="text-[11px] text-gray-500">{r.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="sticky bottom-0 -mx-1 flex gap-2 border-t border-gray-100 bg-white px-1 pt-4 pb-1">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-2xl border border-gray-200 text-sm">انصراف</button>
          <button type="button" onClick={submit} disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-2xl text-sm flex items-center justify-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}ذخیره نقش
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, required, type = 'text', dir, placeholder, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; dir?: string; placeholder?: string; autoComplete?: string;
}) => (
  <label className="block">
    <span className="block text-xs font-medium text-gray-600 mb-1.5">{label}</span>
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      required={required} dir={dir as any} placeholder={placeholder} autoComplete={autoComplete}
      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
    />
  </label>
);

export default UsersView;
