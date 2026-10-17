import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { Container, Reveal, Stagger, StaggerItem, fa, faNum } from '../../../components/landing/kit';

/**
 * The services a carwash sells, shown as the ledger the product keeps of them.
 *
 * The earlier version of this section was six gradient tiles with a cartoon on each. It
 * looked like a template and said nothing: a carwash owner already knows what foam is. What
 * they do not know is what the software does with it — that each service carries a price, a
 * duration, a bay type and a commission, and that those four numbers are where the month's
 * figures come from.
 *
 * So the section is a table they can touch. Selecting a row shows what one service turns into
 * once it has been sold a hundred times: revenue, average time, the share that goes to staff.
 * It is the same arithmetic the reports screen does, on a row they chose.
 */

type Service = {
  name: string;
  priceToman: number;
  minutes: number;
  bay: string;
  commission: number;
  /** Sold per month at a typical site — used for the summary beside the table. */
  monthly: number;
  tone: 'wash' | 'dry' | 'money' | 'idle';
};

const SERVICES: Service[] = [
  { name: 'شستشوی معمولی', priceToman: 50_000, minutes: 18, bay: 'شستشو', commission: 0.1, monthly: 620, tone: 'wash' },
  { name: 'شستشوی کامل', priceToman: 90_000, minutes: 32, bay: 'شستشو', commission: 0.12, monthly: 310, tone: 'wash' },
  { name: 'نظافت داخل خودرو', priceToman: 70_000, minutes: 25, bay: 'هر جایگاه', commission: 0.15, monthly: 180, tone: 'idle' },
  { name: 'خشک‌کردن و براق‌کننده', priceToman: 40_000, minutes: 12, bay: 'خشک', commission: 0.1, monthly: 240, tone: 'dry' },
  { name: 'واکس و پولیش', priceToman: 180_000, minutes: 55, bay: 'واکس / پولیش', commission: 0.18, monthly: 60, tone: 'money' },
  { name: 'نانوسرامیک', priceToman: 1_400_000, minutes: 240, bay: 'ویژه', commission: 0.2, monthly: 6, tone: 'money' },
];

const TONE: Record<Service['tone'], string> = {
  wash: 'var(--wash)', dry: 'var(--dry)', money: 'var(--money)', idle: 'var(--ink-3)',
};

export const Services = () => {
  const [at, setAt] = useState(0);
  const still = useReducedMotion();
  const picked = SERVICES[at];

  const revenue = picked.priceToman * picked.monthly;
  const staff = Math.round(revenue * picked.commission);
  const hours = Math.round((picked.minutes * picked.monthly) / 60);

  return (
    <section className="relative py-20 md:py-28" id="services">
      <Container>
        <div className="mb-12 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Reveal><span className="sw-eyebrow-line">خدمات</span></Reveal>
            <Reveal delay={0.05}>
              <h2 className="sw-display mt-4 max-w-xl text-[1.9rem] md:text-[2.4rem]">
                هر خدمتی که می‌فروشید، چهار عدد دارد
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-sm text-[13.5px] leading-7 text-[var(--ink-3)]">
              قیمت، مدت، جایگاهی که در آن انجام می‌شود، و سهم پرسنل. همین چهار عدد است که
              آخر ماه گزارش مالی از آن درمی‌آید. روی هر ردیف بزنید.
            </p>
          </Reveal>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* ── The table ──────────────────────────────────────────────── */}
          <Reveal>
            <div className="sw-card overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-[var(--line-soft)] bg-[var(--paper-2)] px-4 py-2.5 text-[10.5px] font-bold text-[var(--ink-3)]">
                <span>خدمت</span>
                <span className="w-20 text-left">قیمت</span>
                <span className="w-14 text-left">مدت</span>
                <span className="w-24 text-left">جایگاه</span>
              </div>

              <Stagger className="divide-y divide-[var(--line-soft)]" step={0.04}>
                {SERVICES.map((s, i) => {
                  const on = i === at;
                  return (
                    <StaggerItem key={s.name}>
                      <button
                        type="button"
                        onClick={() => setAt(i)}
                        aria-pressed={on}
                        className={clsx('sw-service-row', on && 'sw-service-row-on')}
                        style={{ color: TONE[s.tone] }}
                      >
                        <span className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3">
                          <span className="flex items-center gap-2 text-right">
                            <span className="size-1.5 flex-shrink-0 rounded-full bg-current" />
                            <span className="truncate text-[13px] font-bold text-[var(--ink)]">{s.name}</span>
                          </span>
                          <span className="sw-num w-20 text-left text-[12.5px] font-extrabold text-[var(--ink)]">
                            {faNum(s.priceToman)}
                          </span>
                          <span className="sw-num w-14 text-left text-[12px] text-[var(--ink-2)]">
                            {fa(s.minutes)}′
                          </span>
                          <span className="w-24 text-left">
                            <span className="sw-chip" style={{ color: TONE[s.tone], background: 'oklch(21% 0.012 260 / 0.045)' }}>
                              {s.bay}
                            </span>
                          </span>
                        </span>
                      </button>
                    </StaggerItem>
                  );
                })}
              </Stagger>

              <div className="flex items-center justify-between border-t border-[var(--line-soft)] bg-[var(--paper-2)] px-4 py-2.5 text-[11px] text-[var(--ink-3)]">
                <span>خدمت‌ها را خودتان تعریف می‌کنید — هر تعداد، با قیمت و مدت خودش</span>
                <span className="sw-num">{fa(SERVICES.length)} ردیف</span>
              </div>
            </div>
          </Reveal>

          {/* ── What one row becomes in a month ────────────────────────── */}
          <Reveal delay={0.08}>
            <div className="sw-card h-full p-5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: TONE[picked.tone] }} />
                <span className="text-[12px] font-extrabold">{picked.name}</span>
                <span className="mr-auto text-[10.5px] text-[var(--ink-4)]">در یک ماه معمولی</span>
              </div>

              <div className="mt-5 space-y-4">
                <Figure
                  label="فروش این خدمت"
                  value={`${faNum(revenue)} تومان`}
                  note={`${faNum(picked.monthly)} بار فروخته شده`}
                  tone="var(--ink)"
                  still={still}
                />
                <Figure
                  label="سهم پرسنل از همین خدمت"
                  value={`${faNum(staff)} تومان`}
                  note={`کارمزد ${fa(Math.round(picked.commission * 100))}٪ — خودکار حساب می‌شود`}
                  tone="var(--money)"
                  still={still}
                />
                <Figure
                  label="زمانی که جایگاه را می‌گیرد"
                  value={`${faNum(hours)} ساعت`}
                  note={`${fa(picked.minutes)} دقیقه برای هر خودرو`}
                  tone="var(--wash)"
                  still={still}
                />
              </div>

              <p className="mt-6 border-t border-[var(--line-soft)] pt-4 text-[11px] leading-6 text-[var(--ink-3)]">
                همین اعداد در گزارش‌ها جمع می‌شوند و می‌گویند کدام خدمت واقعاً سودده است و
                کدام فقط جایگاه را اشغال می‌کند.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
};

const Figure = ({ label, value, note, tone, still }: {
  label: string; value: string; note: string; tone: string; still: boolean | null;
}) => (
  <div>
    <div className="text-[11px] text-[var(--ink-3)]">{label}</div>
    <motion.div
      key={value}
      initial={still ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
      className="sw-num mt-1 text-[20px] font-extrabold"
      style={{ color: tone }}
    >
      {value}
    </motion.div>
    <div className="mt-0.5 text-[10.5px] text-[var(--ink-4)]">{note}</div>
  </div>
);
