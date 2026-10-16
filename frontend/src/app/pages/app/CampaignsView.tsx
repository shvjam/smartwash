import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare, Send, CalendarClock, Users, X, AlertCircle, Lock } from 'lucide-react';
import { campaignsApi, CampaignDto, CampaignType, CampaignTarget, CampaignStatus, ApiException, LoyaltyTier } from '../../api';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';
import { clsx } from 'clsx';
import { useFeature } from '../../lib/features';

const targetLabel: Record<CampaignTarget, string> = {
  [CampaignTarget.AllCustomers]: 'همه مشتری‌ها',
  [CampaignTarget.ActiveCustomers]: 'مشتری‌های فعال',
  [CampaignTarget.InactiveCustomers]: 'مشتری‌های در آستانه ریزش',
  [CampaignTarget.ByTier]: 'بر اساس سطح وفاداری',
  [CampaignTarget.Birthday]: 'تولد در این هفته',
  [CampaignTarget.Custom]: 'سفارشی',
};
// کلاس‌های Tailwind باید کاملِ ثابت باشند؛ ساختِ پویا مثل `bg-${c}-50` توسط کامپایلر شناسایی نمی‌شود.
const statusLabel: Record<CampaignStatus, { l: string; c: string }> = {
  [CampaignStatus.Draft]: { l: 'پیش‌نویس', c: 'bg-gray-50 text-gray-700' },
  [CampaignStatus.Scheduled]: { l: 'زمان‌بندی‌شده', c: 'bg-sky-50 text-sky-700' },
  [CampaignStatus.Sending]: { l: 'در حال ارسال', c: 'bg-amber-50 text-amber-700' },
  [CampaignStatus.Completed]: { l: 'تکمیل‌شده', c: 'bg-emerald-50 text-emerald-700' },
  [CampaignStatus.Cancelled]: { l: 'لغو شده', c: 'bg-red-50 text-red-700' },
  [CampaignStatus.Failed]: { l: 'ناموفق', c: 'bg-red-50 text-red-700' },
};

