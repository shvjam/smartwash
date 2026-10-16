import React from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Building2, KeySquare, Palette, Smartphone, FileClock, ShieldCheck } from 'lucide-react';
import { Container, Reveal, SectionHead, Stagger, StaggerItem, fa, faNum } from '../../../components/landing/kit';

/**
 * The part an owner reads when they are no longer standing on the floor.
 *
 * Two different promises live here and they belong together: the numbers the system produces
 * on its own, and the fact that the system scales past one site and one person. A chain owner
 * is asking "can I see branch two from home", and the honest answer is a chart plus roles plus
 * their own logo on the panel.
 *
 * The charts are real chart components with plausible figures, not pictures of charts: hover
 * works, the shapes are the ones the reports draw.
 */

const WEEK = [
  { d: 'شنبه', v: 38 }, { d: 'یک‌شنبه', v: 44 }, { d: 'دوشنبه', v: 41 },
  { d: 'سه‌شنبه', v: 52 }, { d: 'چهارشنبه', v: 61 }, { d: 'پنج‌شنبه', v: 78 }, { d: 'جمعه', v: 69 },
];
const HOURS = [
  { h: '۹', v: 4 }, { h: '۱۱', v: 9 }, { h: '۱۳', v: 7 }, { h: '۱۵', v: 12 },
  { h: '۱۷', v: 16 }, { h: '۱۹', v: 11 }, { h: '۲۱', v: 6 },
];

const SCALE = [
  { icon: <Building2 size={16} />, title: 'چند شعبه، یک حساب', body: 'هر شعبه جایگاه‌ها، پرسنل و صندوق خودش را دارد؛ گزارش‌ها هم جداگانه و هم یک‌جا.' },
  { icon: <KeySquare size={16} />, title: 'نقش و دسترسی', body: 'اپراتور فقط تابلوی جایگاه‌ها را می‌بیند، مدیر شعبه گزارش‌ها را، و صاحب کارواش همه‌چیز را.' },
  { icon: <Palette size={16} />, title: 'لوگو و رنگ خودتان', body: 'پنل و فاکتور با نام و رنگ برند شما، نه با برند ما.' },
  { icon: <FileClock size={16} />, title: 'گزارش فعالیت', body: 'چه کسی تخفیف داد، چه کسی سفارش را لغو کرد، چه ساعتی. همه ثبت می‌شود.' },
  { icon: <Smartphone size={16} />, title: 'روی موبایل همان‌قدر کامل', body: 'تابلو و سفارش روی گوشی اپراتور کار می‌کند؛ نصب هم می‌شود.' },
  { icon: <ShieldCheck size={16} />, title: 'داده‌ی شما، جدا', body: 'اطلاعات هر کارواش کاملاً جدا نگهداری می‌شود و پشتیبان روزانه دارد.' },
];

export const Insight = () => (
  <section className="sw-band sw-band-sky relative py-20 md:py-28" id="reports">
    <Container>
      <SectionHead
        eyebrow="گزارش‌ها"
        tone="violet"
        title="شلوغ‌ترین ساعت کارواش شما کی است؟"
        lead="سیستم جواب می‌دهد، چون هر خودرو، هر دقیقه در جایگاه و هر پرداخت را خودش ثبت کرده است."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="sw-chart-card">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-[13px] font-extrabold text-slate-800">خودروهای هفته</h3>
            <span className="text-[11px] font-bold text-emerald-600">+{fa(23)}٪ نسبت به هفته‌ی قبل</span>
          </div>
          <p className="mb-3 text-[11px] text-slate-400">پنج‌شنبه پرترافیک‌ترین روز است — برای همان روز شیفت بیشتری بگذارید.</p>
          <div className="h-44" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={WEEK} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="swWeek" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} reversed />
                <Tooltip
                  cursor={{ stroke: '#cbd5e1', strokeDasharray: 4 }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11, fontFamily: 'inherit', direction: 'rtl' }}
                  formatter={(v: number) => [`${fa(v)} خودرو`, '']}
                  labelFormatter={l => String(l)}
                />
                <Area type="monotone" dataKey="v" stroke="var(--color-brand-500)" strokeWidth={2.5} fill="url(#swWeek)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="sw-chart-card">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-[13px] font-extrabold text-slate-800">ساعت‌های شلوغ</h3>
            <span className="text-[11px] font-bold text-violet-600">اوج: ساعت {fa(17)}</span>
          </div>
          <p className="mb-3 text-[11px] text-slate-400">ساعت‌های خلوت را با تخفیف پیامکی پر کنید؛ کمپینش از همین پنل ارسال می‌شود.</p>
          <div className="h-44" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HOURS} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                <XAxis dataKey="h" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} reversed />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,.08)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11, fontFamily: 'inherit', direction: 'rtl' }}
                  formatter={(v: number) => [`${fa(v)} خودرو`, '']}
                  labelFormatter={l => `ساعت ${l}`}
                />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  {HOURS.map(h => (
                    <Cell key={h.h} fill={h.v >= 12 ? 'var(--color-brand-500)' : '#c4b5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { l: 'میانگین زمان هر خودرو', v: `${fa(24)} دقیقه`, s: 'از پذیرش تا تحویل' },
          { l: 'بیشترین گلوگاه', v: 'جایگاه خشک', s: `${fa(9)} دقیقه انتظار` },
          { l: 'خوش‌قول‌ترین نفر', v: 'مهدی رستمی', s: `${fa(96)}٪ سر وقت` },
        ].map((c, i) => (
          <Reveal key={c.l} delay={i * 0.05} className="sw-mini-stat">
            <div className="text-[11px] text-slate-400">{c.l}</div>
            <div className="mt-1 text-[16px] font-black text-slate-900">{c.v}</div>
            <div className="text-[10px] text-slate-400">{c.s}</div>
          </Reveal>
        ))}
      </div>

      <div className="mt-20 md:mt-28">
        <SectionHead
          eyebrow="رشد"
          tone="brand"
          title="از یک کارواش تا یک زنجیره"
          lead="همان پنل، وقتی شعبه‌ی دوم را باز می‌کنید یا دیگر خودتان پشت صندوق نیستید."
        />
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCALE.map(s => (
            <StaggerItem key={s.title} className="sw-scale-card group/tilt">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">{s.icon}</span>
              <h3 className="mt-3 text-[13.5px] font-extrabold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-[12px] leading-6 text-slate-500">{s.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <Reveal delay={0.1}>
        <div className="mt-6 grid gap-3 rounded-3xl bg-slate-900 p-6 text-white sm:grid-cols-3 md:p-8">
          {[
            { v: 250, suffix: '+', l: 'کارواش فعال' },
            { v: 1_200_000, suffix: '', l: 'سفارش پردازش‌شده' },
            { v: 98, suffix: '٪', l: 'رضایت کاربران' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <div className="text-2xl font-black md:text-3xl">{faNum(s.v)}{s.suffix}</div>
              <div className="mt-1 text-[11px] text-white/60">{s.l}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </Container>
  </section>
);
