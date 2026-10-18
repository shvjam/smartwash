import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Check, RotateCcw } from 'lucide-react';
import { auth, publicPlansApi, PlanBillingModel, type PlanDto } from '../../../api';
import { tomanNumber } from '../../../lib/money';
import { visiblePlanFeatureLabels } from '../../../lib/planFeatures';
import { Btn, Split, Stroke, View } from './kit';

const fa = (n: number) => n.toLocaleString('fa-IR');

/*
 * Plans are read from billing on every visit. Nothing here is a hard-coded price: if the API
 * cannot be reached, the section says so instead of quoting a figure nobody will honour.
 */

type Cycle = 'monthly' | 'yearly';

/** The headline price of one plan for the chosen cycle, the way billing charges it. */
const PlanPrice = ({ plan, cycle }: { plan: PlanDto; cycle: Cycle }) => {
  const fixed = cycle === 'yearly' ? plan.yearlyPriceRials : plan.monthlyPriceRials;
  if (fixed > 0) {
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[2.6rem] font-bold leading-none tabular-nums lg:text-[3rem]">{tomanNumber(fixed)}</span>
          <span className="swl-body swl-dim whitespace-nowrap">تومان / {cycle === 'yearly' ? 'سال' : 'ماه'}</span>
        </div>
        {cycle === 'yearly' && plan.monthlyPriceRials > 0 && (
          <p className="mt-2 text-[max(.85rem,13px)] text-white/55">معادل ماهی {tomanNumber(Math.round(fixed / 12))} تومان</p>
        )}
      </div>
    );
  }
  if (plan.perCarPriceRials > 0) {
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[2.6rem] font-bold leading-none tabular-nums lg:text-[3rem]">{tomanNumber(plan.perCarPriceRials)}</span>
          <span className="swl-body swl-dim whitespace-nowrap">تومان / هر خودرو</span>
        </div>
        {plan.billingModel === PlanBillingModel.UsageBased && (
          <p className="mt-2 text-[max(.85rem,13px)] text-white/55">بدون هزینه‌ی ثابت ماهانه</p>
        )}
      </div>
    );
  }
  return <div className="text-[2.2rem] font-bold">تماس بگیرید</div>;
};

