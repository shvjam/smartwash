import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MotionConfig, motion } from 'motion/react';
import {
  ArrowLeft, BarChart3, CalendarClock, LayoutGrid, Menu, MessageSquare, Users, Wallet, X,
} from 'lucide-react';
import { publicPlansApi, PlanBillingModel, type PlanDto } from '../../api';
import { tomanNumber } from '../../lib/money';
import { Logo, BRAND_NAME } from '../../components/Logo';

/**
 * The public home page. Deliberately plain: it says what the product is, what it covers, how
 * to start, what it costs and what people usually ask — in that order, once each.
 *
 * Copy rules: every claim is something the product does today. No customer counts, no
 * testimonials, no figures that are not read from the server. Prices come from billing on
 * every visit, so this page can never quote a stale one.
 *
 * Photos are from Unsplash (Unsplash License: free for commercial use, no attribution required),
 * saved at 800 and 1600 px wide in /assets/photos:
 *   hero   — unsplash.com/photos/9U-Tgk61K7Y
 *   team   — unsplash.com/photos/ci7gkM_29wA
 *   tunnel — unsplash.com/photos/9gvFjMVS9A0
 */

const PHOTO = (name: string) => ({
  src: `/assets/photos/${name}-1600.webp`,
  srcSet: `/assets/photos/${name}-800.webp 800w, /assets/photos/${name}-1600.webp 1600w`,
});

const NAV = [
  { href: '#features', label: 'امکانات' },
  { href: '#start', label: 'شروع کار' },
  { href: '#pricing', label: 'قیمت' },
  { href: '#faq', label: 'سوالات' },
];

const FEATURES = [
  {
    icon: LayoutGrid, title: 'جایگاه‌ها',
    body: 'روی هر جایگاه می‌بینید چه خودرویی هست و کار به کدام مرحله رسیده: پذیرش، شستشو، خشک‌کردن، تحویل.',
  },
  {
    icon: CalendarClock, title: 'رزرو و صف',
    body: 'رزرو تلفنی یا حضوری با ساعتش ثبت می‌شود. اگر جایگاه پر باشد، رزرو به نوبت در صف می‌ماند.',
  },
  {
    icon: Wallet, title: 'صندوق و شیفت',
    body: 'پرداخت نقدی، کارتی و کیف پول در شیفت ثبت می‌شود. خودرو تا تسویه نشود تحویل نمی‌شود.',
  },
  {
    icon: Users, title: 'پرسنل و کمیسیون',
    body: 'سهم و انعام هر نفر روی همان سفارش حساب می‌شود و آخر دوره با یک دکمه تسویه می‌شود.',
  },
  {
    icon: MessageSquare, title: 'باشگاه مشتریان و پیامک',
    body: 'پرونده‌ی هر مشتری با پلاکش. هر سه مراجعه یک شستشوی رایگان، یادآور شستشو و کمپین پیامکی.',
  },
  {
    icon: BarChart3, title: 'گزارش‌ها',
    body: 'درآمد، هزینه و سود هر ماه، و کارکرد هر جایگاه و هر نفر از پرسنل.',
  },
];

const STEPS = [
  { title: 'ثبت‌نام', body: 'نام کارواش، نام خودتان و شماره‌ی تماس. کارت بانکی لازم نیست.' },
  { title: 'تعریف کارواش', body: 'شعبه، جایگاه‌ها و خدمات را وارد می‌کنید. راهنمای شروع قدم‌به‌قدم همراهتان است.' },
  { title: 'اولین پذیرش', body: 'پلاک خودرو را وارد کنید و جایگاه را انتخاب کنید. از اینجا همه‌چیز روی پنل است.' },
];

