import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CreditCard, ExternalLink, Sparkles, Loader2, ReceiptText, CheckCircle2 } from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';
import { billingApi, type CurrentSubscriptionDto, type TenantInvoiceDto, ApiException, API_CONFIG } from '../../api';

const toFa = (v: string | number) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const formatRials = (n: number) => toFa(n.toLocaleString('fa-IR'));
const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return toFa(new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d));
  } catch { return iso; }
};
const daysUntil = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
};

// SubscriptionStatus: PendingPayment=0, Active=1, PastDue=2, Cancelled=3, Expired=4
const STATUS_LABEL: Record<number, string> = { 0: 'در انتظار پرداخت', 1: 'فعال', 2: 'پرداخت معوق', 3: 'لغوشده', 4: 'منقضی' };
// InvoiceStatus: Open=0, Paid=1, Overdue=2, Void=3
const INVOICE_STATUS_LABEL: Record<number, string> = { 0: 'باز', 1: 'پرداخت‌شده', 2: 'معوق', 3: 'باطل' };
const CYCLE_LABEL: Record<number, string> = { 0: 'ماهانه', 1: 'سالانه' };

export const BillingView: React.FC = () => {
  const [sub, setSub] = useState<CurrentSubscriptionDto | null>(null);
  const [invoices, setInvoices] = useState<TenantInvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    // اگر از صفحه pricing لاگین‌شده آمده باشد (subscribePlanId در URL)
    const planId = searchParams.get('subscribePlanId');
    const cycle = parseInt(searchParams.get('cycle') ?? '0', 10);
    if (planId) {
      billingApi.subscribe(planId, cycle)
        .then(() => { setSubscribeSuccess(true); setSearchParams({}, { replace: true }); })
        .catch(e => setErr(e instanceof ApiException ? e.message : 'خطا در ثبت اشتراک'));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, inv] = await Promise.all([billingApi.subscription(), billingApi.invoices()]);
        setSub(s); setInvoices(inv);
      } catch (e) {
        setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری');
      } finally { setLoading(false); }
    })();
  }, [subscribeSuccess]);

  if (loading) return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="animate-spin text-red-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader title="اشتراک و صورتحساب" subtitle="مدیریت پلن، تاریخ سررسید و صورتحساب‌های گذشته" />

      {subscribeSuccess && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl">
          <CheckCircle2 size={18} />اشتراک با موفقیت ثبت شد. اکنون فاکتور پرداخت در زیر مشاهده می‌شود.
        </div>
      )}
      {err && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3">{err}</div>}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-red-900 text-white border-0 relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-red-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl" />
          <div className="relative">
            {sub ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-red-300 text-[10px] font-bold mb-4">
                  <Sparkles size={12} />وضعیت: {STATUS_LABEL[sub.status] ?? '—'}
                </div>
                <h2 className="text-3xl font-black mb-2">{CYCLE_LABEL[sub.cycle]}</h2>
                <p className="text-gray-300 text-sm mb-6">
                  {toFa(daysUntil(sub.currentPeriodEndUtc))} روز تا پایان دوره
                </p>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <Stat label="مبلغ" value={formatRials(sub.priceRials)} sub="ریال" />
                  <Stat label="سررسید" value={formatDate(sub.currentPeriodEndUtc)} />
                  <Stat label="تمدید خودکار" value={sub.autoRenew ? 'فعال' : 'غیرفعال'} />
                </div>
                <div className="flex gap-2">
                  <Link to="/pricing" className="px-4 py-2.5 rounded-2xl bg-white text-gray-900 text-sm font-bold flex items-center gap-1.5 hover:scale-[1.02] transition-transform">
                    ارتقاء پلن<ExternalLink size={14} />
                  </Link>
                  {/* لغو فقط برای اشتراک فعال/معوق معنا دارد — نه لغوشده(۳) و نه منقضی(۴) */}
                  {sub.status !== 3 && sub.status !== 4 && (
                    <button
                      onClick={async () => {
                        if (!confirm('آیا از لغو اشتراک مطمئن هستید؟')) return;
                        try { await billingApi.cancel(sub.id); location.reload(); }
                        catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در لغو'); }
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-white/10 text-white text-sm font-medium border border-white/20 hover:bg-white/15 transition-colors">
                      لغو اشتراک
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="py-8">
                <h2 className="text-2xl font-black mb-2">اشتراک فعالی ندارید</h2>
                <p className="text-gray-300 text-sm mb-4">برای استفاده از پلتفرم یک پلن انتخاب کنید.</p>
                <Link to="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white text-gray-900 text-sm font-bold">
                  مشاهده پلن‌ها<ExternalLink size={14} />
                </Link>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-extrabold mb-4 flex items-center gap-2"><CreditCard size={18} />پرداخت</h3>
          <p className="text-gray-500 text-sm mb-4">پرداخت اشتراک از طریق درگاه‌های امن (زرین‌پال، آی‌دی‌پی، نِکست‌پی) انجام می‌شود.</p>
          {!sub && (
            <Link to="/pricing"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-500 to-red-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-red-500/25 hover:from-red-600 hover:to-red-800 transition-all">
              <ExternalLink size={14} />مشاهده پلن‌ها و شروع اشتراک
            </Link>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <h3 className="font-extrabold mb-4 flex items-center gap-2"><ReceiptText size={18} />صورتحساب‌ها</h3>
        {invoices.length === 0 ? (
          <Card><EmptyState icon={ReceiptText} title="صورتحسابی موجود نیست" /></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2">شماره</th>
                  <th className="px-4 py-2">تاریخ صدور</th>
                  <th className="px-4 py-2">سررسید</th>
                  <th className="px-4 py-2">مبلغ</th>
                  <th className="px-4 py-2">وضعیت</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-sm">{inv.number}</td>
                    <td className="px-4 py-3">{formatDate(inv.issuedAtUtc)}</td>
                    <td className="px-4 py-3">{formatDate(inv.dueAtUtc)}</td>
                    <td className="px-4 py-3">{formatRials(inv.totalRials)} ریال</td>
                    <td className="px-4 py-3">
                      {/* InvoiceStatus: Open=0, Paid=1, Overdue=2, Void=3 */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 1 ? 'bg-emerald-100 text-emerald-700'
                        : inv.status === 2 ? 'bg-rose-100 text-rose-700'
                        : inv.status === 0 ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>{INVOICE_STATUS_LABEL[inv.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      {/* فقط فاکتورهای باز (۰) یا معوق (۲) قابل پرداخت‌اند */}
                      {(inv.status === 0 || inv.status === 2) && (
                        <PayButton invoiceId={inv.id} onErr={setErr} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};

const PayButton: React.FC<{ invoiceId: string; onErr: (m: string) => void }> = ({ invoiceId, onErr }) => {
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      // درگاه باید کاربر را به endpoint عمومی بک‌اند برگرداند (که verify می‌کند و سپس به صفحه نتیجه‌ی فرانت ریدایرکت می‌شود).
      // بک‌اند paymentId را به انتهای این مسیر اضافه می‌کند.
      const callback = `${API_CONFIG.baseUrl}/api/public/payments/callback`;
      const r = await billingApi.requestPayment(invoiceId, 0 /* Zarinpal */, callback);
      window.location.href = r.redirectUrl;
    } catch (e) {
      onErr(e instanceof ApiException ? e.message : 'خطا در شروع پرداخت');
    } finally { setBusy(false); }
  };
  return (
    <button onClick={pay} disabled={busy} className="text-xs text-red-600 font-bold hover:underline disabled:opacity-50">
      {busy ? 'در حال انتقال…' : 'پرداخت'}
    </button>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div>
    <div className="text-[10px] text-gray-300 uppercase tracking-wider mb-1">{label}</div>
    <div className="font-extrabold text-lg leading-tight">{value}</div>
    {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

export default BillingView;
