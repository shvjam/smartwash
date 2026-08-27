import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Check, Sparkles, ArrowLeft, Shield, Zap, MessageSquare } from 'lucide-react';
import { CtaBanner, SectionHeading } from '../../components/public/PublicLayout';
import { publicPlansApi, PlanDto, PlanBillingModel, auth } from '../../api';
import { clsx } from 'clsx';
import { visiblePlanFeatureLabels } from '../../lib/planFeatures';

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

const fallbackPlans: PlanDto[] = [
  {
    id: 'starter', code: 'starter', displayName: 'پایه', description: 'مناسب کارواش‌های تک‌شعبه',
    billingModel: PlanBillingModel.Subscription, setupFeeRials: 0, monthlyPriceRials: 4_900_000, yearlyPriceRials: 49_000_000,
    perCarPriceRials: 0, includedCarsPerMonth: 500, sortOrder: 1, isActive: true, isPublic: true,
    features: [
      { key: 'bays', value: 'تا ۴ جایگاه' },
      { key: 'workers', value: 'تا ۱۰ پرسنل' },
      { key: 'reservations', value: 'رزرو آنلاین' },
      { key: 'reports', value: 'گزارش‌های پایه' },
      { key: 'support', value: 'پشتیبانی ایمیلی' },
    ],
  },
  {
    id: 'pro', code: 'pro', displayName: 'حرفه‌ای', description: 'بیشترین انتخاب کارواش‌های متوسط',
    billingModel: PlanBillingModel.Subscription, setupFeeRials: 0, monthlyPriceRials: 9_900_000, yearlyPriceRials: 99_000_000,
    perCarPriceRials: 0, includedCarsPerMonth: 2000, sortOrder: 2, isActive: true, isPublic: true,
    features: [
      { key: 'bays', value: 'جایگاه نامحدود' },
      { key: 'workers', value: 'پرسنل نامحدود' },
      { key: 'loyalty', value: 'باشگاه مشتریان' },
      { key: 'sms', value: 'پنل پیامکی' },
      { key: 'campaigns', value: 'کمپین‌های هدفمند' },
      { key: 'reports', value: 'گزارش‌های پیشرفته' },
      { key: 'support', value: 'پشتیبانی ۲۴/۷' },
    ],
  },
  {
    id: 'enterprise', code: 'enterprise', displayName: 'سازمانی', description: 'برای زنجیره‌های چندشعبه',
    billingModel: PlanBillingModel.Hybrid, setupFeeRials: 50_000_000, monthlyPriceRials: 24_900_000, yearlyPriceRials: 249_000_000,
    perCarPriceRials: 0, includedCarsPerMonth: null, sortOrder: 3, isActive: true, isPublic: true,
    features: [
      { key: 'all-pro', value: 'تمام امکانات حرفه‌ای' },
      { key: 'multibranch', value: 'مدیریت چندشعبه‌ای' },
      { key: 'roles', value: 'نقش‌های سفارشی' },
      { key: 'api', value: 'API اختصاصی' },
      { key: 'sla', value: 'SLA سازمانی ۹۹.۹٪' },
      { key: 'manager', value: 'حساب‌مدیر اختصاصی' },
    ],
  },
];

