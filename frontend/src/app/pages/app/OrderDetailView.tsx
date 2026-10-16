import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import clsx from 'clsx';
import { Loader2, ChevronRight, Plus, Trash2, Percent, CreditCard, CheckCircle2, XCircle, User, UserX, Car, Receipt } from 'lucide-react';
import { PageHeader, Card, StatCard } from '../../components/app/PageHeader';
import { ordersApi, servicesApi, workersApi, baysApi, ApiException } from '../../api';
import { OrderStatus, OrderStage, PaymentMethod, type OrderDto, type ServiceDto, type WorkerDto, type BayDto } from '../../api/types';
import { useCarWash } from '../../store';
import { WorkerAvatar } from '../../components/WorkerAvatar';
import { toast } from 'sonner';
import { OrderStageControl } from '../../components/OrderStageControl';
import { resolveUploadUrl } from '../../api/adapters';
import { formatIranPlate } from '../../components/forms/IranPlateInput';

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });

// قاعده‌ی پلتفرم: API و دیتابیس ریال‌اند، اما همه‌ی نمایش‌ها و ورودی‌های مالی تومان‌اند.
const RIAL_PER_TOMAN = 10;
const toToman = (rials: number) => Math.round(rials / RIAL_PER_TOMAN);
const toRials = (toman: number) => Math.round(toman) * RIAL_PER_TOMAN;
/** مبلغِ ریالیِ آمده از API را به تومانِ فارسی‌شده تبدیل می‌کند. */
const fmtToman = (rials: number) => toFa(toToman(rials).toLocaleString('fa-IR'));

/** What each action confirms once the server has accepted it. */
const DONE: Record<string, string> = {
  stage: 'مرحله‌ی خودرو ثبت شد',
  pay: 'پرداخت ثبت شد',
  complete: 'سفارش تحویل و بسته شد',
  cancel: 'سفارش لغو شد',
  discount: 'تخفیف اعمال شد',
  'add-line': 'خدمت اضافه شد',
  tip: 'انعام ثبت شد',
};

