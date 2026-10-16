import React from 'react';
import { Link } from 'react-router';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, ArrowLeft, PhoneCall, MessageCircle } from 'lucide-react';
import { Container, Magnetic, MeshBackdrop, Reveal, SectionHead, fa } from '../../../components/landing/kit';

/**
 * The questions that decide a sale, and the one invitation at the end.
 *
 * Owners ask the same five things, and every one of them is a fear: my data, my old records,
 * my staff who are not office people, the internet dropping, and being locked in. Answering
 * them plainly — including the honest "the panel needs a connection" — does more for trust
 * than another page of features.
 */

const FAQ = [
  {
    q: 'اطلاعات مشتری‌های فعلی‌مان را چطور وارد کنیم؟',
    a: 'فهرست مشتری‌ها را به هر شکلی که دارید (اکسل، دفتر، نرم‌افزار قبلی) به ما بدهید؛ تیم پشتیبانی وارد می‌کند. خودتان هم می‌توانید مشتری‌ها را یکی‌یکی یا با فایل اضافه کنید. سابقه‌ی مراجعه و امتیاز وفاداری هم قابل انتقال است.',
  },
  {
    q: 'کارگرهای ما با موبایل راحت نیستند. سخت نیست؟',
    a: 'کار روزانه‌ی اپراتور سه دکمه است: ثبت خودرو روی جایگاه، شروع شستشو، آماده‌ی تحویل. تابلو بزرگ و فارسی است و روی هر گوشی یا تبلتی کار می‌کند. معمولاً نیم‌ساعت آموزش کافی است و راه‌اندازی هم با ما است.',
  },
  {
    q: 'اگر اینترنت قطع شود چه می‌شود؟',
    a: 'پنل برای ثبت سفارش به اینترنت نیاز دارد. برنامه روی گوشی نصب می‌شود و صفحه‌ها سریع بالا می‌آیند، اما توصیه‌ی ما داشتن یک اینترنت پشتیبان (مثلاً دیتای موبایل) است. قطعی‌های کوتاه مشکلی ایجاد نمی‌کند و پس از وصل‌شدن ادامه می‌دهید.',
  },
  {
    q: 'اطلاعات ما کجا نگهداری می‌شود؟',
    a: 'روی سرور داخل ایران، جدا از کارواش‌های دیگر، با پشتیبان‌گیری روزانه. هر زمان بخواهید می‌توانید خروجی اطلاعات خودتان را بگیرید. داده‌ی شما متعلق به خودتان است.',
  },
  {
    q: 'اگر خواستیم ادامه ندهیم، قفل می‌شویم؟',
    a: 'نه. قراردادِ بلندمدت نداریم؛ اشتراک ماهانه هر وقت بخواهید قطع می‌شود و خروجی کامل اطلاعات مشتریان و سفارش‌ها را تحویل می‌گیرید.',
  },
  {
    q: 'چند شعبه را می‌توانیم مدیریت کنیم؟',
    a: 'به تعداد شعبه‌هایی که پلنتان اجازه می‌دهد؛ در پلن مشارکتی محدودیتی نیست. هر شعبه جایگاه‌ها، پرسنل و صندوق جداگانه دارد و گزارش‌ها را هم تکی و هم یک‌جا می‌بینید.',
  },
];

export const FaqCta = () => (
  <>
    <section className="relative py-20 md:py-28" id="faq">
      <Container className="max-w-3xl">
        <SectionHead eyebrow="سوال‌های پرتکرار" tone="emerald" title="چیزهایی که معمولاً می‌پرسند" />

        <Reveal>
          <Accordion.Root type="single" collapsible className="space-y-2.5">
            {FAQ.map((item, i) => (
              <Accordion.Item key={item.q} value={`q${i}`} className="sw-faq">
                <Accordion.Header>
                  <Accordion.Trigger className="sw-faq-trigger group">
                    <span className="flex items-center gap-3 text-right">
                      <span className="text-[11px] font-black text-slate-300">{fa(String(i + 1).padStart(2, '0'))}</span>
                      <span className="text-[13.5px] font-extrabold text-slate-900">{item.q}</span>
                    </span>
                    <ChevronDown size={16} className="flex-shrink-0 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="sw-faq-content">
                  <p className="px-5 pb-5 pt-0 text-[12.5px] leading-7 text-slate-600">{item.a}</p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </Reveal>
      </Container>
    </section>

    <section className="relative overflow-hidden py-16 md:py-24" id="start">
      <Container>
        <Reveal>
          <div className="sw-cta">
            <MeshBackdrop className="opacity-60" />
            <div className="relative text-center">
              <h2 className="text-balance text-3xl font-black leading-[1.25] text-slate-900 md:text-[2.7rem]">
                فردا صبح، اولین خودرو را با <span className="sw-title-accent">SmartWash</span> بپذیرید
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-[14px] leading-8 text-slate-600 md:text-[15.5px]">
                ثبت‌نام چند دقیقه طول می‌کشد، راه‌اندازی جایگاه‌ها و خدمات با تیم ما است و
                ۱۴ روز اول رایگان است — بدون کارت بانکی، بدون قرارداد.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Magnetic>
                  <Link to="/register" className="sw-btn sw-btn-primary sw-btn-lg">
                    <span>شروع رایگان</span>
                    <ArrowLeft size={17} />
                  </Link>
                </Magnetic>
                <Link to="/contact" className="sw-btn sw-btn-ghost sw-btn-lg">
                  <MessageCircle size={16} />
                  <span>سوال دارم، مشاوره می‌خواهم</span>
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11.5px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><PhoneCall size={13} className="text-brand-500" />پشتیبانی فارسی</span>
                <span>راه‌اندازی رایگان</span>
                <span>بدون قرارداد بلندمدت</span>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  </>
);