export const Pricing = () => {
  const [plans, setPlans] = useState<PlanDto[]>(fallbackPlans);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicPlansApi.list()
      .then(p => { if (p.length) setPlans(p); })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-br from-red-100 via-amber-50 to-transparent rounded-full blur-3xl opacity-70" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 lg:pt-24 pb-10 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-red-100 text-red-600 text-xs font-bold mb-5">
            <Sparkles size={12} />تعرفه شفاف، بدون قرارداد بلندمدت
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 mb-4 leading-[1.1]">
            یک پلن برای{' '}
            <span className="bg-gradient-to-br from-red-500 to-red-800 bg-clip-text text-transparent">هر اندازه</span>{' '}
            کارواش
          </h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto leading-8 mb-8">
            هر زمان می‌توانید پلن را ارتقاء یا لغو کنید. ۱۴ روز اول کاملاً رایگان، بدون نیاز به کارت بانکی.
          </p>

          <div className="inline-flex p-1 bg-gray-100 rounded-full">
            {(['monthly', 'yearly'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={clsx(
                  'px-5 py-2 rounded-full text-sm font-bold transition-all',
                  cycle === c ? 'bg-white text-gray-900 shadow' : 'text-gray-500'
                )}
              >
                {c === 'monthly' ? 'ماهانه' : 'سالانه'}
                {c === 'yearly' && <span className="mr-1.5 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">۲ ماه رایگان</span>}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p, i) => {
            const featured = i === 1;
            const price = cycle === 'monthly' ? p.monthlyPriceRials : p.yearlyPriceRials;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={clsx(
                  'relative rounded-3xl p-7 border transition-all',
                  featured
                    ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 scale-100 lg:scale-[1.03] shadow-2xl shadow-gray-300'
                    : 'bg-white border-gray-100 hover:shadow-xl hover:shadow-gray-100'
                )}
              >
                {featured && (
                  <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white text-[10px] font-black tracking-wide">
                    پرفروش‌ترین
                  </div>
                )}
                <div className={clsx('text-sm font-bold mb-2', featured ? 'text-red-300' : 'text-red-600')}>{p.displayName}</div>
                <div className={clsx('text-xs mb-5', featured ? 'text-gray-400' : 'text-gray-500')}>{p.description}</div>
                <div className="mb-6">
                  {price > 0 ? (
                    <>
                      <span className={clsx('text-4xl font-black', featured ? 'text-white' : 'text-gray-900')}>{fmt(price)}</span>
                      <span className={clsx('text-sm mr-1', featured ? 'text-gray-400' : 'text-gray-500')}>تومان / {cycle === 'monthly' ? 'ماه' : 'سال'}</span>
                    </>
                  ) : (
                    <span className={clsx('text-3xl font-black', featured ? 'text-white' : 'text-gray-900')}>تماس بگیرید</span>
                  )}
                  {p.setupFeeRials > 0 && (
                    <div className={clsx('text-[11px] mt-1', featured ? 'text-gray-400' : 'text-gray-500')}>
                      هزینه راه‌اندازی: {fmt(p.setupFeeRials)} تومان
                    </div>
                  )}
                </div>
                {/* اگر لاگین هستند → billing، اگر نه → register */}
                {(() => {
                  const isLoggedIn = !!auth.access();
                  const cycleNum = cycle === 'yearly' ? 1 : 0;
                  const href = isLoggedIn
                    ? `/app/billing?subscribePlanId=${p.id}&cycle=${cycleNum}`
                    : `/register?planId=${p.id}&cycle=${cycleNum}`;
                  return (
                    <Link
                      to={href}
                      className={clsx(
                        'block text-center font-bold py-3 rounded-2xl mb-6 transition-all',
                        featured
                          ? 'bg-white text-gray-900 hover:scale-[1.02]'
                          : 'bg-gray-900 text-white hover:scale-[1.02]'
                      )}
                    >
                      {isLoggedIn ? 'خرید اشتراک' : 'شروع رایگان'}
                    </Link>
                  );
                })()}
                <div className={clsx('text-xs font-bold mb-3', featured ? 'text-gray-400' : 'text-gray-500')}>شامل:</div>
                <ul className="space-y-2.5">
                  {visiblePlanFeatureLabels(p.features).map((label) => (
                    <li key={label} className="flex items-start gap-2 text-sm">
                      <Check size={16} className={clsx('mt-0.5 flex-shrink-0', featured ? 'text-emerald-400' : 'text-emerald-600')} />
                      <span className={featured ? 'text-gray-200' : 'text-gray-700'}>{label}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
        {loading && <div className="text-center text-xs text-gray-400 mt-4">به‌روزرسانی تعرفه‌ها…</div>}
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionHeading center kicker="سؤالات متداول" title="هرچه باید بدانید" />
        <div className="space-y-3">
          {[
            { q: 'آیا واقعاً ۱۴ روز رایگان است؟', a: 'بله. در طول دوره آزمایشی هیچ هزینه‌ای دریافت نمی‌شود و حتی نیاز به وارد کردن کارت بانکی هم نیست.' },
            { q: 'آیا می‌توانم در میانه ماه پلن را عوض کنم؟', a: 'بله. ارتقاء و تنزل لحظه‌ای انجام می‌شود و تفاوت هزینه به صورت اعتبار در صورتحساب بعدی اعمال می‌شود.' },
            { q: 'داده‌های من کجا ذخیره می‌شود؟', a: 'تمام داده‌ها روی سرورهای داخل ایران ذخیره و روزانه نسخه‌گیری می‌شوند. شما در هر لحظه می‌توانید خروجی کامل بگیرید.' },
            { q: 'پشتیبانی چگونه است؟', a: 'پلن حرفه‌ای و بالاتر پشتیبانی ۲۴/۷ از طریق چت، تلگرام و تلفن دارند. پلن پایه پشتیبانی ایمیلی روزهای کاری دارد.' },
          ].map((f, i) => (
            <details key={i} className="group bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer">
              <summary className="font-bold text-sm text-gray-900 flex items-center justify-between list-none">
                {f.q}
                <span className="text-red-500 group-open:rotate-45 transition-transform text-xl">+</span>
              </summary>
              <p className="text-sm text-gray-600 leading-7 mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <CtaBanner />
    </>
  );
};

export default Pricing;
