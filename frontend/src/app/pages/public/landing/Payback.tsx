import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Calculator, TrendingUp, Timer, CarFront } from 'lucide-react';
import { Container, CountUp, Reveal, SectionHead, fa, faNum } from '../../../components/landing/kit';

/**
 * The owner's own numbers, answered on the page.
 *
 * Every carwash site promises "more revenue". An owner cannot act on that, and does not
 * believe it. Two sliders they already know the answer to — cars a day, average price — turn
 * the claim into their own figure, and the figure is built from the one thing the product
 * genuinely changes: bays freed before payment, so the same bays take more cars.
 *
 * The assumption is stated under the result rather than buried. A calculator that hides its
 * arithmetic is a sales trick; one that shows it is an argument.
 */

/** Freeing the bay at "ready" rather than at payment is worth a few extra cars a day. */
const CAPACITY_GAIN = 0.18;
/** Reminders and the loyalty club bring a share of past customers back each month. */
const RETURN_GAIN = 0.07;

export const Payback = ({ monthlyPriceRials }: { monthlyPriceRials?: number }) => {
  const [cars, setCars] = useState(35);
  const [price, setPrice] = useState(90_000);
  const still = useReducedMotion();

  const monthlyFee = Math.round((monthlyPriceRials ?? 15_000_000_0) / 10);

  const result = useMemo(() => {
    const dailyNow = cars * price;
    const extraCars = cars * (CAPACITY_GAIN + RETURN_GAIN);
    const dailyGain = extraCars * price;
    const monthlyGain = dailyGain * 30;
    const net = monthlyGain - monthlyFee;
    // How many days of the extra income it takes to cover one month's subscription.
    const days = dailyGain > 0 ? Math.max(1, Math.ceil(monthlyFee / dailyGain)) : 30;
    return { dailyNow, extraCars, monthlyGain, net, days };
  }, [cars, price, monthlyFee]);

  return (
    <section className="relative py-20 md:py-28" id="payback">
      <Container>
        <SectionHead
          eyebrow="حساب و کتاب"
          tone="emerald"
          title="چند روز طول می‌کشد تا هزینه‌اش دربیاید؟"
          lead="دو عدد را که خودتان می‌دانید تنظیم کنید. بقیه‌اش حساب ساده است و فرضش را هم پایین نوشته‌ایم."
        />

        <Reveal>
          <div className="sw-calc">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
              <div className="space-y-7">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="cars" className="flex items-center gap-1.5 text-[12px] font-extrabold text-slate-600">
                      <CarFront size={14} className="text-sky-500" />خودرو در روز
                    </label>
                    <span className="rounded-lg bg-sky-50 px-2 py-1 text-[12px] font-black text-sky-700">{fa(cars)}</span>
                  </div>
                  <input
                    id="cars" type="range" min={10} max={120} step={1} value={cars}
                    onChange={e => setCars(+e.target.value)} className="sw-range sw-range-sky"
                    aria-valuetext={`${cars} خودرو در روز`}
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{fa(10)}</span><span>{fa(120)}</span></div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="price" className="flex items-center gap-1.5 text-[12px] font-extrabold text-slate-600">
                      <Calculator size={14} className="text-emerald-500" />میانگین مبلغ هر خودرو
                    </label>
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[12px] font-black text-emerald-700">{faNum(price)} ت</span>
                  </div>
                  <input
                    id="price" type="range" min={30_000} max={400_000} step={5_000} value={price}
                    onChange={e => setPrice(+e.target.value)} className="sw-range sw-range-emerald"
                    aria-valuetext={`${price} تومان`}
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{faNum(30_000)}</span><span>{faNum(400_000)}</span></div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-[11px] font-bold text-slate-500">فروش امروزتان با همین اعداد</div>
                  <div className="mt-1 text-xl font-black text-slate-800">{faNum(result.dailyNow)} <span className="text-sm">تومان در روز</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <motion.div layout className="sw-calc-result">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700">
                    <TrendingUp size={13} />درآمد اضافه‌ی ماهانه
                  </div>
                  <div className="mt-1 text-[28px] font-black leading-none text-emerald-700 md:text-[34px]">
                    <CountUp to={Math.round(result.monthlyGain)} /> <span className="text-base">تومان</span>
                  </div>
                  <div className="mt-2 text-[11px] leading-6 text-emerald-700/80">
                    معادل {fa(Math.round(result.extraCars))} خودروی بیشتر در روز، بدون اضافه‌کردن جایگاه یا نیرو.
                  </div>
                </motion.div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sw-calc-mini">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500"><Timer size={12} />بازگشت هزینه‌ی اشتراک</div>
                    <div className="mt-1 text-lg font-black text-slate-900">{fa(result.days)} روز</div>
                    <div className="text-[10px] text-slate-400">از محل همین درآمد اضافه</div>
                  </div>
                  <div className="sw-calc-mini">
                    <div className="text-[11px] font-bold text-slate-500">سود خالص ماهانه</div>
                    <div className="mt-1 text-lg font-black text-slate-900">{faNum(Math.round(result.net))} ت</div>
                    <div className="text-[10px] text-slate-400">پس از کسر اشتراک {faNum(monthlyFee)} ت</div>
                  </div>
                </div>

                <p className="rounded-xl bg-white/70 p-3 text-[10.5px] leading-6 text-slate-500 ring-1 ring-slate-200/70">
                  فرض محاسبه: {fa(Math.round(CAPACITY_GAIN * 100))}٪ ظرفیت بیشتر از آزادسازی زودهنگام جایگاه (خودرو پیش از تسویه از جایگاه بیرون می‌آید)
                  و {fa(Math.round(RETURN_GAIN * 100))}٪ مراجعه‌ی بیشتر از یادآور خدمت و باشگاه مشتریان.
                  عددها تخمین محتاطانه‌اند، نه تضمین؛ کارواش شما ممکن است بالاتر یا پایین‌تر باشد.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
};
