import React from 'react';
import { motion } from 'motion/react';
import {
  Car, CalendarClock, Users, LineChart, Bell, CreditCard, Sparkles, Shield, Smartphone,
  MessageSquare, Award, Wallet, Building2, ClipboardList, Receipt, Zap,
} from 'lucide-react';
import { CtaBanner, SectionHeading } from '../../components/public/PublicLayout';

const groups = [
  {
    title: 'عملیات روزمره',
    items: [
      { icon: Car, t: 'مدیریت جایگاه‌ها', d: 'نقشه زنده وضعیت تمام جایگاه‌ها، تایمر سفارش، تخصیص پرسنل و تعمیرات.' },
      { icon: CalendarClock, t: 'رزرواسیون', d: 'تقویم گرافیکی روز/هفته، تأیید رزرو، یادآور پیامکی و مدیریت تاخیر.' },
      { icon: ClipboardList, t: 'سفارش‌گذاری سریع', d: 'افزودن خدمات با یک کلیک، تخصیص کارگر هر آیتم، تخفیف و خدمت رایگان وفاداری.' },
      { icon: Receipt, t: 'فاکتور و چاپ', d: 'چاپ فاکتور حرارتی یا A4 با لوگوی اختصاصی، پیش‌فاکتور و ارسال SMS.' },
    ],
  },
  {
    title: 'مشتری‌مداری',
    items: [
      { icon: Users, t: 'باشگاه مشتریان', d: 'پروفایل کامل، خودرو‌ها، سابقه خرید و یادداشت‌های شخصی برای هر مشتری.' },
      { icon: Award, t: 'سیستم وفاداری', d: 'سطح‌بندی برنزی/نقره‌ای/طلایی/پلاتین، امتیازدهی و خدمت رایگان.' },
      { icon: Wallet, t: 'کیف پول', d: 'شارژ نقدی، استفاده در سفارش‌ها و گزارش گردش کیف پول مشتری.' },
      { icon: MessageSquare, t: 'کمپین‌های پیامکی', d: 'هدف‌گیری بر اساس مدت زمان عدم مراجعه، سطح وفاداری یا تولد مشتری.' },
    ],
  },
  {
    title: 'مدیریت و مالی',
    items: [
      { icon: LineChart, t: 'گزارش‌های زنده', d: 'درآمد، سفارش، مشتری جدید، عملکرد کارگر و سود خالص لحظه‌ای.' },
      { icon: CreditCard, t: 'صندوق و شیفت', d: 'باز/بسته شدن شیفت، تطبیق نقدی، مغایرت و خروجی شیفت.' },
      { icon: Building2, t: 'چندشعبه‌ای', d: 'گزارش جامع چندشعبه‌ای، تنظیمات و قیمت‌گذاری مستقل هر شعبه.' },
      { icon: Wallet, t: 'مدیریت هزینه', d: 'ثبت هزینه‌ها در دسته‌های مختلف، حقوق، اجاره، تأمین و …' },
    ],
  },
  {
    title: 'فناوری و امنیت',
    items: [
      { icon: Shield, t: 'امنیت ابری', d: 'رمزنگاری TLS، JWT با چرخش، رمزعبور BCrypt و دسترسی نقش‌محور.' },
      { icon: Smartphone, t: 'سازگار با موبایل', d: 'رابط واکنش‌گرا برای موبایل، تبلت و کیوسک لمسی.' },
      { icon: Bell, t: 'اعلان‌های هوشمند', d: 'هشدار سفارش‌های طولانی، رزرو نزدیک، مشتری در خطر ریزش.' },
      { icon: Zap, t: 'API و یکپارچگی', d: 'API REST برای اتصال به سامانه حسابداری، باشگاه و پنل پیامکی.' },
    ],
  },
];

export const Features = () => {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-br from-red-100 via-amber-50 to-transparent rounded-full blur-3xl opacity-70" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 lg:pt-24 pb-12 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-red-100 text-red-600 text-xs font-bold mb-5">
            <Sparkles size={12} />نگاهی به امکانات کامل
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 mb-4 leading-[1.1]">
            بیش از <span className="bg-gradient-to-br from-red-500 to-red-800 bg-clip-text text-transparent">۵۰ امکان</span> برای رشد کارواش شما
          </h1>
          <p className="text-gray-600 text-base sm:text-lg leading-8">
            هر آنچه در یک کارواش حرفه‌ای نیاز است، در یک سامانه یکپارچه — از پذیرش تا گزارش.
          </p>
        </div>
      </section>

      {groups.map((g, gi) => (
        <section key={gi} className={gi % 2 === 0 ? '' : 'bg-gradient-to-br from-gray-50 to-white border-y border-gray-100'}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <SectionHeading title={g.title} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {g.items.map((it, i) => {
                const Icon = it.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center mb-4">
                      <Icon size={18} />
                    </div>
                    <h3 className="font-extrabold text-base mb-1.5">{it.t}</h3>
                    <p className="text-xs text-gray-500 leading-7">{it.d}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      <CtaBanner />
    </>
  );
};

export default Features;
