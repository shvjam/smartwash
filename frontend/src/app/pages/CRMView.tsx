import { IranPlateInput } from '../components/forms/IranPlateInput';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useCarWash } from '../store';
import { UserPlus, MessageCircle, AlertTriangle, CheckCircle, Gift, Crown, Search, Phone, Sparkles, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { PageHeader, StatCard, EmptyState } from '../components/app/PageHeader';

type FilterKey = 'all' | 'loyal' | 'inactive' | 'reward_available';

export const CRMView = () => {
  const { customers, addCustomer, sendCustomerMessage, loyaltyProgress } = useCarWash();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [reminderTo, setReminderTo] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', plate: '' });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const enriched = useMemo(() => customers.map(c => {
    const daysSince = Math.floor((Date.now() - new Date(c.lastVisitDate).getTime()) / 86400000);
    const lp = loyaltyProgress(c);
    const status: 'good' | 'warning' | 'danger' =
      daysSince > 30 ? 'danger' : daysSince > 15 ? 'warning' : 'good';
    return { ...c, daysSince, loyalty: lp, status };
  }), [customers, loyaltyProgress]);

  const filtered = useMemo(() => enriched.filter(c => {
    if (search && !c.name.includes(search) && !c.phone.includes(search) && !c.plate.includes(search)) return false;
    if (filter === 'loyal' && !c.isLoyal) return false;
    if (filter === 'inactive' && c.daysSince <= 30) return false;
    if (filter === 'reward_available' && !c.loyalty.available) return false;
    return true;
  }), [enriched, search, filter]);

  const counts = {
    all: enriched.length,
    loyal: enriched.filter(c => c.isLoyal).length,
    inactive: enriched.filter(c => c.daysSince > 30).length,
    reward_available: enriched.filter(c => c.loyalty.available).length,
  };

  const totalSpent = enriched.reduce((s, c) => s + c.totalSpent, 0);

  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2000); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    if (!form.name.trim() || form.name.trim().length < 2) return setFormErr('نام باید حداقل ۲ کاراکتر باشد');
    if (!/^09\d{9}$/.test(form.phone.trim())) return setFormErr('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود');
    setSaving(true);
    try {
      await addCustomer(form);
      setForm({ name: '', phone: '', plate: '' });
      setShowForm(false);
      showToast('مشتری جدید ثبت شد ✓');
    } catch (err: any) {
      setFormErr(err?.message ?? 'خطا در ثبت مشتری');
    } finally {
      setSaving(false);
    }
  };

  const handleSendReminder = async (id: string, msg: string) => {
    if (!msg.trim()) return;
    try {
      await sendCustomerMessage(id, msg);
      setReminderTo(null);
      showToast('پیام برای مشتری ارسال شد ✓');
    } catch {
      showToast('خطا در ارسال پیام');
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-5">
      <PageHeader
        title="باشگاه مشتریان"
        subtitle="با هر ۳ خدمت، یک سرویس رایگان به مشتری هدیه می‌شود"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-2xl text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/20"
          >
            <UserPlus size={18} /> افزودن مشتری
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard accent="sky" label="کل مشتریان" value={counts.all} />
        <StatCard accent="amber" label="مشتری وفادار" value={counts.loyal} hint="وفادار با بیش از ۳ خدمت" />
        <StatCard accent="emerald" label="جایزه قابل دریافت" value={counts.reward_available} />
        <StatCard accent="red" label="نیاز به یادآوری" value={counts.inactive} hint="بیش از ۳۰ روز غایب" />
      </div>

      {/* Filters + search */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام، تلفن یا پلاک..."
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pr-12 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {([
            { key: 'all', label: 'همه' },
            { key: 'loyal', label: 'وفادار' },
            { key: 'reward_available', label: 'جایزه آماده' },
            { key: 'inactive', label: 'غیرفعال' },
          ] as { key: FilterKey; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
                filter === f.key ? 'bg-brand-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label} <span className="opacity-60">({counts[f.key as keyof typeof counts]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Customer cards / table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c, idx) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.02 }}
            className={clsx(
              'relative bg-white rounded-3xl border shadow-sm p-4 group overflow-hidden',
              c.loyalty.available ? 'border-emerald-200' : 'border-gray-100'
            )}
          >
            {c.loyalty.available && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            )}
            {c.isLoyal && (
              <div className="absolute top-3 left-3">
                <Crown size={16} className="text-yellow-500 fill-yellow-400 drop-shadow-md" />
              </div>
            )}

            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-extrabold text-lg flex-shrink-0">
                {c.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/app/customers/${c.id}`} className="font-extrabold text-gray-900 truncate hover:text-brand-600 block">{c.name}</Link>
                <div className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">{c.phone}</div>
                <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">{c.plate}</div>
              </div>
            </div>

            {/* Loyalty progress */}
            <div className="bg-gray-50 rounded-2xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-600 flex items-center gap-1">
                  <Gift size={11} /> پیشرفت وفاداری
                </span>
                <span className="text-[10px] text-gray-500">{c.loyalty.progress}/3</span>
              </div>
              <div className="flex gap-1.5 mb-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className={clsx(
                    'flex-1 h-2 rounded-full transition-all',
                    i < c.loyalty.progress ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gray-200'
                  )} />
                ))}
              </div>
              {c.loyalty.available ? (
                <div className="bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg px-2 py-1 flex items-center gap-1.5 justify-center">
                  <Sparkles size={11} /> یک خدمت رایگان آماده دریافت!
                </div>
              ) : (
                <div className="text-[10px] text-gray-500 text-center">
                  {3 - c.loyalty.progress} سرویس تا جایزه بعدی
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="مراجعات" value={c.totalVisits} />
              <Stat label="جایزه" value={`${c.freeServicesUsed}/${c.freeServicesEarned}`} />
              <Stat label="خرید کل" value={`${(c.totalSpent / 1000000).toFixed(1)}م`} />
            </div>

            {/* Last visit + actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-[11px]">
                {c.status === 'danger' && <AlertTriangle size={12} className="text-red-500" />}
                {c.status === 'warning' && <AlertTriangle size={12} className="text-amber-500" />}
                {c.status === 'good' && <CheckCircle size={12} className="text-emerald-500" />}
                <span className={clsx(
                  c.status === 'danger' ? 'text-red-600' :
                  c.status === 'warning' ? 'text-amber-600' : 'text-gray-500'
                )}>
                  {formatDistanceToNow(parseISO(c.lastVisitDate), { addSuffix: true, locale: faIR })}
                </span>
              </div>
              <button
                onClick={() => setReminderTo(c.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors',
                  c.status === 'danger'
                    ? 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <MessageCircle size={12} /> پیامک
              </button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3">
            <EmptyState icon={Sparkles} title="مشتری‌ای یافت نشد" hint="فیلتر یا جستجو را تغییر دهید." />
          </div>
        )}
      </div>

      {/* Add customer modal */}
      <AnimatePresence>
        {showForm && (
          <Modal onClose={() => setShowForm(false)}>
            <h3 className="text-xl font-extrabold mb-1">افزودن مشتری جدید</h3>
            <p className="text-xs text-gray-500 mb-5">اطلاعات تماس و خودرو مشتری را وارد کنید</p>
            <form onSubmit={handleAdd} className="space-y-3">
              <input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="نام و نام خانوادگی" minLength={2} maxLength={100} autoComplete="name"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              <input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09123456789" type="tel" dir="ltr" inputMode="tel" pattern="09[0-9]{9}" title="شماره موبایل ۱۱ رقمی"
                autoComplete="tel"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              <IranPlateInput value={form.plate} onChange={plate => setForm({ ...form, plate })} />
              {formErr && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-xl">{formErr}</div>}
              <button type="submit" disabled={saving} className="w-full bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white font-bold py-3 rounded-2xl shadow-lg shadow-brand-500/25 disabled:opacity-60">
                {saving ? 'در حال ثبت…' : 'ثبت مشتری'}
              </button>
            </form>
          </Modal>
        )}

        {reminderTo && (
          <ReminderModal
            customer={enriched.find(c => c.id === reminderTo)!}
            onClose={() => setReminderTo(null)}
            onSend={(msg) => handleSendReminder(reminderTo, msg)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="text-center bg-gray-50 rounded-xl py-2">
    <div className="text-[9px] text-gray-500 mb-0.5">{label}</div>
    <div className="text-xs font-extrabold text-gray-900 font-mono">{value}</div>
  </div>
);

const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      dir="rtl"
      className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-5 sm:p-7 mx-3"
    >
      <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-gray-50 rounded-full hover:bg-gray-100">
        <X size={16} />
      </button>
      {children}
    </motion.div>
  </div>
);

const PRESET_MESSAGES = [
  'سلام {name} عزیز 🌟 چند هفته‌ای از آخرین مراجعتون می‌گذره. به مناسبت بازگشتت ۲۰٪ تخفیف برات در نظر گرفتیم! منتظریم 💧',
  'سلام {name} 🚗 خبر خوب! یک شستشوی رایگان برات آماده شده. هر زمان دوست داشتی بیا 🎁',
  'وقتت بخیر {name} ✨ ماشینت دلش هوای براق شدن کرده 😊 یک جایگاه VIP برات نگه داشتیم.',
];

const ReminderModal = ({ customer, onClose, onSend }: any) => {
  const [msg, setMsg] = useState(PRESET_MESSAGES[0].replace('{name}', customer.name));
  const [sending, setSending] = useState(false);
  const handleSend = async () => {
    if (sending || !msg.trim()) return;
    setSending(true);
    try { await onSend(msg); } finally { setSending(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-xl font-extrabold mb-1">ارسال پیام به مشتری</h3>
      <div className="flex items-center gap-2 mb-5 text-sm">
        <Phone size={14} className="text-gray-400" />
        <span className="font-bold">{customer.name}</span>
        <span className="text-gray-400 font-mono text-xs">— {customer.phone}</span>
      </div>

      <div className="text-[10px] text-gray-500 mb-2">قالب‌های آماده:</div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {PRESET_MESSAGES.map((m, i) => (
          <button
            key={i}
            onClick={() => setMsg(m.replace('{name}', customer.name))}
            className="text-[10px] px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700"
          >
            قالب {i + 1}
          </button>
        ))}
      </div>

      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        rows={5}
        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 mb-3"
      />

      {customer.loyalty.available && (
        <div className="bg-emerald-50 text-emerald-700 rounded-xl p-2.5 text-xs flex items-center gap-2 mb-3">
          <Gift size={14} /> این مشتری یک خدمت رایگان آماده دریافت دارد! حتماً در پیام اشاره کنید.
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={sending || !msg.trim()}
        className="w-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 disabled:opacity-60"
      >
        <Send size={16} /> {sending ? 'در حال ارسال…' : 'ارسال پیامک'}
      </button>
    </Modal>
  );
};

export default CRMView;