export const CampaignsView = () => {
  const { enabled: hasCampaigns, loading: featureLoading } = useFeature('campaigns');
  const [list, setList] = useState<CampaignDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: CampaignType.Sms, target: CampaignTarget.AllCustomers,
    messageTemplate: '', scheduledAt: '', minVisits: '', daysSinceLastVisit: '',
  });
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    try { setList(await campaignsApi.list()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    // client-side validation
    if (!form.name.trim() || form.name.trim().length < 2) { setErr('نام کمپین باید حداقل ۲ کاراکتر باشد'); return; }
    if (!form.messageTemplate.trim() || form.messageTemplate.trim().length < 10) { setErr('متن پیام باید حداقل ۱۰ کاراکتر باشد'); return; }
    if (form.messageTemplate.trim().length > 2000) { setErr('متن پیام نباید از ۲۰۰۰ کاراکتر بیشتر باشد'); return; }
    if (form.scheduledAt && new Date(form.scheduledAt).getTime() <= Date.now()) { setErr('زمان ارسال باید در آینده باشد'); return; }
    try {
      await campaignsApi.create({
        name: form.name.trim(), type: form.type, target: form.target,
        messageTemplate: form.messageTemplate.trim(),
        scheduledAtUtc: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        minVisits: form.minVisits ? Number(form.minVisits) : null,
        daysSinceLastVisit: form.daysSinceLastVisit ? Number(form.daysSinceLastVisit) : null,
      });
      setForm({ name: '', type: CampaignType.Sms, target: CampaignTarget.AllCustomers, messageTemplate: '', scheduledAt: '', minVisits: '', daysSinceLastVisit: '' });
      setShowForm(false);
      reload();
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ساخت کمپین');
    }
  };

  // Gate at page level — backend also enforces this
  if (!featureLoading && !hasCampaigns) {
    return (
      <div className="max-w-6xl mx-auto pb-10">
        <PageHeader title="کمپین‌های پیامکی" subtitle="ارسال پیام هدفمند به گروه‌های مشتریان" />
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock size={28} className="text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-700 text-lg">کمپین‌های پیامکی در پلن شما فعال نیست</h3>
            <p className="text-sm text-gray-500 max-w-sm leading-6">
              برای ارسال کمپین‌های هدفمند پیامکی، پلن اشتراک خود را به پلن حرفه‌ای یا بالاتر ارتقا دهید.
            </p>
            <a href="/app/billing"
              className="mt-2 bg-gradient-to-br from-brand-500 to-brand-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-brand-500/30 hover:from-brand-600 hover:to-brand-800 transition-all">
              مشاهده پلن‌ها و ارتقا
            </a>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="کمپین‌های پیامکی"
        subtitle="ارسال پیام هدفمند به گروه‌های مشتریان"
        actions={
          <button onClick={() => setShowForm(s => !s)}
            className="bg-gradient-to-br from-brand-500 to-brand-700 text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-brand-500/30">
            <Plus size={16} />کمپین جدید
          </button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600 mb-2 block">نام کمپین</span>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-2 block">هدف</span>
              <select value={form.target} onChange={e => setForm({ ...form, target: Number(e.target.value) })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                {Object.entries(targetLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-2 block">نوع پیام</span>
              <select value={form.type} onChange={e => setForm({ ...form, type: Number(e.target.value) })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                <option value={CampaignType.Sms}>پیامک</option>
                <option value={CampaignType.Email}>ایمیل</option>
                <option value={CampaignType.Push}>اعلان موبایل</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600 mb-2 block">متن پیام</span>
              <textarea required rows={4} value={form.messageTemplate} onChange={e => setForm({ ...form, messageTemplate: e.target.value })}
                placeholder="سلام {name} عزیز، SmartWash از شما دعوت می‌کند…"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              <p className="text-[11px] text-gray-400 mt-1.5">می‌توانید از {'{name}'} و {'{plate}'} استفاده کنید.</p>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-2 block">زمان ارسال (خالی = فوری)</span>
              <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-2 block">حداقل بازدید</span>
                <input type="number" value={form.minVisits} onChange={e => setForm({ ...form, minVisits: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-2 block">روز عدم مراجعه</span>
                <input type="number" value={form.daysSinceLastVisit} onChange={e => setForm({ ...form, daysSinceLastVisit: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              </label>
            </div>
            {err && <div className="sm:col-span-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-center gap-2"><AlertCircle size={16} />{err}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold">ذخیره کمپین</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-sm">انصراف</button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-10">در حال بارگذاری…</div>
      ) : list.length === 0 ? (
        <EmptyState icon={MessageSquare} title="هنوز کمپینی ایجاد نشده" hint="اولین کمپین خود را برای بازگشت مشتری‌ها بسازید." />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(c => {
            const st = statusLabel[c.status];
            return (
              <Card key={c.id} className="group hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-bold', st.c)}>{st.l}</span>
                  <span className="text-xs text-gray-400">{targetLabel[c.target]}</span>
                </div>
                <div className="font-extrabold mb-2">{c.name}</div>
                <p className="text-xs text-gray-500 leading-6 line-clamp-3 mb-4">{c.messageTemplate}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-gray-50 rounded-xl p-2"><div className="text-gray-500">گیرنده</div><div className="font-bold mt-0.5">{c.recipientCount}</div></div>
                  <div className="bg-emerald-50 rounded-xl p-2"><div className="text-emerald-700">موفق</div><div className="font-bold mt-0.5">{c.successCount}</div></div>
                  <div className="bg-red-50 rounded-xl p-2"><div className="text-red-700">ناموفق</div><div className="font-bold mt-0.5">{c.failedCount}</div></div>
                </div>
                {(c.status === CampaignStatus.Draft || c.status === CampaignStatus.Scheduled) && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                    <button onClick={() => campaignsApi.cancel(c.id).then(reload)}
                      className="text-xs px-3 py-1.5 rounded-xl bg-brand-50 text-brand-700 font-bold hover:bg-brand-100 flex items-center gap-1">
                      <X size={12} />لغو
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CampaignsView;
