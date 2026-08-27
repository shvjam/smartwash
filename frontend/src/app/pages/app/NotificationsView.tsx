import React, { useEffect, useState } from 'react';
import { Bell, Loader2, CheckCheck, AlertTriangle, Clock, Info, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';
import { notificationsApi, ApiException } from '../../api';
import { NotificationType, type NotificationDto } from '../../api/types';

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });

// منطبق با NotificationType: Info=0, OrderOverdue=1, ReservationReminder=2, LowInventory=3, BillingDue=4, Birthday=5
const TYPE_META: Record<number, { label: string; cls: string; Icon: any }> = {
  [NotificationType.Info]: { label: 'اطلاع', cls: 'bg-sky-50 text-sky-600', Icon: Info },
  [NotificationType.OrderOverdue]: { label: 'سفارش معوق', cls: 'bg-amber-50 text-amber-600', Icon: AlertTriangle },
  [NotificationType.ReservationReminder]: { label: 'یادآور رزرو', cls: 'bg-violet-50 text-violet-600', Icon: Clock },
  [NotificationType.LowInventory]: { label: 'کمبود موجودی', cls: 'bg-rose-50 text-rose-600', Icon: XCircle },
  [NotificationType.BillingDue]: { label: 'سررسید صورتحساب', cls: 'bg-amber-50 text-amber-600', Icon: AlertTriangle },
  [NotificationType.Birthday]: { label: 'تولد مشتری', cls: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle2 },
};

export const NotificationsView: React.FC = () => {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async (p = page) => {
    setLoading(true); setErr(null);
    try {
      const res = await notificationsApi.list({ unreadOnly: unreadOnly || undefined, page: p, pageSize: 25 });
      setItems(res.items);
      setTotalPages(res.totalPages || 1);
      setPage(res.page);
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری');
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(1); }, [unreadOnly]);

  const markOne = async (id: string) => {
    setBusy(id);
    try {
      await notificationsApi.markRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(null); }
  };
  const markAll = async () => {
    setBusy('all');
    try {
      await notificationsApi.markAllRead();
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا'); }
    finally { setBusy(null); }
  };

  const unreadCount = items.filter(n => !n.isRead).length;

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <PageHeader
        title="اعلان‌ها"
        subtitle={`${toFa(unreadCount)} اعلان خوانده‌نشده در این صفحه`}
        actions={
          <button onClick={markAll} disabled={busy === 'all' || unreadCount === 0}
            className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
            <CheckCheck size={14} />خواندن همه
          </button>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setUnreadOnly(false)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold ${!unreadOnly ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>همه</button>
        <button onClick={() => setUnreadOnly(true)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold ${unreadOnly ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>فقط خوانده‌نشده</button>
      </div>

      {err && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{err}</div>}

      {loading ? (
        <div className="min-h-[30vh] grid place-items-center"><Loader2 className="animate-spin text-red-600" /></div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={Bell} title="اعلانی برای نمایش نیست" hint="پس از فعالیت سیستم، اعلان‌ها اینجا ظاهر می‌شوند." /></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {items.map(n => {
              const meta = TYPE_META[n.type] ?? TYPE_META[0];
              const Icon = meta.Icon;
              return (
                <div key={n.id}
                  className={`p-4 flex items-start gap-3 ${!n.isRead ? 'bg-red-50/30' : ''}`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{n.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      {!n.isRead && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">جدید</span>}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 leading-relaxed">{n.body}</div>
                    <div className="text-[10px] text-gray-400 mt-1.5 font-mono">{fmtDate(n.createdAtUtc)}</div>
                  </div>
                  {!n.isRead && (
                    <button onClick={() => markOne(n.id)} disabled={busy === n.id}
                      className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-50">
                      {busy === n.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
              <button disabled={page <= 1} onClick={() => reload(page - 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-xs font-bold inline-flex items-center gap-1">
                <ChevronRight size={14} />قبلی
              </button>
              <span className="text-xs text-gray-500 font-mono">صفحه {toFa(page)} از {toFa(totalPages)}</span>
              <button disabled={page >= totalPages} onClick={() => reload(page + 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-xs font-bold inline-flex items-center gap-1">
                بعدی<ChevronLeft size={14} />
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default NotificationsView;
