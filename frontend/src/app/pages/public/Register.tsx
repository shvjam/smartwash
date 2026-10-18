import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, User, Mail, Phone, Lock, Sparkles, ArrowLeft, ArrowRight, Check, Shield, Eye, EyeOff,
} from 'lucide-react';
import { Logo, BRAND_NAME, BRAND_TAGLINE } from '../../components/Logo';
import { authApi, billingApi, ApiException } from '../../api';
import { useCarWash } from '../../store';
import { clsx } from 'clsx';

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9آ-ی\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[آ-ی]/g, ''); // keep only latin for tenant slug

export const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { reloadAll } = useCarWash();
  const [step, setStep] = useState<1 | 2>(1);
  // اگر از صفحه pricing آمده باشد، planId و cycle در URL هستند
  const planId = searchParams.get('planId') ?? null;
  const planCycle = parseInt(searchParams.get('cycle') ?? '0', 10); // 0=Monthly, 1=Yearly
  // The landing page's closing sentence asks for the carwash's name; carry it here so the
  // first thing a new owner sees is their own name already filled in.
  const [form, setForm] = useState({
    displayName: (searchParams.get('name') ?? '').slice(0, 120), slug: '',
    ownerDisplayName: '', ownerEmail: '', ownerPassword: '',
    // The landing's quick-start form asks for the mobile number too.
    ownerPhone: (searchParams.get('phone') ?? '').replace(/[^0-9]/g, '').slice(0, 11),
    acceptTerms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // password strength
  const pwStrength = (() => {
    const pw = form.ownerPassword;
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();
  const pwStrengthLabel = ['', 'خیلی ضعیف', 'ضعیف', 'متوسط', 'قوی', 'عالی'][pwStrength];
  const pwStrengthColor = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-600'][pwStrength];

  const update = (k: keyof typeof form, v: string | boolean) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'displayName' && typeof v === 'string' && !prev.slug) {
        next.slug = slugify(v) || prev.slug;
      }
      return next;
    });
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.displayName.trim()) return setError('نام کارواش الزامی است');
    if (!form.slug.trim() || !/^[a-z0-9-]{3,40}$/.test(form.slug)) return setError('نامک باید ۳ تا ۴۰ کاراکتر و فقط شامل حروف لاتین/عدد/خط تیره باشد');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.ownerDisplayName.trim()) return setError('نام شما الزامی است');
    if (!/^\S+@\S+\.\S+$/.test(form.ownerEmail)) return setError('ایمیل نامعتبر است');
    if (form.ownerPhone && !/^09\d{9}$/.test(form.ownerPhone.trim())) return setError('شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود');
    if (form.ownerPassword.length < 8) return setError('رمز عبور باید حداقل ۸ کاراکتر باشد');
    if (!/[A-Z]/.test(form.ownerPassword)) return setError('رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد');
    if (!/[0-9]/.test(form.ownerPassword)) return setError('رمز عبور باید حداقل یک رقم داشته باشد');
    if (!form.acceptTerms) return setError('باید شرایط استفاده را بپذیرید');

    setLoading(true);
    try {
      await authApi.registerTenant({
        displayName: form.displayName.trim(),
        slug: form.slug.trim().toLowerCase(),
        ownerDisplayName: form.ownerDisplayName.trim(),
        ownerEmail: form.ownerEmail.trim().toLowerCase(),
        ownerPhone: form.ownerPhone.trim(),
        ownerPassword: form.ownerPassword,
      });

      // اگر کاربر از صفحه pricing آمده، بعد از ثبت‌نام subscribe می‌شود
      if (planId) {
        try {
          await billingApi.subscribe(planId, planCycle);
        } catch {
          // subscribe نشد ولی ثبت‌نام موفق بود — کاربر بعداً می‌تواند از billing subscribe کند
        }
      }

      await reloadAll();
      navigate('/app/onboarding', { replace: true });
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'خطا در ثبت‌نام. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative grid lg:grid-cols-[1fr_440px] gap-8 w-full max-w-5xl"
      >
        {/* Side panel */}
        <div className="hidden lg:flex flex-col p-10 bg-gradient-to-br from-gray-900 via-gray-900 to-red-900 rounded-[2rem] text-white relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-red-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl" />
          <div className="relative">
            <Link to="/" className="flex items-center gap-3 mb-12">
              <Logo size={56} />
              <div>
                <div className="font-extrabold text-xl">{BRAND_NAME}</div>
                <div className="text-xs text-gray-400">{BRAND_TAGLINE}</div>
              </div>
            </Link>
            <h2 className="text-3xl font-black mb-4 leading-tight">با SmartWash همراه شوید</h2>
            <p className="text-gray-300 leading-8 mb-10 text-sm">
              کارواش‌تان را در کمتر از ۵ دقیقه راه‌اندازی کنید. هیچ نیازی به نصب نرم‌افزار، کارت بانکی یا تعهد ندارید.
            </p>
            <div className="space-y-4">
              {[
                { t: '۱۴ روز رایگان، بدون کارت بانکی' },
                { t: 'پیکربندی سریع و راهنمای گام‌به‌گام' },
                { t: 'پشتیبانی فارسی ۲۴/۷' },
                { t: 'انتقال داده‌ها از سیستم قبلی شما' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Check size={14} />
                  </div>
                  <span className="text-sm text-gray-200">{b.t}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-10">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <Shield size={12} />
                داده‌های شما با امنیت بالا روی سرورهای داخل ایران نگهداری می‌شود
              </div>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-white rounded-[2rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)] p-8 sm:p-10">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-6">
            <Logo size={44} />
            <span className="font-extrabold">{BRAND_NAME}</span>
          </Link>

          <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
            <span className={clsx('px-2 py-0.5 rounded-full font-bold', step === 1 ? 'bg-red-50 text-red-600' : 'bg-gray-100')}>گام ۱</span>
            <div className="flex-1 h-0.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={clsx('h-full bg-red-500 transition-all', step === 1 ? 'w-0' : 'w-full')} />
            </div>
            <span className={clsx('px-2 py-0.5 rounded-full font-bold', step === 2 ? 'bg-red-50 text-red-600' : 'bg-gray-100')}>گام ۲</span>
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-1 mt-5">
            {step === 1 ? 'اطلاعات کارواش' : 'حساب کاربری شما'}
          </h1>
          <p className="text-sm text-gray-500 mb-7">
            {step === 1 ? 'نام کارواش و نامک یکتای آن را وارد کنید.' : 'ایمیل و رمز عبور خود را برای ورود به سامانه تنظیم کنید.'}
          </p>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                onSubmit={handleNext} className="space-y-4"
              >
                <Field icon={Building2} label="نام کارواش" placeholder="کارواش پارس">
                  <input type="text" value={form.displayName} onChange={e => update('displayName', e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" />
                </Field>
                <Field icon={Sparkles} label="نامک یکتا (Tenant Slug)" placeholder="parsi" dir="ltr"
                  hint="با این نامک وارد سامانه می‌شوید. فقط حروف انگلیسی، عدد و خط تیره.">
                  <input type="text" value={form.slug} onChange={e => update('slug', e.target.value.toLowerCase())} required
                    dir="ltr"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" />
                </Field>
                <SubmitButton loading={false}>ادامه<ArrowLeft size={16} /></SubmitButton>
              </motion.form>
            ) : (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSubmit} className="space-y-4"
              >
                <Field icon={User} label="نام و نام خانوادگی" placeholder="علی محمدی">
                  <input type="text" value={form.ownerDisplayName} onChange={e => update('ownerDisplayName', e.target.value)} required
                    autoComplete="name" autoFocus
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" />
                </Field>
                <Field icon={Mail} label="ایمیل" placeholder="ali@example.com" dir="ltr">
                  <input type="email" value={form.ownerEmail} onChange={e => update('ownerEmail', e.target.value)} required dir="ltr"
                    autoComplete="email" inputMode="email"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" />
                </Field>
                <Field icon={Phone} label="شماره تماس" placeholder="09123456789" dir="ltr">
                  <input type="tel" value={form.ownerPhone} onChange={e => update('ownerPhone', e.target.value)} required dir="ltr"
                    autoComplete="tel" inputMode="tel" pattern="09[0-9]{9}"
                    title="شماره موبایل باید با ۰۹ شروع شده و ۱۱ رقم باشد"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" />
                </Field>
                <div>
                  <Field icon={Lock} label="رمز عبور" placeholder="حداقل ۸ کاراکتر، یک حرف بزرگ، یک رقم">
                    <input type={showPassword ? 'text' : 'password'} value={form.ownerPassword} onChange={e => update('ownerPassword', e.target.value)} required
                      autoComplete="new-password"
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" />
                    <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </Field>
                  {form.ownerPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= pwStrength ? pwStrengthColor : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-500">قدرت رمز: <b>{pwStrengthLabel}</b></span>
                    </div>
                  )}
                </div>
                <label className="flex items-start gap-3 cursor-pointer pt-2">
                  <input type="checkbox" checked={form.acceptTerms} onChange={e => update('acceptTerms', e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-red-600" />
                  <span className="text-xs text-gray-500 leading-6">
                    <a href="#" className="text-gray-900 font-bold">شرایط استفاده</a> و <a href="#" className="text-gray-900 font-bold">حریم خصوصی</a> SmartWash را خوانده‌ام و می‌پذیرم.
                  </span>
                </label>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="px-5 py-3.5 rounded-2xl border border-gray-200 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5">
                    <ArrowRight size={16} />قبلی
                  </button>
                  <SubmitButton loading={loading}>ساخت کارواش<ArrowLeft size={16} /></SubmitButton>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl border border-red-100 mt-4"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-xs text-gray-400 mt-6 text-center">
            از قبل حساب دارید؟{' '}
            <Link to="/login" className="text-red-600 font-bold hover:underline">ورود به سامانه</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const Field = ({ icon: Icon, label, hint, children, dir }: { icon: any; label: string; hint?: string; placeholder?: string; dir?: 'ltr' | 'rtl'; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-2">{label}</label>
    {/* dir is applied on the wrapper so it works whether there's one child (input) or many (input + toggle button) */}
    <div className="relative" dir={dir}>
      <Icon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
      {children}
    </div>
    {hint && <p className="text-[11px] text-gray-400 mt-1.5">{hint}</p>}
  </div>
);

const SubmitButton = ({ loading, children }: { loading: boolean; children: React.ReactNode }) => (
  <button type="submit" disabled={loading}
    className="flex-1 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all">
    {loading ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <>{children}</>}
  </button>
);

export default Register;
