import React, { useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ArrowLeft, Sparkles, Phone, Mail, MapPin, Instagram, Send } from 'lucide-react';
import { clsx } from 'clsx';
import { Logo, BRAND_NAME, BRAND_TAGLINE } from '../Logo';

const navLinks = [
  { to: '/', label: 'خانه', end: true },
  { to: '/features', label: 'امکانات' },
  { to: '/pricing', label: 'تعرفه‌ها' },
  { to: '/contact', label: 'تماس با ما' },
];

export const PublicLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (location.pathname === '/') {
    return <Outlet />;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#fafafa] text-gray-900 flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/75 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size={40} />
            <div className="hidden sm:block">
              <div className="font-extrabold tracking-tight text-gray-900 leading-none">{BRAND_NAME}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{BRAND_TAGLINE}</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => clsx(
                  'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                  isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 rounded-full text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              ورود
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] transition-all flex items-center gap-1.5"
            >
              <Sparkles size={14} />
              شروع رایگان
            </Link>
          </div>

          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-xl bg-gray-100 text-gray-700">
            <Menu size={20} />
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              key="pub-mobile-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50"
            />
          )}
          {mobileOpen && (
            <motion.aside
              key="pub-mobile-drawer"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="md:hidden fixed top-0 right-0 bottom-0 w-[85vw] max-w-[360px] bg-white z-50 flex flex-col p-6"
            >
              <div className="flex items-center justify-between mb-8">
                <Logo size={44} />
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl bg-gray-100">
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-1 flex-1">
                {navLinks.map(l => (
                  <NavLink
                    key={l.to} to={l.to} end={l.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => clsx(
                      'block px-4 py-3 rounded-2xl text-sm font-medium',
                      isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {l.label}
                  </NavLink>
                ))}
              </nav>
              <div className="space-y-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-center px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium">
                  ورود
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block text-center px-4 py-3 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white text-sm font-bold">
                  شروع رایگان
                </Link>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-900 text-gray-300 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Logo size={48} />
              <div>
                <div className="font-extrabold text-white text-lg">{BRAND_NAME}</div>
                <div className="text-xs text-gray-400">{BRAND_TAGLINE}</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-7 max-w-md">
              سامانه ابری مدیریت کارواش که جایگاه‌ها، رزروها، پرسنل، باشگاه مشتریان و حسابداری شما را در یک جا متمرکز می‌کند.
            </p>
          </div>
          <div>
            <div className="font-bold text-white mb-4 text-sm">محصول</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/features" className="hover:text-white transition-colors">امکانات</Link></li>
              <li><Link to="/pricing" className="hover:text-white transition-colors">تعرفه‌ها</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">ثبت‌نام</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">ورود</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-bold text-white mb-4 text-sm">ارتباط</div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Phone size={14} /><span dir="ltr">۰۲۱-۹۱۰۰۰۰۰۰</span></li>
              <li className="flex items-center gap-2"><Mail size={14} /><span dir="ltr">hello@smartwash.ir</span></li>
              <li className="flex items-center gap-2"><MapPin size={14} /><span>تهران، خیابان آزادی</span></li>
              <li className="flex items-center gap-3 pt-2">
                <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><Instagram size={16} /></a>
                <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"><Send size={16} /></a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-xs text-gray-500">© {new Date().getFullYear()} {BRAND_NAME}. تمامی حقوق محفوظ است.</div>
            <div className="text-xs text-gray-500 flex items-center gap-4">
              <a href="#" className="hover:text-white transition-colors">حریم خصوصی</a>
              <a href="#" className="hover:text-white transition-colors">شرایط استفاده</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const SectionHeading = ({ kicker, title, subtitle, center }: { kicker?: string; title: React.ReactNode; subtitle?: string; center?: boolean }) => (
  <div className={clsx('mb-12', center && 'text-center')}>
    {kicker && <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold mb-4"><Sparkles size={12} />{kicker}</div>}
    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.15] mb-3">{title}</h2>
    {subtitle && <p className={clsx('text-gray-500 text-base sm:text-lg leading-8', center && 'max-w-2xl mx-auto')}>{subtitle}</p>}
  </div>
);

export const CtaBanner = () => (
  <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-gray-900 via-gray-900 to-red-900 p-10 sm:p-14 text-center">
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-red-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-red-600/20 rounded-full blur-3xl" />
      <div className="relative">
        <h3 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">آماده‌اید کارواشتان را هوشمند کنید؟</h3>
        <p className="text-gray-300 mb-8 max-w-xl mx-auto leading-8">۱۴ روز رایگان امتحان کنید. بدون نیاز به کارت بانکی. بدون تعهد.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register" className="px-6 py-3.5 rounded-full bg-white text-gray-900 font-bold flex items-center justify-center gap-2 hover:scale-[1.03] transition-transform">
            شروع رایگان <ArrowLeft size={16} />
          </Link>
          <Link to="/pricing" className="px-6 py-3.5 rounded-full bg-white/10 text-white border border-white/20 font-medium hover:bg-white/15 transition-colors">
            مشاهده تعرفه‌ها
          </Link>
        </div>
      </div>
    </div>
  </section>
);

export default PublicLayout;
