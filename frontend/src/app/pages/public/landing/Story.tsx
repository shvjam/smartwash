import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, useInView, useTransform, type MotionValue } from 'motion/react';
import { Car, CircleCheck, Droplets, LayoutGrid, Lock } from 'lucide-react';
import { Particles, Sparkle, Split, Stroke, View, Wobble, useCinematic, useProgress } from './kit';
import {
  BranchesScreen, BusyHoursWidget, CampaignWidget, IntakeWidget, LoyaltyWidget, OrderScreen, PhoneFrame,
  QueueWidget, ReadySmsWidget, SettleWidget, StaffWidget, TabletFrame, TimerWidget,
} from './mockups';

/* ── about: a headline that dissolves into the paragraph behind it ───────── */

const PARAGRAPH =
  'ساعت شش عصر است و چهار خودرو در حیاط. SmartWash هر خودرو را از پذیرش تا تحویل روی همان جایگاهِ خودش دنبال می‌کند، در «آماده تحویل» جایگاه را برای خودروی بعدی آزاد می‌کند، و تا مانده‌ی حساب صفر نشود، دکمه‌ی تحویل را قفل نگه می‌دارد.';

/** The small animated pictures inside the headline's pills. */
const AboutGlyph = ({ kind }: { kind: 1 | 2 | 3 }) => {
  if (kind === 1) {
    return (
      <span className="relative grid h-full w-full place-items-center">
        <Car className="h-[45%] w-[45%] animate-[swl-drive_3s_ease-in-out_infinite]" strokeWidth={1.6} />
        <span className="absolute bottom-[22%] h-px w-[58%] bg-gradient-to-l from-transparent via-white/50 to-transparent" />
      </span>
    );
  }
  if (kind === 2) {
    return (
      <span className="relative grid h-full w-full place-items-center overflow-hidden">
        {[0, 1, 2, 3, 4].map(i => (
          <Droplets key={i} className="absolute h-[22%] w-[22%] text-[#fca5a5] animate-[swl-drop_2.2s_linear_infinite]"
            style={{ left: `${14 + i * 16}%`, animationDelay: `${i * 0.42}s` }} strokeWidth={1.8} />
        ))}
      </span>
    );
  }
  return (
    <span className="grid h-[52%] w-[40%] grid-cols-2 gap-[10%]">
      {[0, 1, 2, 3].map(i => (
        <span key={i} className="rounded-[22%] bg-white/15 animate-[swl-cell_2.4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.6}s` }} />
      ))}
    </span>
  );
};

const AboutIcon = ({ kind, on, delay }: { kind: 1 | 2 | 3; on: boolean; delay: number }) => (
  <span className={`swl-about-icon ${on ? 'is-in' : ''}`} data-tone={kind} style={{ transitionDelay: `${delay}s` }} aria-hidden="true">
    <AboutGlyph kind={kind} />
  </span>
);

/** One element of the headline that slides away and blurs out as the section scrolls. */
const Mover = ({ p, i, children }: { p: MotionValue<number>; i: number; children: React.ReactNode }) => {
  const s = 0.05 + i * 0.035;
  const x = useTransform(p, [s, s + 0.26], ['0rem', '-20rem']);
  const opacity = useTransform(p, [s, s + 0.26], [1, 0]);
  const filter = useTransform(p, [s, s + 0.26], ['blur(0rem)', 'blur(0.6rem)']);
  return <motion.span className="inline-flex items-center" style={{ x, opacity, filter }}>{children}</motion.span>;
};

const PgWord = ({ w, p, range, first }: { w: string; p: MotionValue<number>; range: [number, number]; first?: boolean }) => {
  const x = useTransform(p, range, ['20rem', '0rem']);
  const opacity = useTransform(p, range, [0, 1]);
  const filter = useTransform(p, range, ['blur(0.6rem)', 'blur(0rem)']);
  return <motion.span className={`swl-about-pg-w ${first ? 'font-bold text-[#f87171]' : ''}`} style={{ x, opacity, filter }}>{w}</motion.span>;
};

