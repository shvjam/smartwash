import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Container, Reveal, Stagger, StaggerItem, fa } from '../../../components/landing/kit';
import { BrushMark, BubbleField, Drop, FoamDivider } from '../../../components/landing/art';

/**
 * The work itself, drawn.
 *
 * Between the journey and the feature panels the page was all text and white cards, and a
 * carwash owner scrolling it saw nothing of their own trade. These five tiles are the
 * services they sell — the foam, the brushes, the rinse, the dry, the wax — each drawn and
 * each carrying the one thing the system adds to it: a price, a duration, a bay, a record.
 *
 * It is decoration that argues: every tile is a service row in the panel, which is exactly
 * what these become once a carwash is set up.
 */

const TILES = [
  {
    key: 'foam', title: 'کف و پیش‌شستشو', meta: 'میانگین ۶ دقیقه',
    note: 'زمانش ثبت می‌شود', from: 'oklch(68% 0.16 235)', to: 'oklch(52% 0.18 245)',
    art: (
      <g>
        {[[36, 42, 20], [70, 32, 14], [96, 48, 22], [128, 36, 12], [58, 64, 12]].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#fff" opacity=".35" />
        ))}
        <path d="M18 78h128v26H18z" fill="#fff" opacity=".18" />
      </g>
    ),
  },
  {
    key: 'brush', title: 'شستشوی اصلی', meta: 'جایگاه شستشو',
    note: 'یک دکمه، شروع کار', from: 'oklch(64% 0.21 25)', to: 'oklch(50% 0.22 28)',
    art: (
      <g>
        <circle cx="84" cy="56" r="34" fill="#fff" opacity=".2" />
        <circle cx="84" cy="56" r="18" fill="#fff" opacity=".35" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x="81" y="16" width="6" height="18" rx="3" fill="#fff" opacity=".5"
            transform={`rotate(${i * 36} 84 56)`} />
        ))}
      </g>
    ),
  },
  {
    key: 'rinse', title: 'آبکشی', meta: 'بدون لکه',
    note: 'مرحله‌ی بعدی خودکار پیشنهاد می‌شود', from: 'oklch(72% 0.13 200)', to: 'oklch(56% 0.14 215)',
    art: (
      <g>
        {[28, 56, 84, 112, 140].map((x, i) => (
          <path key={x} d={`M${x} 18 C ${x - 10} 46, ${x + 10} 62, ${x} 92`} stroke="#fff" strokeOpacity={0.45 - i * 0.04}
            strokeWidth="4" strokeLinecap="round" fill="none" />
        ))}
      </g>
    ),
  },
  {
    key: 'dry', title: 'خشک‌کردن', meta: 'جایگاه خشک یا همان‌جا',
    note: 'جایگاه شستشو آزاد می‌شود', from: 'oklch(70% 0.16 300)', to: 'oklch(54% 0.18 300)',
    art: (
      <g>
        {[32, 54, 76].map((y, i) => (
          <path key={y} d={`M14 ${y} h${90 + i * 18} a12 12 0 1 0 -12 -12`} stroke="#fff" strokeOpacity=".45"
            strokeWidth="5" strokeLinecap="round" fill="none" />
        ))}
      </g>
    ),
  },
  {
    key: 'wax', title: 'واکس و پولیش', meta: 'خدمت آپشن',
    note: 'به فاکتور و سهم پرسنل اضافه می‌شود', from: 'oklch(78% 0.15 85)', to: 'oklch(62% 0.17 60)',
    art: (
      <g>
        {[[46, 34], [104, 28], [74, 68], [130, 62]].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y - 14} l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z`} fill="#fff" opacity={0.65 - i * 0.1} />
        ))}
        <ellipse cx="84" cy="92" rx="56" ry="10" fill="#fff" opacity=".2" />
      </g>
    ),
  },
];

export const Atmosphere = () => {
  const still = useReducedMotion();

  return (
    <section className="sw-band sw-band-white relative py-20 md:py-24" id="services">
      <BubbleField count={8} />
      <Container className="relative">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <Reveal>
            <div>
              <span className="sw-eyebrow sw-eyebrow-sky">خدمات</span>
              <h2 className="mt-3 text-balance text-3xl font-extrabold leading-tight text-slate-900 md:text-[2.4rem]">
                هر کاری که در کارواش می‌کنید، یک ردیف در سیستم است
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="max-w-sm text-[13px] leading-7 text-slate-500">
              خدمت‌ها، قیمت‌ها و مدت‌شان را خودتان تعریف می‌کنید. سیستم بقیه‌اش را می‌چیند:
              کدام جایگاه، چه کسی، چند دقیقه، چقدر پول.
            </p>
          </Reveal>
        </div>

        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t, i) => (
            <StaggerItem
              key={t.key}
              className={i === 0 ? 'sm:col-span-2 lg:col-span-1 lg:row-span-2' : undefined}
            >
              <motion.article
                className={`sw-tile ${i === 0 ? 'sw-tile-tall' : ''}`}
                style={{ background: `linear-gradient(145deg, ${t.from}, ${t.to})` }}
                whileHover={still ? undefined : { y: -5 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                <svg viewBox="0 0 168 110" className="sw-tile-art" aria-hidden>{t.art}</svg>
                <div className="relative mt-auto">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    {t.key === 'brush' ? <BrushMark size={11} className="text-white" /> : <Drop size={10} className="text-white" />}
                    {t.meta}
                  </span>
                  <h3 className="mt-2 text-[17px] font-black text-white">{t.title}</h3>
                  <p className="mt-1 text-[11.5px] leading-6 text-white/85">{t.note}</p>
                </div>
              </motion.article>
            </StaggerItem>
          ))}

          <StaggerItem>
            <div className="sw-tile sw-tile-plain">
              <div className="relative mt-auto">
                <span className="text-[28px] font-black text-slate-900">{fa('+')}</span>
                <h3 className="mt-1 text-[15px] font-black text-slate-900">خدمت خودتان را بسازید</h3>
                <p className="mt-1 text-[11.5px] leading-6 text-slate-500">
                  نانوسرامیک، شستشوی موتور، صفرشویی — هر چیزی با قیمت و مدت و جایگاه خودش.
                </p>
              </div>
            </div>
          </StaggerItem>
        </Stagger>
      </Container>
      <FoamDivider tone="brand" className="mt-16 md:mt-20" />
    </section>
  );
};
