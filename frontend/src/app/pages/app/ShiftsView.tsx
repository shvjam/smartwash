import React, { useEffect, useState } from 'react';
import { Clock, Play, Square, Banknote, AlertCircle, Check } from 'lucide-react';
import { shiftsApi, ShiftDto, ApiException } from '../../api';
import { useCarWash } from '../../store';
import { PageHeader, Card, StatCard, EmptyState } from '../../components/app/PageHeader';

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

export const ShiftsView = () => {
  const { branchId } = useCarWash();
  const [open, setOpen] = useState<ShiftDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCash, setOpenCash] = useState('');
  const [closeCash, setCloseCash] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = async () => {
    if (!branchId) return;
    try { setOpen(await shiftsApi.getOpen(branchId)); }
    catch { setOpen(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [branchId]);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    setBusy(true); setErr(null);
    try {
      const s = await shiftsApi.open(branchId, Number(openCash) || 0);
      setOpen(s); setOpenCash('');
      setToast('شیفت با موفقیت باز شد');
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در باز کردن شیفت');
    } finally { setBusy(false); }
  };
  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open) return;
    setBusy(true); setErr(null);
    try {
      await shiftsApi.close(open.id, Number(closeCash) || 0, notes.trim() || null);
      setOpen(null); setCloseCash(''); setNotes('');
      setToast('شیفت بسته شد. مغایرت در گزارش‌ها قابل مشاهده است.');
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در بستن شیفت');
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader title="صندوق و شیفت" subtitle="مدیریت باز/بسته شدن شیفت و گزارش مغایرت نقدی" />

      {toast && (
        <div className="mb-4 bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-2xl border border-emerald-100 flex items-center gap-2">
          <Check size={16} />{toast}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-10">در حال بارگذاری…</div>
      ) : open ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            <StatCard accent="emerald" label="نقدی" value={fmt(open.cashSalesRials)} hint="فروش نقدی" />
            <StatCard accent="sky" label="کارت" value={fmt(open.cardSalesRials)} />
            <StatCard accent="violet" label="آنلاین" value={fmt(open.onlineSalesRials)} />
            <StatCard accent="blue" label="کیف پول" value={fmt(open.walletSalesRials ?? 0)} hint="پرداخت با کیف پول" />
            <StatCard accent="indigo" label="انعام پرسنل" value={fmt(open.tipsRials ?? 0)} />
            <StatCard accent="amber" label="هزینه‌ها" value={fmt(open.expensesRials)} />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-extrabold text-lg flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  شیفت فعال
                </div>
                <div className="text-xs text-gray-500 mt-1">باز شده در {new Date(open.openedAtUtc).toLocaleString('fa-IR')}</div>
              </div>
              <div className="text-xs text-gray-500">سفارش‌ها: <span className="font-bold text-gray-900">{fmt(open.orderCount)}</span></div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><div className="text-xs text-gray-500">نقدی شروع</div><div className="font-bold">{fmt(open.openingCashRials)} ریال</div></div>
              <div><div className="text-xs text-gray-500">نقدی مورد انتظار</div><div className="font-bold">{fmt(open.openingCashRials + open.cashSalesRials - open.expensesRials)} ریال</div></div>
              <div><div className="text-xs text-gray-500">جمع فروش</div><div className="font-bold">{fmt(open.cashSalesRials + open.cardSalesRials + open.onlineSalesRials + (open.walletSalesRials ?? 0))} ریال</div></div>
            </div>

            <form onSubmit={handleClose} className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-2 block">شمارش نقدی پایان شیفت</span>
                <input type="number" required value={closeCash} onChange={e => setCloseCash(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-2 block">یادداشت (اختیاری)</span>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20" />
              </label>
              {err && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-center gap-2"><AlertCircle size={16} />{err}</div>}
              <button type="submit" disabled={busy}
                className="bg-gradient-to-br from-red-500 to-red-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 disabled:opacity-60">
                <Square size={16} />بستن شیفت
              </button>
            </form>
          </Card>
        </>
      ) : (
        <Card>
          <div className="text-center py-6 mb-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 mb-4">
              <Clock size={26} />
            </div>
            <div className="font-bold text-gray-900 mb-1">شیفتی باز نیست</div>
            <div className="text-sm text-gray-500">برای شروع پذیرش، شیفت جدید باز کنید.</div>
          </div>
          <form onSubmit={handleOpen} className="max-w-md mx-auto space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-2 block">موجودی نقدی شروع</span>
              <div className="relative">
                <Banknote className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="number" required value={openCash} onChange={e => setOpenCash(e.target.value)} placeholder="۰"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-12 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
              </div>
            </label>
            {err && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-center gap-2"><AlertCircle size={16} />{err}</div>}
            <button type="submit" disabled={busy}
              className="w-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              <Play size={16} />باز کردن شیفت
            </button>
          </form>
        </Card>
      )}
    </div>
  );
};

export default ShiftsView;