/** The paragraph, revealed line by line: words in each line arrive one after another. */
const PinnedParagraph = ({ p }: { p: MotionValue<number> }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = PARAGRAPH.split(' ');
  const [ranges, setRanges] = useState<[number, number][]>(() => words.map(() => [0.45, 0.95]));
  useLayoutEffect(() => {
    const measure = () => {
      const spans = Array.from(ref.current?.querySelectorAll<HTMLElement>('.swl-about-pg-w') ?? []);
      const lines: number[][] = [];
      spans.forEach((s, i) => {
        if (i === 0 || s.offsetTop !== spans[i - 1].offsetTop) lines.push([]);
        lines[lines.length - 1].push(i);
      });
      const out: [number, number][] = words.map(() => [0.45, 0.95]);
      const [a, b] = [0.42, 0.94];
      lines.forEach(line => {
        const total = 1 + 0.2 * (line.length - 1);
        line.forEach((idx, k) => {
          out[idx] = [a + ((k * 0.2) / total) * (b - a), a + ((k * 0.2 + 1) / total) * (b - a)];
        });
      });
      setRanges(out);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <p ref={ref} className="swl-about-pg-text">
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <PgWord w={w} p={p} range={ranges[i]} first={i === 0 || w === 'SmartWash'} />{i < words.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </p>
  );
};

export const About = () => {
  const cinematic = useCinematic();
  const ref = useRef<HTMLElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const on = useInView(head, { once: true, amount: 0.3 });
  const p = useProgress(ref, ['start start', 'end end']);
  const lift = useTransform(p, [0.27, 0.47], ['0rem', '-24rem']);

  if (!cinematic) {
    return (
      <section className="relative py-24" aria-labelledby="swl-about-title">
        <div className="swl-container text-center">
          <h2 id="swl-about-title" ref={head} className="flex flex-col items-center gap-3">
            <span className="sr-only">پذیرش تا تحویل، روی یک تابلو</span>
            <span className="swl-about-m-line" aria-hidden="true">پذیرش <AboutIcon kind={1} on={on} delay={0} /> تا</span>
            <span className="swl-about-m-line" aria-hidden="true">تحویل <AboutIcon kind={2} on={on} delay={0.1} /> <span className="swl-about-faded">روی</span></span>
            <span className="swl-about-m-line" aria-hidden="true">یک <AboutIcon kind={3} on={on} delay={0.2} /> تابلو</span>
          </h2>
          <Split as="p" text={PARAGRAPH} preset="down" stagger={0.03} className="mx-auto mt-14 block max-w-[34rem] text-[1.35rem] leading-[1.9]" />
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="swl-about-height" aria-labelledby="swl-about-title">
      <div className="swl-about-pin">
        <div className="swl-glow" style={{ height: '70vh', maxHeight: '50rem', opacity: 0.2 }} />
        <h2 id="swl-about-title" ref={head} className="relative flex flex-col items-center">
          <span className="sr-only">پذیرش تا تحویل، روی یک تابلو</span>
          <span className="swl-about-line" aria-hidden="true">
            <Mover p={p} i={0}>پذیرش</Mover>
            <Mover p={p} i={1}><AboutIcon kind={1} on={on} delay={0} /></Mover>
            <Mover p={p} i={2}>تا</Mover>
          </span>
          <span className="swl-about-line" aria-hidden="true">
            <Mover p={p} i={3}>تحویل</Mover>
            <Mover p={p} i={4}><AboutIcon kind={2} on={on} delay={0.1} /></Mover>
            <Mover p={p} i={5}><span className="swl-about-faded">روی</span></Mover>
          </span>
          <span className="swl-about-line" aria-hidden="true">
            <Mover p={p} i={6}>یک</Mover>
            <motion.span className="inline-flex items-center" style={{ y: lift }}>
              <AboutIcon kind={3} on={on} delay={0.2} />تابلو
            </motion.span>
          </span>
        </h2>
      </div>
      <div className="swl-about-pg">
        <div className="swl-about-pg-pin swl-container">
          <PinnedParagraph p={p} />
        </div>
      </div>
    </section>
  );
};

/* ── how it works: the journey, with floating cards and live widgets ──────── */

const STEPS = [
  { icon: Car, title: 'پلاک را بزنید، جایگاه را انتخاب کنید', body: 'خودرو تا آخر روی همان جایگاه می‌ماند؛ هیچ مرحله‌ای دوباره جایگاه نمی‌پرسد.' },
  { icon: Droplets, title: 'شستشو، خشک‌کردن و خدمات آپشن', body: 'هر مرحله با یک دکمه جلو می‌رود و زمانش خودکار ثبت می‌شود.' },
  { icon: CircleCheck, title: 'آماده تحویل: جایگاه آزاد می‌شود', body: 'خودروی بعدی منتظر تسویه‌ی قبلی نمی‌ماند؛ ظرفیت بیشتر، بدون جایگاه بیشتر.' },
  { icon: Lock, title: 'تا مانده صفر نشود، تحویل قفل است', body: 'هیچ خودرویی بدون تسویه از کارواش بیرون نمی‌رود.' },
];

const StepCard = ({ i, star }: { i: number; star?: MotionValue<number> }) => {
  const s = STEPS[i];
  const Icon = s.icon;
  return (
    <div className="swl-hw-card-block">
      <div className="swl-hw-card">
        <div className="swl-hw-card-blur" />
        <span className="swl-hw-step">{`۰${(i + 1).toLocaleString('fa-IR')}`}</span>
        <span className="swl-hw-icon"><Icon className="size-[45%]" strokeWidth={1.8} /></span>
        <div className="relative z-[1] flex flex-col gap-[.84rem]">
          <Split as="h3" text={s.title} className="swl-h4" />
          <Split as="p" text={s.body} className="swl-body swl-dim" delay={0.15} />
        </div>
        <motion.div className="swl-hw-star" style={{ rotate: star }}><Sparkle className="h-full w-full" /></motion.div>
      </div>
    </div>
  );
};

type Spot = { top?: string; bottom?: string; start?: string; end?: string; from?: number; to?: number; node: (star: MotionValue<number>) => React.ReactNode };
const SPOTS: Spot[] = [
  { top: '33%', start: '19%', from: 20, to: -40, node: star => <StepCard i={0} star={star} /> },
  { top: '40%', start: '55%', node: star => <StepCard i={1} star={star} /> },
  { top: '63%', start: '15%', from: 50, to: -50, node: star => <StepCard i={2} star={star} /> },
  { top: '72%', end: '14%', node: star => <StepCard i={3} star={star} /> },
  { top: '17%', start: '11%', from: 20, to: -50, node: () => <IntakeWidget /> },
  { top: '27%', start: '45%', from: 50, to: -100, node: () => <TimerWidget /> },
  { top: '52%', end: '7%', from: 60, to: -80, node: () => <QueueWidget /> },
  { top: '81%', end: '37%', from: 20, to: -10, node: () => <SettleWidget /> },
  { bottom: '0%', start: '26%', from: 20, to: -40, node: () => <ReadySmsWidget /> },
];

const Spotted = ({ spot, p, star }: { spot: Spot; p: MotionValue<number>; star: MotionValue<number> }) => {
  const y = useTransform(p, [0, 1], [`${spot.from ?? 0}rem`, `${spot.to ?? 0}rem`]);
  return (
    <motion.div className="swl-hw-pos" style={{ top: spot.top, bottom: spot.bottom, insetInlineStart: spot.start, insetInlineEnd: spot.end, y }}>
      <View><Wobble>{spot.node(star)}</Wobble></View>
    </motion.div>
  );
};

export const HowItWorks = () => {
  const cinematic = useCinematic();
  const ref = useRef<HTMLElement>(null);
  const p = useProgress(ref, ['start end', 'end start']);
  const headY = useTransform(p, [0, 1], ['10%', '240%']);
  const star = useTransform(p, [0, 1], [0, 360]);

  if (!cinematic) {
    const order = [0, 4, 5, 1, 6, 8, 2, 7, 3];
    return (
      <section id="how" className="relative scroll-mt-20 py-20" aria-labelledby="swl-how-title">
        <div className="swl-container">
          <h2 id="swl-how-title" className="mb-12 text-center text-[3.2rem] font-extrabold leading-[1.2]">
            <Split text="مسیر ثابت" preset="right" /> <span className="font-light text-[#6b696b]"><Split text="خودرو" preset="right" delay={0.2} /></span>
          </h2>
          <div className="mx-auto flex max-w-[30rem] flex-col items-center gap-6">
            {order.map(i => (
              <View key={i} className={i < 4 ? 'w-full' : ''}>{SPOTS[i].node(star)}</View>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="how" ref={ref} className="relative" aria-labelledby="swl-how-title">
      <div className="swl-container swl-hw">
        <div className="swl-hw-sticky">
          <motion.h2 id="swl-how-title" className="swl-hw-headline" style={{ y: headY }}>
            <Split text="مسیر ثابت" preset="right" /> <span className="swl-hw-gray"><Split text="خودرو" preset="right" delay={0.25} /></span>
          </motion.h2>
        </div>
        <div className="swl-hw-front">
          {SPOTS.map((s, i) => <Spotted key={i} spot={s} p={p} star={star} />)}
        </div>
      </div>
    </section>
  );
};

/* ── features: four columns of the rest of the product ───────────────────── */

const FEATURES = [
  { title: 'باشگاه مشتریان و کیف پول', body: 'پرونده‌ی هر مشتری با شماره‌ی تلفن و خودروهایش؛ امتیاز وفاداری، کیف پول و دسته‌بندی مشتریان.', widget: <LoyaltyWidget /> },
  { title: 'پرسنل، شیفت و سهم هر نفر', body: 'کارمزد هر خدمت خودکار حساب می‌شود؛ برنامه‌ی شیفت، تسویه‌ی انعام و کارنامه‌ی خوش‌قولی.', widget: <StaffWidget /> },
  { title: 'گزارش‌ها و گلوگاه‌ها', body: 'فروش، عملکرد هر جایگاه، ساعت‌های شلوغ، و اینکه چه کسی تخفیف داد یا سفارشی را لغو کرد.', widget: <BusyHoursWidget /> },
  { title: 'پیامک، یادآور و کمپین', body: 'یادآور خدمت بعدی و کمپین برای مشتریانی که برنگشته‌اند، از سامانه‌ی پیامکی خود پلتفرم.', widget: <CampaignWidget /> },
];

const FeatText = ({ i }: { i: number }) => (
  <div className="relative z-[1] flex max-w-[22rem] flex-col items-center gap-3">
    <Split as="h3" text={FEATURES[i].title} className="swl-h3" />
    <Split as="p" text={FEATURES[i].body} className="swl-body swl-dim" delay={0.15} />
  </div>
);

export const Features = () => (
  <section id="features" className="relative scroll-mt-20" aria-labelledby="swl-feat-title">
    <h2 id="swl-feat-title" className="sr-only">امکانات</h2>
    <div className="swl-container py-16 lg:py-[6.25rem]">
      <div className="swl-feat">
        <div className="swl-feat-item">
          <div className="swl-feat-blur" style={{ top: '17%', insetInlineStart: '19%', width: '16rem' }} />
          <View className="relative z-[1] w-[15.8rem] max-w-full">{FEATURES[0].widget}</View>
          <FeatText i={0} />
        </div>
        <div className="swl-feat-line" />
        <div className="swl-feat-item">
          <FeatText i={1} />
          <View className="relative z-[1] w-[15.8rem] max-w-full">{FEATURES[1].widget}</View>
          <div className="swl-feat-blur" style={{ bottom: '12%', insetInlineStart: '22%' }} />
        </div>
        <div className="swl-feat-line" />
        <div className="flex flex-col">
          <div className="swl-feat-row flex-1">
            <div className="swl-feat-blur" style={{ top: '20%', insetInlineStart: '6%' }} />
            <View className="relative z-[1] w-[19rem] max-w-full flex-none">{FEATURES[2].widget}</View>
            <FeatText i={2} />
          </div>
          <div className="swl-feat-row flex-1">
            <div className="swl-feat-blur" style={{ top: '25%', insetInlineStart: '8%' }} />
            <View className="relative z-[1] w-[16rem] max-w-full flex-none">{FEATURES[3].widget}</View>
            <FeatText i={3} />
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ── stacking cards: one site, many sites ─────────────────────────────────── */

const CARDS = [
  {
    tag: 'برای کارواش‌های تک‌شعبه', title: 'حیاط شلوغ، حساب مرتب',
    body: 'از شلوغی عصر تا بستن صندوق: هر خودرو با پلاکش ثبت می‌شود، هر مرحله با یک دکمه جلو می‌رود و هر ریال در شیفت خودش می‌نشیند. نه دفتر، نه حدس.',
  },
  {
    tag: 'برای مجموعه‌های چندشعبه', title: 'همه‌ی شعبه‌ها، یک گزارش',
    body: 'هر شعبه جایگاه‌ها و صندوق خودش را دارد و گزارشش جداست؛ شما همه را یک‌جا می‌بینید. اپراتور فقط تابلو را می‌بیند، مدیر شعبه گزارش‌ها را، و مالک همه‌چیز را.',
  },
];

const StackCircle = () => (
  <svg viewBox="0 0 200 200" className="swl-stack-circle" aria-hidden="true">
    {[96, 80, 64, 48, 32].map((r, i) => (
      <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={i === 1 ? '#ef4444' : '#fff'} strokeOpacity={i === 1 ? 0.5 : 0.14} strokeWidth=".4" strokeDasharray={i === 3 ? '1 3' : undefined} />
    ))}
  </svg>
);

const StackCard = ({ i, desktop }: { i: 0 | 1; desktop: boolean }) => {
  const c = CARDS[i];
  return (
    <Stroke className="swl-stack-card-stroke">
      <div className="swl-stack-card"
        style={i === 1 ? { backgroundImage: 'radial-gradient(70% 90% at 15% 100%, rgba(185,28,28,.35), transparent 70%), radial-gradient(50% 60% at 100% 0%, rgba(255,107,94,.12), transparent 70%)' } : { backgroundImage: 'radial-gradient(60% 80% at 20% 110%, rgba(220,38,38,.28), transparent 70%)' }}>
        <StackCircle />
        <div className="relative z-[2] flex flex-col items-start">
          <span className="swl-tag">{c.tag}</span>
          <Split as="h2" text={c.title} className="swl-h2" preset="down" />
          <Split as="p" text={c.body} className="swl-body swl-dim mt-[1.1rem] block lg:w-[28rem]" delay={0.2} stagger={0.025} />
        </div>
        {i === 0 ? (
          <div className={desktop ? 'absolute bottom-[-17rem] left-[16%] z-[3]' : 'relative mx-auto mt-10 -mb-48 h-[24rem] overflow-hidden'} aria-hidden="true">
            <PhoneFrame style={{ fontSize: desktop ? '1rem' : '.92rem', transform: desktop ? 'perspective(2000px) rotateX(8deg) rotateZ(8deg)' : undefined }}>
              <OrderScreen />
            </PhoneFrame>
          </div>
        ) : (
          <div className={desktop ? 'absolute bottom-[-4.5rem] left-[-2rem] z-[3]' : 'relative mt-10 -mb-8 overflow-hidden'} aria-hidden="true">
            <TabletFrame style={{ fontSize: desktop ? '1rem' : 'min(calc((100vw - 5.75rem) / 43), .5rem)', transform: desktop ? 'perspective(2400px) rotateY(12deg) rotateX(4deg)' : undefined }}>
              <BranchesScreen />
            </TabletFrame>
          </div>
        )}
        <Particles density={0.35} />
      </div>
    </Stroke>
  );
};

export const Stack = () => {
  const cinematic = useCinematic();
  const ref = useRef<HTMLElement>(null);
  const p = useProgress(ref, ['start end', 'end start']);
  const y1 = useTransform(p, [0.34, 0.65], ['0vh', '-100vh']);
  const s2 = useTransform(p, [0.34, 0.65], [0.8, 1]);
  const y2 = useTransform(p, [0.34, 0.65], ['10vh', '0vh']);
  const o2 = useTransform(p, [0.34, 0.45], [0.28, 1]);

  if (!cinematic) {
    return (
      <section className="relative py-12" aria-label="برای چه کارواشی">
        <div className="swl-container flex flex-col gap-6">
          <View><StackCard i={0} desktop={false} /></View>
          <View><StackCard i={1} desktop={false} /></View>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="swl-stack-height" aria-label="برای چه کارواشی">
      <div className="swl-stack-sticky">
        <div className="swl-container flex h-full items-center justify-center">
          <motion.div className="swl-stack-wrap z-[5]" style={{ y: y1 }}>
            <View><StackCard i={0} desktop /></View>
          </motion.div>
          <motion.div className="swl-stack-wrap absolute z-[4]" style={{ y: y2, scale: s2, opacity: o2 }}>
            <StackCard i={1} desktop />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