const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  [OrderStatus.InProgress]: { label: 'در حال انجام', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  [OrderStatus.Completed]: { label: 'تکمیل شده', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  [OrderStatus.Cancelled]: { label: 'لغو شده', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const METHOD_LABEL: Record<number, string> = {
  [PaymentMethod.Cash]: 'نقد', [PaymentMethod.Card]: 'کارت', [PaymentMethod.Online]: 'آنلاین',
  [PaymentMethod.Wallet]: 'کیف پول', [PaymentMethod.Mixed]: 'ترکیبی', [PaymentMethod.Credit]: 'اعتباری',
  [PaymentMethod.Tip]: 'انعام',
};

// روش‌های مجاز برای تسویه‌ی بدهیِ سفارش (انعام و «ترکیبی» تسویه‌ی بدهی نیستند).
const SETTLE_METHODS: PaymentMethod[] = [
  PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Online, PaymentMethod.Wallet, PaymentMethod.Credit,
];

export const OrderDetailView: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [workers, setWorkers] = useState<WorkerDto[]>([]);
  const [bayList, setBayList] = useState<BayDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // An order is a RowVersion-protected aggregate: never issue two mutations concurrently.
  const mutationInFlight = useRef(false);
  const [discount, setDiscount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [payAmount, setPayAmount] = useState(0);
  const [payRef, setPayRef] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [newServiceId, setNewServiceId] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newWorkerId, setNewWorkerId] = useState<string>('');
  // Sync store bays/orders after completing/cancelling from this page
  const { reloadAll } = useCarWash();

  const reload = async () => {
    if (!id) return;
    try {
      // Bays are read again with the order: a step moves the car, and a list loaded once kept
      // offering the bay it had just left as occupied and the one it moved into as free.
      const [o, b] = await Promise.all([ordersApi.get(id), baysApi.list(undefined, true).catch(() => null)]);
      setOrder(o);
      if (b) setBayList(b);
      setDiscount(toToman(o.discountRials));
      setPayAmount(toToman(Math.max(0, o.totalRials - o.paidRials)));
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([servicesApi.list(true), workersApi.list(undefined, true), baysApi.list(undefined, true)])
      .then(([s, w, b]) => { setServices(s); setWorkers(w); setBayList(b); })
      .catch(() => {});
    reload();
  }, [id]);

  const remaining = useMemo(() => order ? Math.max(0, order.totalRials - order.paidRials) : 0, [order]);

  const wrap = async (key: string, fn: () => Promise<unknown>, syncStore = false) => {
    // State updates are asynchronous, so `busy` alone cannot stop two clicks in the
    // same render tick. The ref serializes all aggregate mutations until reload finishes.
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(key); setErr(null);
    try {
      await fn();
      await reload();
      // The banner for errors sits at the top of a long page; a toast is seen wherever the
      // operator is, and says the click did something.
      toast.success(DONE[key] ?? (key.startsWith('del-') ? 'خدمت حذف شد' : 'ثبت شد'));
      // complete/cancel changes bay status — sync global store so BaysView reflects it
      if (syncStore) reloadAll().catch(() => {});
    }
    catch (e) {
      if (e instanceof ApiException && e.status === 409) {
        // Refresh the aggregate after a genuine cross-tab/user conflict so the next
        // user action is based on the server RowVersion, not the stale detail view.
        await reload();
        setErr('سفارش در جای دیگری تغییر کرد؛ اطلاعات به‌روز شد. عملیات را دوباره انجام دهید.');
        toast.error('سفارش در جای دیگری تغییر کرد؛ دوباره انجام دهید.');
      } else {
        const msg = e instanceof ApiException ? e.message : 'خطا در عملیات';
        setErr(msg);
        toast.error(msg);
        // A refusal usually means the order moved on elsewhere (another screen, another
        // operator); show where it really is rather than leave the stale step on screen.
        await reload();
      }
    }
    finally {
      mutationInFlight.current = false;
      setBusy(null);
    }
  };

  const isMutating = busy !== null;

  if (loading) return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="animate-spin text-brand-600" /></div>;
  if (!order) return <div className="p-6 text-gray-500 text-sm">سفارش یافت نشد.</div>;

  const status = STATUS_LABEL[order.status];
  const canEdit = order.status === OrderStatus.InProgress;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <Link to="/app/orders" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mb-3">
        <ChevronRight size={14} />بازگشت به لیست سفارش‌ها
      </Link>

      <PageHeader
        title={`سفارش ${order.number}`}
        subtitle={`${fmtDate(order.startedAtUtc)} • ${order.customerName}`}
        actions={
          <span className={`px-3 py-1 rounded-full border text-xs font-bold ${status.cls}`}>{status.label}</span>
        }
      />

      {err && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="جمع جزء" value={`${fmtToman(order.subtotalRials)} تومان`} accent="sky" />
        <StatCard label="تخفیف" value={`${fmtToman(order.discountRials)} تومان`} accent="amber" />
        <StatCard label="مبلغ نهایی" value={`${fmtToman(order.totalRials)} تومان`} accent="red" />
        <StatCard label="مانده" value={`${fmtToman(remaining)} تومان`} accent={remaining > 0 ? 'violet' : 'emerald'} />
      </div>

      {order.status === OrderStatus.InProgress && (
        <div className="mb-5">
          <OrderStageControl
            stage={order.stage}
            outstandingRials={order.outstandingRials}
            queuePosition={order.queuePosition}
            currentBayId={order.currentBayId}
            bays={bayList}
            stageTimes={Object.fromEntries((order.stageEvents ?? []).map(e => [e.stage, e.atUtc]))}
            disabled={isMutating}
            lineCount={order.lines.length}
            onAdvance={async (next, bayId) => {
              // syncStore: leaving a bay frees it, and the bay board must not keep
              // showing this car sitting in a bay it has already driven out of.
              await wrap('stage', () => ordersApi.advanceStage(order.id, next, bayId), true);
            }}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-gray-900 flex items-center gap-2"><Receipt size={16} className="text-brand-600" />آیتم‌های سفارش</h2>
            {canEdit && (
              <button disabled={isMutating}
                onClick={() => setAddLineOpen(v => !v)}
                className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold inline-flex items-center gap-1">
                <Plus size={13} />افزودن خدمت
              </button>
            )}
          </div>

          {addLineOpen && canEdit && (
            <div className="rounded-2xl bg-gray-50 p-3 mb-3 grid grid-cols-1 md:grid-cols-3 gap-2">
              <select value={newServiceId} onChange={e => setNewServiceId(e.target.value)}
                className="md:col-span-2 rounded-xl border bg-white px-3 py-2 text-sm">
                <option value="">— خدمت —</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({fmtToman(s.priceRials)} تومان)</option>)}
              </select>
              <input type="number" min={1} value={newQty} onChange={e => setNewQty(Math.max(1, Number(e.target.value) || 1))}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-mono" />
              <div className="md:col-span-3">
                <div className="mb-1.5 text-[11px] font-medium text-gray-500">پرسنل انجام‌دهنده</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button type="button" onClick={() => setNewWorkerId('')}
                    className={clsx('flex flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                      newWorkerId === '' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                    <span className="grid size-6 place-items-center rounded-full bg-gray-100 text-gray-400"><UserX size={13} /></span>
                    بدون کارمند
                  </button>
                  {workers.map(w => (
                    <button key={w.id} type="button" onClick={() => setNewWorkerId(w.id)}
                      className={clsx('flex flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                        newWorkerId === w.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                      <WorkerAvatar src={resolveUploadUrl(w.avatarUrl)} name={w.fullName} size={24} />
                      <span className="whitespace-nowrap">{w.fullName}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                disabled={!newServiceId || isMutating}
                onClick={() => wrap('add-line', async () => {
                  await ordersApi.addLine(order.id, { serviceId: newServiceId, quantity: newQty, workerId: newWorkerId || null });
                  setAddLineOpen(false); setNewServiceId(''); setNewQty(1); setNewWorkerId('');
                })}
                className="md:col-span-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50">
                {busy === 'add-line' ? <Loader2 size={14} className="inline animate-spin" /> : 'افزودن'}
              </button>
            </div>
          )}

          {order.lines.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-10">آیتمی وجود ندارد.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {order.lines.map(l => (
                <div key={l.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{l.serviceName}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <span>{toFa(l.quantity)} × {fmtToman(l.unitPriceRials)} تومان</span>
                      {l.workerName && (
                        <span className="flex items-center gap-1">
                          <span className="text-gray-300">•</span>
                          <WorkerAvatar
                            src={resolveUploadUrl(workers.find(w => w.id === l.workerId)?.avatarUrl)}
                            name={l.workerName} size={18} />
                          {l.workerName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-gray-900 text-sm">{fmtToman(l.lineTotalRials)} تومان</div>
                  {canEdit && (
                    <button
                      disabled={isMutating}
                      onClick={() => wrap(`del-${l.id}`, () => ordersApi.removeLine(order.id, l.id))}
                      className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="mt-4 rounded-2xl bg-gray-50 p-3 flex items-center gap-2">
              <Percent size={14} className="text-amber-600" />
              <span className="text-xs text-gray-600">تخفیف (تومان):</span>
              <input type="number" min={0} value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="flex-1 rounded-lg border bg-white px-2 py-1.5 text-sm font-mono" />
              <button
                disabled={isMutating}
                onClick={() => wrap('discount', () => ordersApi.applyDiscount(order.id, toRials(discount)))}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-50">
                اعمال
              </button>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <h3 className="font-extrabold text-gray-900 mb-3 flex items-center gap-2"><User size={16} className="text-brand-600" />مشتری و خودرو</h3>
            <Row label="مشتری" value={order.customerName} />
            {order.customerPhone && <Row label="تلفن" value={order.customerPhone} mono />}
            {order.customerId && (
              <div className="mt-1">
                <Link to={`/app/customers/${order.customerId}`} className="text-xs text-brand-600 hover:underline">مشاهده پروفایل مشتری ←</Link>
              </div>
            )}
            <div className="my-3 border-t border-dashed" />
            <Row label="پلاک" value={formatIranPlate(order.vehiclePlate) || '—'} mono />
            {(order.vehicleBrand || order.vehicleModel) && <Row label="خودرو" value={`${order.vehicleBrand ?? ''} ${order.vehicleModel ?? ''}`} />}
          </Card>

          <Card>
            <h3 className="font-extrabold text-gray-900 mb-3 flex items-center gap-2"><CreditCard size={16} className="text-brand-600" />پرداخت‌ها</h3>
            {order.payments.length === 0 ? (
              <div className="text-center text-xs text-gray-500 py-4">هنوز پرداختی ثبت نشده</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {order.payments.map(p => (
                  <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600">{METHOD_LABEL[p.method]}</span>
                    <span className="font-mono font-bold">{fmtToman(p.amountRials)} تومان</span>
                  </div>
                ))}
              </div>
            )}

            {canEdit && remaining > 0 && (
              <div className="mt-3 rounded-2xl bg-gray-50 p-3 space-y-2">
                <select value={payMethod} onChange={e => setPayMethod(Number(e.target.value) as PaymentMethod)}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm">
                  {SETTLE_METHODS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </select>
                <input type="number" min={0} value={payAmount} placeholder="مبلغ (تومان)"
                  onChange={e => setPayAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-mono" />
                <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="مرجع (اختیاری)"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm" />
                <button
                  disabled={isMutating || payAmount <= 0}
                  onClick={() => wrap('pay', async () => {
                    await ordersApi.addPayment(order.id, { method: payMethod, amountRials: toRials(payAmount), reference: payRef.trim() || null });
                    setPayRef('');
                  })}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50">
                  ثبت پرداخت
                </button>
              </div>
            )}

            {canEdit && (
              <div className="mt-3 rounded-2xl bg-amber-50/60 border border-amber-100 p-3 flex items-center gap-2">
                <span className="text-xs text-amber-700 font-bold whitespace-nowrap">انعام پرسنل (تومان)</span>
                <input type="number" min={0} value={tipAmount}
                  onChange={e => setTipAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="flex-1 rounded-lg border bg-white px-2 py-1.5 text-sm font-mono" />
                <button
                  disabled={isMutating || tipAmount <= 0}
                  onClick={() => wrap('tip', async () => {
                    await ordersApi.addPayment(order.id, { method: PaymentMethod.Tip, amountRials: toRials(tipAmount), reference: null });
                    setTipAmount(0);
                  })}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap">
                  ثبت انعام
                </button>
              </div>
            )}
          </Card>

          {canEdit && (
            <Card>
              <h3 className="font-extrabold text-gray-900 mb-3">عملیات</h3>
              <div className="space-y-2">
                <button
                  disabled={isMutating || order.lines.length === 0}
                  onClick={() => wrap('complete', () => ordersApi.complete(order.id, payMethod), true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />تکمیل سفارش
                </button>
                <button
                  disabled={isMutating}
                  onClick={() => {
                    const reason = window.prompt('دلیل لغو (اختیاری)') ?? null;
                    wrap('cancel', () => ordersApi.cancel(order.id, reason), true);
                  }}
                  className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  <XCircle size={16} />لغو سفارش
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-xs text-gray-500">{label}</span>
    <span className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

export default OrderDetailView;
