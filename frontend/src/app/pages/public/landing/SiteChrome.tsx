import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, X, ArrowLeft, Send, Instagram, Phone, ShieldCheck, Lock, Star } from 'lucide-react';
import clsx from 'clsx';
import { Container, Magnetic, fa } from '../../../components/landing/kit';

/**
 * The frame around the page: the bar that follows the reader down, and the footer.
 *
 * The bar starts transparent over the hero and turns to glass once the page has moved, because
 * the first screen should be the board and the headline, not navigation. The section links are
 * the page's own argument in order, so the menu doubles as a table of contents.
 */

const LINKS = [
  ['مسیر خودرو', 'journey'],
  ['امکانات', 'features'],
  ['حساب و کتاب', 'payback'],
  ['گزارش‌ها', 'reports'],
  ['پلن‌ها', 'plans'],
  ['سوال‌ها', 'faq'],
] as const;

const scrollTo = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export const SiteNav = () => {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState<string>('');
  const still = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Which section the reader is in, so the bar can say where they are.
  useEffect(() => {
    const spy = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setHere(e.target.id); }),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    LINKS.forEach(([, id]) => { const el = document.getElementById(id); if (el) spy.observe(el); });
    return () => spy.disconnect();
  }, []);

  return (
    <header className={clsx('sw-nav', solid && 'sw-nav-solid')}>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2" aria-label="SmartWash">
          <img src="/logo-mark.png" alt="" className="size-8 rounded-lg" />
          <span className="text-[15px] font-black tracking-tight text-slate-900" dir="ltr">Smart<span className="text-brand-600">Wash</span></span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([label, id]) => (
            <a
              key={id} href={`#${id}`} onClick={scrollTo(id)}
              className={clsx('sw-nav-link', here === id && 'sw-nav-link-on')}
            >
              {here === id && !still && (
                <motion.span layoutId="nav-dot" className="sw-nav-dot" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
              )}
              <span className="relative">{label}</span>
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:inline-flex sw-btn sw-btn-ghost sw-btn-sm">ورود</Link>
          <Magnetic strength={0.25}>
            <Link to="/register" className="sw-btn sw-btn-primary sw-btn-sm">
              <span>شروع رایگان</span>
              <ArrowLeft size={14} />
            </Link>
          </Magnetic>
          <button type="button" onClick={() => setOpen(v => !v)} className="sw-nav-burger lg:hidden" aria-label="منو" aria-expanded={open}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            className="sw-nav-sheet lg:hidden"
            initial={still ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={still ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={still ? { opacity: 0 } : { opacity: 0, height: 0 }}
          >
            <Container className="flex flex-col py-3">
              {LINKS.map(([label, id]) => (
                <a key={id} href={`#${id}`} onClick={e => { scrollTo(id)(e); setOpen(false); }} className="rounded-xl px-3 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50">
                  {label}
                </a>
              ))}
              <Link to="/login" className="rounded-xl px-3 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50">ورود به پنل</Link>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export const SiteFooter = () => (
  <footer className="border-t border-slate-200/70 bg-white/70 pb-8 pt-14">
    <Container>
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" className="size-8 rounded-lg" />
            <span className="text-[15px] font-black text-slate-900" dir="ltr">Smart<span className="text-brand-600">Wash</span></span>
          </div>
          <p className="mt-3 max-w-xs text-[12px] leading-7 text-slate-500">
            سامانه‌ی مدیریت کارواش و باشگاه مشتریان: از تابلوی جایگاه‌ها و صف رزرو تا تسویه‌ی پرسنل و گزارش‌های مالی.
          </p>
          <div className="mt-4 flex gap-2">
            {[
              { icon: <Send size={15} />, href: 'https://t.me/', label: 'تلگرام' },
              { icon: <Instagram size={15} />, href: 'https://instagram.com/', label: 'اینستاگرام' },
              { icon: <Phone size={15} />, href: 'tel:09000000000', label: 'تلفن' },
            ].map(s => (
              <a key={s.label} href={s.href} aria-label={s.label} className="sw-social">{s.icon}</a>
            ))}
          </div>
        </div>

        {[
          { title: 'محصول', links: [['امکانات', '#features'], ['مسیر خودرو', '#journey'], ['گزارش‌ها', '#reports'], ['پلن‌ها', '#plans']] },
          { title: 'دسترسی', links: [['ورود به پنل', '/login'], ['ثبت‌نام رایگان', '/register'], ['تعرفه‌ها', '/pricing'], ['تماس با ما', '/contact']] },
        ].map(col => (
          <div key={col.title}>
            <div className="mb-3 text-[12px] font-extrabold text-slate-900">{col.title}</div>
            <ul className="space-y-2">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('#')
                    ? <a href={href} onClick={scrollTo(href.slice(1))} className="text-[12px] text-slate-500 hover:text-brand-600">{label}</a>
                    : <Link to={href} className="text-[12px] text-slate-500 hover:text-brand-600">{label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <div className="mb-3 text-[12px] font-extrabold text-slate-900">تماس</div>
          <ul className="space-y-2 text-[12px] text-slate-500">
            <li><a href="tel:09000000000" dir="ltr" className="hover:text-brand-600">۰۹۰۰ ۰۰۰ ۰۰۰۰</a></li>
            <li><a href="mailto:info@appsmartwash.com" className="hover:text-brand-600">info@appsmartwash.com</a></li>
            <li>تهران، ایران</li>
            <li dir="ltr">appsmartwash.com</li>
          </ul>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6">
        <span className="text-[11px] text-slate-400">© {fa(1404)} SmartWash — تمامی حقوق محفوظ است.</span>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: <ShieldCheck size={12} />, label: 'سرور ایران' },
            { icon: <Lock size={12} />, label: 'ارتباط رمزنگاری‌شده' },
            { icon: <Star size={12} />, label: `${fa(98)}٪ رضایت` },
          ].map(b => (
            <span key={b.label} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[10.5px] font-bold text-slate-500">
              {b.icon}{b.label}
            </span>
          ))}
        </div>
      </div>
    </Container>
  </footer>
);
