import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Check, Sparkles, ArrowLeft, Shield, Zap, MessageSquare } from 'lucide-react';
import { CtaBanner, SectionHeading } from '../../components/public/PublicLayout';
import { publicPlansApi, PlanDto, PlanBillingModel, auth } from '../../api';
import { clsx } from 'clsx';
import { visiblePlanFeatureLabels } from '../../lib/planFeatures';
import { tomanNumber } from '../../lib/money';


export const Pricing = () => {
  // No invented fallback: a pricing page that shows made-up prices while the real ones load —
  // or forever, if they fail to — is quoting figures nobody will honour.
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [failed, setFailed] = useState(false);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicPlansApi.list()
      .then(p => setPlans(p))
      .catch(() => setFailed(true))
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
                      <span className={clsx('text-4xl font-black', featured ? 'text-white' : 'text-gray-900')}>{tomanNumber(price)}</span>
                      <span className={clsx('text-sm mr-1', featured ? 'text-gray-400' : 'text-gray-500')}>تومان / {cycle === 'monthly' ? 'ماه' : 'سال'}</span>
                    </>
                  ) : p.perCarPriceRials > 0 ? (
                    // A usage-priced plan has no monthly fee to show; its price is per car.
                    <>
                      <span className={clsx('text-4xl font-black', featured ? 'text-white' : 'text-gray-900')}>{tomanNumber(p.perCarPriceRials)}</span>
                      <span className={clsx('text-sm mr-1', featured ? 'text-gray-400' : 'text-gray-500')}>تومان / هر خودرو</span>
                    </>
                  ) : (
                    <span className={clsx('text-3xl font-black', featured ? 'text-white' : 'text-gray-900')}>تماس بگیرید</span>
                  )}
                  {p.setupFeeRials > 0 && (
                    <div className={clsx('text-[11px] mt-1', featured ? 'text-gray-400' : 'text-gray-500')}>
                      هزینه راه‌اندازی: {tomanNumber(p.setupFeeRials)} تومان
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
        {loading && <div className="text-center text-sm text-gray-400 py-10">در حال دریافت تعرفه‌ها…</div>}
        {!loading && (failed || plans.length === 0) && (
          <div className="mx-auto max-w-md rounded-3xl border border-gray-100 bg-white p-8 text-center">
            <div className="font-bold text-gray-900">تعرفه‌ها در حال حاضر در دسترس نیست</div>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              لطفاً چند دقیقه‌ی دیگر دوباره سر بزنید، یا برای دریافت تعرفه با ما تماس بگیرید.
            </p>
            <Link to="/contact" className="mt-5 inline-block rounded-2xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white">
              تماس با ما
            </Link>
          </div>
        )}
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