const PlanCard = ({ plan, cycle, featured }: { plan: PlanDto; cycle: Cycle; featured: boolean }) => {
  const loggedIn = !!auth.access();
  const cycleNum = cycle === 'yearly' ? 1 : 0;
  const href = loggedIn
    ? `/app/billing?subscribePlanId=${plan.id}&cycle=${cycleNum}`
    : `/register?planId=${plan.id}&cycle=${cycleNum}`;
  const extras = [
    ...visiblePlanFeatureLabels(plan.features),
    ...(plan.includedSmsPerMonth > 0 ? [`${fa(plan.includedSmsPerMonth)} پیامک در ماه`] : []),
    ...(plan.includedCarsPerMonth ? [`${fa(plan.includedCarsPerMonth)} خودرو در ماه در قیمت پلن`] : []),
  ];
  return (
    <Stroke className="swl-plan" glow={featured} style={featured ? undefined : { background: 'rgba(255,255,255,.12)' }}>
      {featured && <span className="absolute inset-x-0 top-0 z-[2] mx-auto h-px w-1/2 bg-gradient-to-l from-transparent via-[#fca5a5] to-transparent" />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="swl-h3">{plan.displayName}</h3>
          {plan.description && <p className="swl-body swl-dim mt-1">{plan.description}</p>}
        </div>
        {featured && <span className="flex-none rounded-full bg-[#dc2626] px-3 py-1 text-[max(.78rem,12px)] font-semibold">کامل‌ترین</span>}
      </div>
      <div className="my-7 border-y border-white/10 py-7">
        <PlanPrice plan={plan} cycle={cycle} />
        {plan.billingModel === PlanBillingModel.Hybrid && plan.perCarPriceRials > 0 && (
          <p className="mt-2 text-[max(.85rem,13px)] text-white/55">به‌علاوه‌ی {tomanNumber(plan.perCarPriceRials)} تومان برای هر خودرو</p>
        )}
        {plan.setupFeeRials > 0 && (
          <p className="mt-2 text-[max(.85rem,13px)] text-white/55">راه‌اندازی یک‌باره: {tomanNumber(plan.setupFeeRials)} تومان</p>
        )}
      </div>
      <ul className="space-y-3">
        {extras.map(label => (
          <li key={label} className="flex items-start gap-3 text-[max(.98rem,14px)] leading-7 text-white/85">
            <span className="swl-plan-check"><Check size={12} strokeWidth={3} /></span>{label}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Btn to={href} variant={featured ? 'red' : 'ghost'} className="w-full">{loggedIn ? 'خرید اشتراک' : 'شروع ۱۴ روز رایگان'}</Btn>
      </div>
    </Stroke>
  );
};

export const PricingSection = () => {
  const [plans, setPlans] = useState<PlanDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [cycle, setCycle] = useState<Cycle>('monthly');

  const load = useCallback(() => {
    setFailed(false);
    setPlans(null);
    publicPlansApi.list()
      .then(list => setPlans(list.filter(p => p.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  // The yearly saving is derived from the plans themselves, never assumed.
  const freeMonths = useMemo(() => {
    const m = (plans ?? [])
      .filter(p => p.monthlyPriceRials > 0 && p.yearlyPriceRials > 0)
      .map(p => Math.round(12 - p.yearlyPriceRials / p.monthlyPriceRials));
    return m.length ? Math.max(...m) : 0;
  }, [plans]);
  const hasYearly = (plans ?? []).some(p => p.yearlyPriceRials > 0);
  const featuredId = useMemo(() => {
    if (!plans?.length) return null;
    return (plans.find(p => p.code === 'pro') ?? plans[Math.floor(plans.length / 2)]).id;
  }, [plans]);

  return (
    <section id="pricing" className="relative scroll-mt-20 py-24 lg:py-[10rem]" aria-labelledby="swl-pricing-title">
      <div className="swl-glow" style={{ width: '50rem', top: '10%', left: '50%', translate: '-50% 0', opacity: 0.16 }} />
      <div className="swl-container">
        <div className="mx-auto flex max-w-[52rem] flex-col items-center text-center">
          <span className="swl-tag">تعرفه‌ها</span>
          <Split as="h2" text="یک پلن برای هر اندازه کارواش" className="swl-h1" preset="down" />
          <Split as="p" text="چهارده روز همه‌ی امکانات رایگان است، بدون کارت بانکی. بعد یکی از این پلن‌ها را انتخاب می‌کنید و هر وقت خواستید عوضش می‌کنید." className="swl-body swl-dim mt-4 block" delay={0.2} stagger={0.03} />
          {hasYearly && (
            <div className="swl-cycle mt-8" role="group" aria-label="دوره‌ی پرداخت">
              {(['monthly', 'yearly'] as const).map(c => (
                <button key={c} type="button" aria-pressed={cycle === c} onClick={() => setCycle(c)}>
                  {cycle === c && <motion.span layoutId="swl-cycle-pill" className="absolute inset-0 rounded-[.75rem] bg-white" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span className="relative">
                    {c === 'monthly' ? 'ماهانه' : 'سالانه'}
                    {c === 'yearly' && freeMonths > 0 && <span className="mr-2 rounded-full bg-[#dc2626] px-2 py-0.5 text-[11px] text-white">{fa(freeMonths)} ماه رایگان</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-14 grid gap-5 lg:mt-[4.5rem] lg:grid-cols-3 lg:gap-[1.6rem]" aria-live="polite" aria-busy={plans === null && !failed}>
          {plans === null && !failed && [0, 1, 2].map(i => (
            <div key={i} className="h-[34rem] animate-pulse rounded-[2rem] bg-white/[.05]" aria-hidden="true" />
          ))}
          {failed && (
            <div className="rounded-[2rem] border border-white/10 bg-white/[.03] p-10 text-center lg:col-span-3">
              <p className="swl-h4">تعرفه‌ها همین الان در دسترس نیست</p>
              <p className="swl-body swl-dim mx-auto mt-2 max-w-[36rem]">قیمت‌ها مستقیم از سامانه‌ی صورتحساب خوانده می‌شوند و اتصال به آن برقرار نشد. چند لحظه‌ی دیگر دوباره امتحان کنید یا با ما تماس بگیرید.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Btn onClick={load}><RotateCcw size={16} aria-hidden="true" /> تلاش دوباره</Btn>
                <Btn variant="ghost" to="/contact">تماس با ما</Btn>
              </div>
            </div>
          )}
          {plans?.length === 0 && (
            <p className="swl-body swl-dim text-center lg:col-span-3">هنوز پلنی منتشر نشده است. <Link to="/contact" className="underline">با ما تماس بگیرید</Link>.</p>
          )}
          {plans?.map((p, i) => (
            <View key={p.id} delay={i * 0.1} className="h-full">
              <PlanCard plan={p} cycle={cycle} featured={p.id === featuredId} />
            </View>
          ))}
        </div>
        <p className="mt-8 text-center text-[max(.9rem,13px)] text-white/45">
          مقایسه‌ی کامل پلن‌ها در <Link to="/pricing" className="text-white/75 underline-offset-4 hover:underline">صفحه‌ی تعرفه‌ها</Link>
        </p>
      </div>
    </section>
  );
};

/* ── questions ────────────────────────────────────────────────────────────── */

const FAQ = [
  { q: 'نصب یا دستگاه خاصی لازم است؟', a: 'نه. پنل در مرورگر باز می‌شود؛ روی رایانه‌ی پذیرش، تبلت یا گوشی. می‌شود آن را مثل یک برنامه روی صفحه‌ی گوشی نصب کرد.' },
  { q: 'بعد از چهارده روز چه می‌شود؟', a: 'اگر اشتراک نخرید، حساب سه روز در مهلت می‌ماند و بعد غیرفعال می‌شود. اطلاعاتتان پاک نمی‌شود و با خرید اشتراک برمی‌گردد.' },
  { q: 'پرسنل هر کدام حساب جدا دارند؟', a: 'بله. مالک، مدیر، صندوقدار، اپراتور، حسابدار و بازاریابی نقش‌های جدا دارند و هر کس فقط بخش‌های مربوط به کارش را می‌بیند.' },
  { q: 'پیامک‌ها از کجا ارسال می‌شوند؟', a: 'از سامانه‌ی پیامکی خود پلتفرم. سهمیه‌ی ماهانه در پلن است و لازم نیست جداگانه پنل پیامکی بخرید.' },
  { q: 'اگر اینترنت قطع شود چه؟', a: 'پنل برای ثبت سفارش به اینترنت نیاز دارد. وقتی اتصال برگردد، پنل با آخرین وضعیت جایگاه‌ها همگام می‌شود.' },
  { q: 'اطلاعات کارواش من را چه کسی می‌بیند؟', a: 'فقط کاربران خود کارواش. داده‌ی هر کارواش جداست و هیچ کارواش دیگری به آن دسترسی ندارد.' },
];

export const Faq = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative scroll-mt-20 pb-20 lg:pb-[8rem]" aria-labelledby="swl-faq-title">
      <div className="swl-container grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-[6rem]">
        <div>
          <span className="swl-tag">سوالات رایج</span>
          <Split as="h2" text="پیش از شروع" className="swl-h1" preset="down" />
          <p className="swl-body swl-dim mt-4 max-w-[24rem]">جواب سوالی را که اینجا نیست، از <Link to="/contact" className="text-white underline-offset-4 hover:underline">صفحه‌ی تماس</Link> بپرسید.</p>
        </div>
        <div className="border-t border-white/[.14]">
          {FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="swl-faq-item" data-open={isOpen}>
                <button type="button" aria-expanded={isOpen} aria-controls={`swl-faq-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                  <span className="swl-h4">{f.q}</span>
                  <span className="swl-faq-plus" aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div id={`swl-faq-${i}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }} className="overflow-hidden">
                      <p className="swl-body swl-dim max-w-[44rem] pb-7">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
