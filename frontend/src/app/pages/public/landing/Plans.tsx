import React from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ArrowLeft, Handshake, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { PlanBillingModel, type PlanDto } from '../../../api';
import { visiblePlanFeatureLabels } from '../../../lib/planFeatures';
import { Container, Magnetic, Reveal, SectionHead, fa, faNum, toman } from '../../../components/landing/kit';

/**
 * Prices, read from the same place the panel reads them.
 *
 * These cards are filled by the live plans endpoint rather than written into the page, so a
 * price changed in the owner panel is the price a visitor is quoted. A landing page that
 * drifts from the billing system is worse than no prices at all.
 *
 * Tomans, because that is what an owner budgets in; the API speaks rials and the conversion
 * is the platform's rule, not a decision made here. The partnership plan is kept visible
 * beside the subscriptions: for a carwash unsure about a monthly commitment, paying per car
 * washed is the offer that removes the risk.
 */

export const Plans = ({
  plans, cycle, onCycle, loading,
}: {
  plans: PlanDto[]; cycle: 'monthly' | 'yearly'; onCycle: (c: 'monthly' | 'yearly') => void; loading: boolean;
}) => {
  const still = useReducedMotion();
  const subscriptions = plans.filter(p => p.billingModel !== PlanBillingModel.UsageBased);
  const usage = plans.find(p => p.billingModel === PlanBillingModel.UsageBased);
  // The middle subscription is the one most sites land on; saying so saves a decision.
  const popular = subscriptions[Math.min(1, subscriptions.length - 1)]?.id;

  return (
    <section className="relative py-20 md:py-28" id="plans">
      <Container>
        <SectionHead
          eyebrow="پلن‌ها"
          title="هزینه‌اش روشن است"
          lead="بدون قرارداد بلندمدت و بدون هزینه‌ی پنهان. ۱۴ روز اول رایگان است و کارت بانکی نمی‌خواهد."
        />

        <Reveal>
          <div className="mx-auto mb-10 flex w-fit items-center gap-1 rounded-2xl bg-slate-100 p-1">
            {([['monthly', 'ماهانه'], ['yearly', 'سالانه']] as const).map(([key, label]) => (
              <button
                key={key} type="button" onClick={() => onCycle(key)}
                className={clsx('relative rounded-xl px-5 py-2 text-[12.5px] font-extrabold transition-colors',
                  cycle === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700')}
              >
                {cycle === key && !still && (
                  <motion.span layoutId="cycle-pill" className="absolute inset-0 rounded-xl bg-white shadow-sm"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }} />
                )}
                <span className="relative">{label}</span>
                {key === 'yearly' && <span className="relative mr-1.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">۲ ماه رایگان</span>}
              </button>
            ))}
          </div>
        </Reveal>

        {loading ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className={clsx('mx-auto grid gap-4',
            // Two plans centred rather than stretched across three columns, which left a hole.
            subscriptions.length >= 3 ? 'md:grid-cols-3' : 'max-w-3xl sm:grid-cols-2')}>
            {subscriptions.map((p, i) => {
              const price = cycle === 'monthly' ? p.monthlyPriceRials : p.yearlyPriceRials;
              const best = p.id === popular;
              return (
                <Reveal key={p.id} delay={i * 0.06}>
                  <div className={clsx('sw-plan group/tilt h-full', best && 'sw-plan-best')}>
                    {best && <span className="sw-plan-flag">بیشترین انتخاب</span>}
                    <h3 className="text-[15px] font-extrabold text-slate-900">{p.displayName}</h3>
                    {p.description && <p className="mt-1 text-[11.5px] leading-6 text-slate-500">{p.description}</p>}

                    <div className="mt-5 flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-slate-900">{toman(price)}</span>
                      <span className="text-[12px] text-slate-500">تومان / {cycle === 'monthly' ? 'ماه' : 'سال'}</span>
                    </div>
                    {p.setupFeeRials > 0 && (
                      <div className="mt-1 text-[11px] text-slate-400">هزینه‌ی راه‌اندازی یک‌باره: {toman(p.setupFeeRials)} تومان</div>
                    )}

                    <Magnetic className="mt-5 block">
                      <Link to="/register" className={clsx('sw-btn w-full justify-center', best ? 'sw-btn-primary' : 'sw-btn-outline')}>
                        <span>شروع ۱۴ روز رایگان</span>
                        <ArrowLeft size={15} />
                      </Link>
                    </Magnetic>

                    <ul className="mt-5 space-y-2 border-t border-slate-100 pt-5">
                      {visiblePlanFeatureLabels(p.features).map(f => (
                        <li key={f} className="flex items-start gap-2 text-[12px] leading-6 text-slate-600">
                          <Check size={14} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}

        {usage && (
          <Reveal delay={0.1}>
            <div className="sw-partner mt-4">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 flex-shrink-0 place-items-center rounded-2xl bg-white/15 text-white"><Handshake size={18} /></span>
                  <div>
                    <h3 className="text-[15px] font-extrabold text-white">{usage.displayName}</h3>
                    <p className="mt-1 max-w-lg text-[12px] leading-6 text-white/70">
                      {usage.description ?? 'بدون هزینه‌ی ثابت؛ فقط بابت هر خودرویی که سرویس می‌شود پرداخت می‌کنید.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-black text-white">{toman(usage.perCarPriceRials)} <span className="text-[12px] font-bold">تومان</span></div>
                    <div className="text-[11px] text-white/60">به ازای هر خودرو</div>
                  </div>
                  <Link to="/contact" className="sw-btn sw-btn-light">
                    <span>مشاوره بگیرید</span>
                    <ArrowLeft size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        )}

        <Reveal delay={0.12}>
          <p className="mt-6 text-center text-[11.5px] text-slate-400">
            همه‌ی پلن‌ها شامل به‌روزرسانی رایگان، پشتیبان‌گیری روزانه و پشتیبانی فارسی هستند.
            تعداد کاربران و جایگاه‌ها در هر پلن متفاوت است؛ هر زمان می‌توانید ارتقا بدهید.
            {' '}نرخ‌ها بر حسب تومان است و {fa(1)} تومان برابر {faNum(10)} ریال.
          </p>
        </Reveal>
      </Container>
    </section>
  );
};
