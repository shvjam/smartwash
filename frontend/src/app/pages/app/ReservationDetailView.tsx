import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Loader2, ChevronRight, Calendar, Phone, Car, Sparkles, CheckCircle2, XCircle, UserX, MessageSquare } from 'lucide-react';
import { PageHeader, Card, StatCard } from '../../components/app/PageHeader';
import { reservationsApi, ApiException } from '../../api';
import { ReservationStatus, type ReservationDto } from '../../api/types';

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const fmtRials = (n: number) => toFa(n.toLocaleString('fa-IR'));
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('fa-IR', { dateStyle: 'full', timeStyle: 'short' });

// منطبق با ReservationStatus: Pending=0, Confirmed=1, Arrived=2, NoShow=3, Cancelled=4
const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  [ReservationStatus.Pending]: { label: 'در انتظار تایید', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  [ReservationStatus.Confirmed]: { label: 'تایید شده', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  [ReservationStatus.Arrived]: { label: 'حاضر شد', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  [ReservationStatus.NoShow]: { label: 'عدم حضور', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  [ReservationStatus.Cancelled]: { label: 'لغو شده', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export const ReservationDetailView: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [res, setRes] = useState<ReservationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    if (!id) return;
    try {
      const found = await reservationsApi.get(id);
      setRes(found);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'رزرو یافت نشد');
    } finally { setLoading(false); }
  };
  useEffect(() => { setLoading(true); reload(); }, [id]);

  const wrap = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setErr(null);
    try { await fn(); await reload(); }
    catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="animate-spin text-red-600" /></div>;
  if (!res) return <div className="p-6 text-sm text-gray-500">{err ?? 'رزرو یافت نشد.'}</div>;

  const status = STATUS_LABEL[res.status];
  const total = res.services.reduce((s, x) => s + x.priceRials, 0);
  const canConfirm = res.status === ReservationStatus.Pending;
  const canCancel = res.status === ReservationStatus.Pending || res.status === ReservationStatus.Confirmed;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <Link to="/app/reservations" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mb-3">
        <ChevronRight size={14} />بازگشت
      </Link>

      <PageHeader
        title={`رزرو ${res.customerName}`}
        subtitle={fmtDateTime(res.scheduledAtUtc)}
        actions={<span className={`px-3 py-1 rounded-full border text-xs font-bold ${status.cls}`}>{status.label}</span>}
      />

      {err && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="مدت تخمینی" value={`${toFa(res.estimatedDurationMinutes)} د`} accent="sky" />
        <StatCard label="خدمات" value={toFa(res.services.length)} accent="violet" />
        <StatCard label="جمع تخمینی" value={`${fmtRials(total)} ﷼`} accent="red" />
        <StatCard label="ایجاد در" value={new Date(res.createdAtUtc).toLocaleDateString('fa-IR')} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <h3 className="font-extrabold text-gray-900 mb-3 flex items-center gap-2"><Sparkles size={16} className="text-red-600" />خدمات رزرو</h3>
          {res.services.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">خدمتی ثبت نشده</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {res.services.map((s, i) => (
                <div key={i} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-gray-900">{s.serviceName}</div>
                    <div className="text-[11px] text-gray-500">{toFa(s.durationMinutes)} دقیقه</div>
                  </div>
                  <div className="font-mono font-bold text-sm">{fmtRials(s.priceRials)} ﷼</div>
                </div>
              ))}
            </div>
          )}

          {res.notes && (
            <div className="mt-4 rounded-2xl bg-gray-50 p-3 flex items-start gap-2">
              <MessageSquare size={14} className="text-gray-400 mt-0.5" />
              <div className="text-sm text-gray-700">{res.notes}</div>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <h3 className="font-extrabold text-gray-900 mb-3">اطلاعات تماس</h3>
            <Row label="مشتری" value={res.customerName} />
            <Row label="تلفن" value={res.customerPhone} mono />
            {res.customerId && (
              <Link to={`/app/customers/${res.customerId}`} className="text-xs text-red-600 hover:underline mt-1 inline-block">پروفایل مشتری ←</Link>
            )}
            <div className="my-3 border-t border-dashed" />
            <Row label="پلاک" value={res.vehiclePlate} mono />
            {(res.vehicleBrand || res.vehicleModel) && <Row label="خودرو" value={`${res.vehicleBrand ?? ''} ${res.vehicleModel ?? ''}`} />}
            <div className="my-3 border-t border-dashed" />
            <Row label="زمان" value={fmtDateTime(res.scheduledAtUtc)} />
          </Card>

          <Card>
            <h3 className="font-extrabold text-gray-900 mb-3">عملیات</h3>
            <div className="space-y-2">
              {canConfirm && (
                <button disabled={busy === 'confirm'}
                  onClick={() => wrap('confirm', () => reservationsApi.confirm(res.id))}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />تایید رزرو
                </button>
              )}
              {canCancel && (
                <button disabled={busy === 'cancel'}
                  onClick={() => {
                    const reason = window.prompt('دلیل لغو (اختیاری)') ?? null;
                    wrap('cancel', () => reservationsApi.cancel(res.id, reason));
                  }}
                  className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  <XCircle size={16} />لغو رزرو
                </button>
              )}
              {res.status === ReservationStatus.Confirmed && (
                <button disabled={busy === 'noshow'}
                  onClick={() => wrap('noshow', () => reservationsApi.noShow(res.id))}
                  className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  <UserX size={16} />ثبت عدم حضور
                </button>
              )}
            </div>
          </Card>
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

export default ReservationDetailView;
