import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Phone, Mail, MapPin, MessageSquare, Send, Sparkles, Check } from 'lucide-react';
import { SectionHeading } from '../../components/public/PublicLayout';
import { api, ApiException } from '../../api';

export const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      // از همان base URL و لایه‌ی API استفاده کن تا درخواست به میزبان بک‌اند برود، نه origin فرانت
      await api.post<void>('/contact', form, 'public');
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSent(false), 5000);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ارسال پیام. لطفاً مجدداً تلاش کنید.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-br from-red-100 via-amber-50 to-transparent rounded-full blur-3xl opacity-70" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 lg:pt-24 pb-10 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-red-100 text-red-600 text-xs font-bold mb-5">
            <Sparkles size={12} />همیشه در دسترس
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 mb-4 leading-[1.1]">
            ما اینجاییم تا{' '}
            <span className="bg-gradient-to-br from-red-500 to-red-800 bg-clip-text text-transparent">کمک</span>{' '}
            کنیم
          </h1>
          <p className="text-gray-600 text-base sm:text-lg leading-8">
            سؤال درباره امکانات، قیمت، یا انتقال داده‌های قدیمی دارید؟ تیم ما در کمتر از ۲ ساعت پاسخ‌گو خواهد بود.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid lg:grid-cols-[1fr_440px] gap-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-7 sm:p-9 shadow-sm">
            <h2 className="text-2xl font-extrabold mb-1.5">پیام بفرستید</h2>
            <p className="text-sm text-gray-500 mb-6">معمولاً در روزهای کاری بین ۹ تا ۱۸ پاسخ می‌دهیم.</p>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 mb-2 block">نام شما</span>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 mb-2 block">ایمیل</span>
                  <input type="email" required dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-2 block">موضوع</span>
                <input type="text" required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-2 block">پیام</span>
                <textarea required rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none" />
              </label>
              <button type="submit" disabled={busy}
                className="w-full bg-gradient-to-br from-red-500 to-red-700 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 hover:scale-[1.01] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100">
                <Send size={16} />{busy ? 'در حال ارسال…' : 'ارسال پیام'}
              </button>
            </form>
            {err && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl border border-red-100 flex items-center gap-2">
                {err}
              </motion.div>
            )}
            {sent && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-2xl border border-emerald-100 flex items-center gap-2">
                <Check size={16} />پیام شما با موفقیت ارسال شد. به زودی پاسخ می‌دهیم.
              </motion.div>
            )}
          </div>

          <div className="space-y-3">
            <InfoCard icon={Phone} title="تلفن" value="۰۲۱-۹۱۰۰۰۰۰۰" hint="روزهای کاری ۹ تا ۱۸" />
            <InfoCard icon={Mail} title="ایمیل" value="info@appsmartwash.com" hint="پاسخ‌گویی ۲۴ ساعته" />
            <InfoCard icon={MessageSquare} title="تلگرام" value="@smartwash_support" hint="چت سریع با تیم پشتیبانی" />
            <InfoCard icon={MapPin} title="دفتر مرکزی" value="تهران، خیابان آزادی، پلاک ۲۲" />
          </div>
        </div>
      </section>
    </>
  );
};

const InfoCard = ({ icon: Icon, title, value, hint }: { icon: any; title: string; value: string; hint?: string }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center">
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="font-bold text-gray-900 truncate" dir="ltr">{value}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  </div>
);

export default Contact;