const FAQ = [
  {
    q: 'نصب یا دستگاه خاصی لازم است؟',
    a: 'نه. پنل در مرورگر باز می‌شود؛ روی رایانه‌ی پذیرش، تبلت یا گوشی. می‌شود آن را مثل یک برنامه روی صفحه‌ی گوشی نصب کرد.',
  },
  {
    q: 'بعد از چهارده روز چه می‌شود؟',
    a: 'اگر اشتراک نخرید، حساب سه روز در مهلت می‌ماند و بعد غیرفعال می‌شود. اطلاعاتتان پاک نمی‌شود و با خرید اشتراک برمی‌گردد.',
  },
  {
    q: 'پرسنل هر کدام حساب جدا دارند؟',
    a: 'بله. مالک، مدیر، صندوقدار، اپراتور، حسابدار و بازاریابی نقش‌های جدا دارند و هر کس فقط بخش‌های مربوط به کارش را می‌بیند.',
  },
  {
    q: 'پیامک‌ها از کجا ارسال می‌شوند؟',
    a: 'از سامانه‌ی پیامکی خود پلتفرم. سهمیه‌ی ماهانه در پلن است و لازم نیست جداگانه پنل پیامکی بخرید.',
  },
  {
    q: 'اگر اینترنت قطع شود چه؟',
    a: 'پنل برای ثبت سفارش به اینترنت نیاز دارد. وقتی اتصال برگردد، پنل با آخرین وضعیت جایگاه‌ها همگام می‌شود.',
  },
  {
    q: 'اطلاعات کارواش من را چه کسی می‌بیند؟',
    a: 'فقط کاربران خود کارواش. داده‌ی هر کارواش جداست و هیچ کارواش دیگری به آن دسترسی ندارد.',
  },
];

const wrap = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

/** A section's content rising into place once, as it comes into view. */
const Reveal = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-10% 0px' }}
    transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
  >
    {children}
  </motion.div>
);
const btnPrimary =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gray-950 px-6 text-[15px] font-bold text-white transition-colors hover:bg-gray-800';
const btnGhost =
  'inline-flex h-12 items-center justify-center rounded-full px-5 text-[15px] font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950';

/* ── header ──────────────────────────────────────────────────────────────── */

