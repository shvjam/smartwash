import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, User, Lock, ArrowLeft, Sparkles, Building2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useCarWash } from '../store';
import { auth, API_CONFIG } from '../api';
import { Logo, BRAND_NAME, BRAND_TAGLINE } from '../components/Logo';

const DEMO_ACCOUNT = {
  email: 'demo@appsmartwash.com',
  password: 'Demo@1234',
  slug: 'demo-carwash',
};

type LoginMode = 'carwash' | 'platform';

const LoginScreen = ({ mode }: { mode: LoginMode }) => {
  const { login } = useCarWash();
  const navigate = useNavigate();
  const isPlatformLogin = mode === 'platform';
  const [tenantSlug, setTenantSlug] = useState(() => isPlatformLogin ? '' : localStorage.getItem(API_CONFIG.tenantSlugStorageKey) || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const signIn = async (credentials?: { email: string; password: string; slug?: string }) => {
    if (loading) return;
    const nextEmail = (credentials?.email ?? email).trim();
    const nextPassword = credentials?.password ?? password;
    const slug = isPlatformLogin ? '' : (credentials?.slug ?? tenantSlug).trim();

    if (!nextEmail || !nextPassword || (!isPlatformLogin && !slug)) {
      setError(isPlatformLogin ? 'ایمیل و رمز عبور را وارد کنید.' : 'نامک کارواش، ایمیل و رمز عبور را وارد کنید.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await login(nextEmail, nextPassword, slug);
      if (!result.ok) {
        setError(result.error ?? 'ورود انجام نشد؛ لطفاً اطلاعات را بررسی کنید.');
        return;
      }
      const currentUser = auth.getUser();
      if (isPlatformLogin && !currentUser?.isPlatformAdmin) {
        setError('این حساب دسترسی مدیر پلتفرم ندارد. از صفحه ورود کارواش استفاده کنید.');
        return;
      }
      navigate(currentUser?.isPlatformAdmin ? '/platform/tenants' : '/app/bays', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const signInWithDemo = () => {
    setTenantSlug(DEMO_ACCOUNT.slug);
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    void signIn(DEMO_ACCOUNT);
  };

  return (
    <div dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-4">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gray-500/10 blur-3xl" />
      </div>

      <motion.main
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)]"
      >
        <div className="p-6 sm:p-8 md:p-10">
          <Link to="/" aria-label="بازگشت به صفحه اصلی SmartWash" className="mb-8 flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-red-500">
            <Logo size={72} />
            <div>
              <div className="text-2xl font-extrabold tracking-tight text-gray-900">{BRAND_NAME}</div>
              <div className="text-xs text-gray-500">{BRAND_TAGLINE}</div>
            </div>
          </Link>

          <div className="mb-6">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              {isPlatformLogin ? <Shield size={19} /> : <Building2 size={19} />}
            </div>
            <h1 className="mb-1 text-2xl font-extrabold text-gray-900">
              {isPlatformLogin ? 'ورود مدیر پلتفرم' : 'ورود به کارواش'}
            </h1>
            <p className="text-sm leading-6 text-gray-500">
              {isPlatformLogin
                ? 'این بخش فقط برای مدیران سامانه SmartWash است.'
                : 'برای ورود به پنل کارواش، اطلاعات حساب خود را وارد کنید.'}
            </p>
          </div>

          {!isPlatformLogin && (
            <div className="mb-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs leading-6 text-gray-600">
              <div className="flex items-center gap-2 font-bold text-gray-800"><User size={15} className="text-red-600" />ورود مدیران و کارکنان کارواش</div>
              <p className="mt-1">نامک همان بخش کوتاه آدرس کارواش شماست که هنگام ثبت‌نام انتخاب کرده‌اید.</p>
            </div>
          )}

          <form onSubmit={(event) => { event.preventDefault(); void signIn(); }} className="space-y-4">
            {!isPlatformLogin && (
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">نامک کارواش</label>
                <div className="relative">
                  <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value.toLowerCase().trim())} required placeholder="مثلاً: carwash-sadra" dir="ltr" autoComplete="organization" spellCheck={false} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-12 py-3.5 text-left focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700">ایمیل حساب کاربری</label>
              <div className="relative">
                <User className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="email@example.com" dir="ltr" autoComplete="email" inputMode="email" autoFocus className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-12 py-3.5 text-left focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700">رمز عبور حساب</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="رمز عبور خود را وارد کنید" autoComplete="current-password" className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-12 py-3.5 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>

            <AnimatePresence>{error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</motion.div>}</AnimatePresence>

            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 py-3.5 font-bold text-white shadow-lg shadow-red-500/30 transition-all hover:from-red-600 hover:to-red-800 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <><span>{isPlatformLogin ? 'ورود به پنل مدیریت' : 'ورود به پنل کارواش'}</span><ArrowLeft size={18} /></>}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs">
            <Link to="/forgot-password" className="font-bold text-red-600 hover:text-red-700">فراموشی گذرواژه؟</Link>
            {!isPlatformLogin && <Link to="/register" className="text-gray-500 hover:text-gray-900">ساخت حساب کارواش</Link>}
            {isPlatformLogin && <Link to="/login" className="text-gray-500 hover:text-gray-900">بازگشت به ورود کارواش</Link>}
          </div>

          {!isPlatformLogin && <>
            <button type="button" disabled={loading} onClick={signInWithDemo} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-red-200 bg-red-50/50 px-4 py-3 text-xs font-bold text-red-700 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-300 border-t-red-700" /> : <Sparkles size={14} />}
              ورود سریع به کارواش آزمایشی
            </button>
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-gray-400"><CheckCircle2 size={12} />ورود به پنل نمونهٔ کارواش با داده‌های آزمایشی</p>
            <div className="mt-6 border-t border-gray-100 pt-4 text-center">
              <Link to="/platform/login" className="text-[11px] text-gray-400 transition-colors hover:text-gray-700">ورود مدیر پلتفرم</Link>
            </div>
          </>}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 text-center sm:px-8 md:px-10"><p className="text-[11px] text-gray-400">با ورود به سامانه، شرایط استفاده و حریم خصوصی SmartWash را می‌پذیرید.</p></div>
      </motion.main>
    </div>
  );
};

export const LoginView = () => <LoginScreen mode="carwash" />;
export const PlatformLoginView = () => <LoginScreen mode="platform" />;
export default LoginView;
