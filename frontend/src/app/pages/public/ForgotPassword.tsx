import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { KeyRound, ArrowRight, Mail, Phone, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { authApi, ApiException } from '../../api';
import { Logo, BRAND_NAME } from '../../components/Logo';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const isPhone = /^09\d{9}$/.test(emailOrPhone.trim());

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setInfo(null);
    if (!emailOrPhone.trim()) { setErr('شماره موبایل یا ایمیل را وارد کنید.'); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword(emailOrPhone.trim());
      setInfo(isPhone
        ? 'در صورت معتبر بودن، یک کد ۶ رقمی پیامک شد.'
        : 'در صورت معتبر بودن، یک کد ۶ رقمی به ایمیل شما ارسال شد.');
      setStep(2);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ارسال درخواست.');
    } finally { setLoading(false); }
  };

  const resetNow = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setInfo(null);
    if (code.trim().length !== 6) { setErr('کد ۶ رقمی را کامل وارد کنید.'); return; }
    if (newPassword.length < 8) { setErr('گذرواژه باید حداقل ۸ کاراکتر باشد.'); return; }
    if (newPassword !== confirm) { setErr('گذرواژه و تکرار آن یکسان نیستند.'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(emailOrPhone.trim(), code.trim(), newPassword);
      setInfo('گذرواژه با موفقیت تغییر کرد. در حال انتقال به ورود…');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'کد نامعتبر یا منقضی شده است.');
    } finally { setLoading(false); }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Logo size={48} />
          <div>
            <div className="font-extrabold text-lg text-gray-900">{BRAND_NAME}</div>
            <div className="text-xs text-gray-500">بازیابی گذرواژه</div>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={requestCode} className="space-y-4">
            <h1 className="font-extrabold text-2xl text-gray-900">گذرواژه‌تان را فراموش کرده‌اید؟</h1>
            <p className="text-sm text-gray-500 leading-7">
              شماره موبایل یا ایمیل حساب خود را وارد کنید. کد ۶ رقمی برای تغییر گذرواژه ارسال خواهد شد.
            </p>
            <label className="block">
              <span className="text-xs text-gray-600 mb-2 block">موبایل یا ایمیل</span>
              <div className="relative">
                {isPhone
                  ? <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  : <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />}
                <input value={emailOrPhone} onChange={e => setEmailOrPhone(e.target.value)} dir="ltr"
                  placeholder="09123456789 یا you@example.com"
                  autoComplete="email" autoFocus inputMode={isPhone ? 'tel' : 'email'}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pr-10 pl-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300" />
              </div>
            </label>
            {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-2xl">{err}</div>}
            {info && <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-2xl">{info}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
              {loading ? 'در حال ارسال…' : <>ارسال کد<ArrowRight size={16} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={resetNow} className="space-y-4">
            <h1 className="font-extrabold text-2xl text-gray-900 flex items-center gap-2">
              <ShieldCheck size={22} className="text-emerald-600" />تایید کد و گذرواژه جدید
            </h1>
            <p className="text-sm text-gray-500" dir="ltr">{emailOrPhone}</p>
            <label className="block">
              <span className="text-xs text-gray-600 mb-2 block">کد ۶ رقمی</span>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} dir="ltr"
                inputMode="numeric" maxLength={6}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600 mb-2 block">گذرواژه جدید</span>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password" minLength={8}
                  placeholder="حداقل ۸ کاراکتر، یک حرف بزرگ، یک رقم"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pr-10 pl-10 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300" />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600 mb-2 block">تکرار گذرواژه</span>
              <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={`w-full bg-gray-50 border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 ${confirm && newPassword !== confirm ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-red-300'}`} />
              {confirm && newPassword !== confirm && (
                <span className="text-xs text-red-600 mt-1 block">گذرواژه‌ها یکسان نیستند</span>
              )}
            </label>
            {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-2xl">{err}</div>}
            {info && <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-2xl">{info}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
              <KeyRound size={16} />{loading ? 'در حال ذخیره…' : 'ذخیره گذرواژه جدید'}
            </button>
            <button type="button" onClick={() => { setStep(1); setCode(''); setNewPassword(''); setConfirm(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-900">ارسال مجدد یا تغییر شناسه</button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-gray-100 text-center text-sm text-gray-500">
          <Link to="/login" className="text-red-600 hover:text-red-700 font-bold">بازگشت به ورود</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