const Header = () => {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur">
      <div className={`${wrap} flex h-16 items-center justify-between`}>
        <Link to="/" className="flex items-center gap-2.5" aria-label={`${BRAND_NAME}، صفحه‌ی اصلی`}>
          <Logo size={32} />
          <span className="text-[17px] font-extrabold text-gray-950">{BRAND_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="بخش‌های صفحه">
          {NAV.map(n => (
            <a key={n.href} href={n.href} className="rounded-full px-4 py-2 text-[15px] text-gray-600 hover:bg-gray-100 hover:text-gray-950">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-1 md:flex">
          <Link to="/login" className={btnGhost + ' !h-10'}>ورود</Link>
          <Link to="/register" className={btnPrimary + ' !h-10 !px-5'}>شروع رایگان</Link>
        </div>
        <button type="button" className="rounded-full p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'بستن منو' : 'باز کردن منو'}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="bg-white shadow-[0_12px_24px_-12px_rgb(0_0_0/0.15)] md:hidden">
          <nav className={`${wrap} flex flex-col py-3`} aria-label="بخش‌های صفحه">
            {NAV.map(n => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-[16px] text-gray-800 hover:bg-gray-50">
                {n.label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 pt-2">
              <Link to="/login" className="inline-flex h-12 items-center justify-center rounded-full bg-gray-100 text-[15px] font-medium">ورود</Link>
              <Link to="/register" className={btnPrimary}>شروع رایگان</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

/* ── sections ────────────────────────────────────────────────────────────── */

const Hero = () => (
  <section className={`${wrap} pb-16 pt-10 sm:pt-16 lg:pb-24 lg:pt-20`}>
    <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
      <h1 className="text-[2.5rem] font-extrabold leading-[1.2] text-gray-950 [text-wrap:balance] sm:text-6xl lg:col-span-7 lg:text-[4.5rem]">
        کارواشتان را از یک پنل اداره کنید.
      </h1>
      <div className="lg:col-span-5 lg:pb-2">
        <p className="max-w-[46ch] text-lg leading-9 text-gray-600">
          پذیرش خودرو، جایگاه‌ها، رزرو، صندوق و سهم پرسنل در یک سامانه‌ی ساده؛ روی کامپیوتر، تبلت و گوشی.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to="/register" className={btnPrimary}>
            شروع ۱۴ روز رایگان <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <a href="#pricing" className={btnGhost}>دیدن قیمت‌ها</a>
        </div>
        <p className="mt-4 text-[15px] text-gray-500">بدون کارت بانکی · بدون نصب برنامه</p>
      </div>
    </div>
    <img
      {...PHOTO('hero')}
      sizes="(min-width: 1152px) 1088px, 100vw"
      width={1600} height={1067}
      alt="کارگر کارواش در حال شستن یک خودروی سفید در جایگاه"
      fetchPriority="high"
      className="mt-12 aspect-[4/3] w-full rounded-3xl object-cover object-[50%_60%] sm:aspect-[16/9] lg:mt-16 lg:aspect-[21/9]"
    />
  </section>
);

const Features = () => (
  <section id="features" className="scroll-mt-16 py-20 sm:py-28">
    <Reveal className={wrap}>
      <h2 className="max-w-2xl text-3xl font-extrabold leading-[1.35] text-gray-950 [text-wrap:balance] sm:text-[2.75rem]">
        کارهای هر روز کارواش، در یک جا
      </h2>
      <div className="mt-14 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-900">
              <Icon size={20} aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-gray-950">{title}</h3>
            <p className="mt-2 max-w-[42ch] text-[16px] leading-8 text-gray-600">{body}</p>
          </div>
        ))}
      </div>
    </Reveal>
  </section>
);

const Start = () => (
  <section id="start" className="scroll-mt-16 bg-gray-50 py-20 sm:py-24">
    <div className={`${wrap} grid items-center gap-12 lg:grid-cols-2 lg:gap-16`}>
      <img
        {...PHOTO('team')}
        sizes="(min-width: 1024px) 540px, 100vw"
        width={1600} height={1067}
        alt="دو کارگر کارواش در حال شستن یک خودروی شاسی‌بلند"
        loading="lazy" decoding="async"
        className="aspect-[4/3] w-full rounded-3xl object-cover lg:order-2"
      />
      <Reveal className="lg:order-1">
        <h2 className="text-3xl font-extrabold leading-[1.35] text-gray-950 [text-wrap:balance] sm:text-[2.75rem]">در سه قدم راه می‌افتید</h2>
        <ol className="mt-10 space-y-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-[15px] font-bold text-white">
                {(i + 1).toLocaleString('fa-IR')}
              </span>
              <div>
                <h3 className="text-xl font-bold text-gray-950">{s.title}</h3>
                <p className="mt-1.5 max-w-[46ch] text-[16px] leading-8 text-gray-600">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link to="/register" className={btnPrimary + ' mt-10'}>
          ثبت‌نام رایگان <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </Reveal>
    </div>
  </section>
);

/** One plan's headline price, the way the pricing page states it. */
const PlanPrice = ({ plan }: { plan: PlanDto }) => {
  if (plan.monthlyPriceRials > 0) {
    return (
      <p>
        <span className="text-3xl font-extrabold text-gray-950 tabular-nums">{tomanNumber(plan.monthlyPriceRials)}</span>
        <span className="mr-1.5 text-sm text-gray-500">تومان در ماه</span>
      </p>
    );
  }
  if (plan.perCarPriceRials > 0) {
    return (
      <p>
        <span className="text-3xl font-extrabold text-gray-950 tabular-nums">{tomanNumber(plan.perCarPriceRials)}</span>
        <span className="mr-1.5 text-sm text-gray-500">تومان برای هر خودرو</span>
      </p>
    );
  }
  return <p className="text-2xl font-extrabold text-gray-950">تماس بگیرید</p>;
};

const Pricing = () => {
  const [plans, setPlans] = useState<PlanDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    publicPlansApi.list()
      .then(list => setPlans([...list].sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setFailed(true));
  }, []);

  return (
    <section id="pricing" className="scroll-mt-16 py-20 sm:py-28">
      <Reveal className={wrap}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold leading-[1.35] text-gray-950 [text-wrap:balance] sm:text-[2.75rem]">قیمت</h2>
            <p className="mt-3 max-w-[60ch] text-lg leading-8 text-gray-600">چهارده روز همه‌ی امکانات رایگان است؛ بعد یکی از این پلن‌ها را انتخاب می‌کنید.</p>
          </div>
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-[15px] font-bold text-gray-950 underline-offset-4 hover:underline">
            مقایسه‌ی کامل و پرداخت سالانه <ArrowLeft size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3" aria-live="polite">
          {plans === null && !failed && [0, 1, 2].map(i => (
            <div key={i} className="h-56 animate-pulse rounded-3xl bg-gray-100" aria-hidden="true" />
          ))}
          {failed && (
            <p className="text-gray-600 md:col-span-3">
              قیمت‌ها الان در دسترس نیست. <Link to="/pricing" className="font-bold underline">صفحه‌ی قیمت‌ها</Link> را ببینید.
            </p>
          )}
          {plans?.map(p => (
            <div key={p.id} className="flex flex-col rounded-3xl bg-gray-50 p-7">
              <h3 className="text-lg font-bold text-gray-950">{p.displayName}</h3>
              <div className="mt-4"><PlanPrice plan={p} /></div>
              {p.billingModel === PlanBillingModel.Hybrid && p.perCarPriceRials > 0 && (
                <p className="mt-1 text-sm text-gray-500">به‌علاوه‌ی {tomanNumber(p.perCarPriceRials)} تومان برای هر خودرو</p>
              )}
              {p.setupFeeRials > 0 && (
                <p className="mt-1 text-sm text-gray-500">راه‌اندازی یک‌باره: {tomanNumber(p.setupFeeRials)} تومان</p>
              )}
              {p.description && <p className="mt-5 text-[16px] leading-7 text-gray-600">{p.description}</p>}
              <div className="mt-auto pt-7">
                <Link to={`/register?planId=${p.id}&cycle=0`}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-gray-950 text-[15px] font-bold text-white transition-colors hover:bg-gray-800">
                  شروع رایگان
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
};

const Faq = () => (
  <section id="faq" className="scroll-mt-16 pb-20 sm:pb-28">
    <Reveal className={`${wrap} grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16`}>
      <h2 className="text-3xl font-extrabold leading-[1.35] text-gray-950 [text-wrap:balance] sm:text-[2.75rem]">سوالات رایج</h2>
      <div className="space-y-3">
        {FAQ.map(item => (
          <details key={item.q} className="group rounded-2xl bg-gray-50 px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-bold text-gray-950 [&::-webkit-details-marker]:hidden">
              {item.q}
              <span className="text-2xl font-light text-gray-400 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="mt-3 max-w-[62ch] text-[16px] leading-8 text-gray-600">{item.a}</p>
          </details>
        ))}
      </div>
    </Reveal>
  </section>
);

const Closing = () => (
  <section className="px-5 pb-20 sm:px-8">
    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gray-950">
      <img
        {...PHOTO('tunnel')}
        sizes="(min-width: 1152px) 1152px, 100vw"
        width={1600} height={1067}
        alt=""
        loading="lazy" decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="relative px-6 py-16 text-center sm:px-12 sm:py-24">
        <h2 className="text-3xl font-extrabold leading-[1.35] text-white [text-wrap:balance] sm:text-4xl">از همین امروز امتحان کنید</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-gray-200">چهارده روز همه‌ی امکانات، بدون کارت بانکی.</p>
        <Link to="/register"
          className="mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[15px] font-bold text-gray-950 transition-colors hover:bg-gray-100">
          شروع رایگان <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-gray-50">
    <div className={`${wrap} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex items-center gap-2.5">
        <Logo size={28} />
        <span className="font-extrabold text-gray-950">{BRAND_NAME}</span>
        <span className="text-sm text-gray-500">· سامانه‌ی مدیریت کارواش</span>
      </div>
      <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-gray-600" aria-label="پیوندهای پایانی">
        <Link to="/features" className="hover:text-gray-950">امکانات</Link>
        <Link to="/pricing" className="hover:text-gray-950">قیمت‌ها</Link>
        <Link to="/contact" className="hover:text-gray-950">تماس با ما</Link>
        <Link to="/login" className="hover:text-gray-950">ورود</Link>
      </nav>
    </div>
    <div className={`${wrap} pb-10 text-sm text-gray-500`}>
      © {new Date().toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric' })} {BRAND_NAME}
    </div>
  </footer>
);

export const Landing: React.FC = () => (
  <MotionConfig reducedMotion="user">
    <div dir="rtl" className="min-h-screen bg-white text-gray-950">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">
        رفتن به محتوا
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Features />
        <Start />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  </MotionConfig>
);

export default Landing;
