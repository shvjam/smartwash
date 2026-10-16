import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowRight, CheckCircle2, Clock, Download, History, Paperclip, RotateCcw, Send, ShieldCheck, Star,
} from 'lucide-react';
import {
  ticketsApi, type TicketAttachmentUpload, type TicketDetailDto, type TicketMessageDto,
} from '../../api';
import { Card, ErrorState, PageHeader, SkeletonRows } from '../../components/app/PageHeader';
import { AttachmentChips } from './SupportView';
import {
  describeTicketEvent, fa, formatDateTime, formatFileSize, formatRelative, formatSlaRemaining,
  isTicketOpen, TICKET_CATEGORY_LABEL, TICKET_PRIORITY_CLASS, TICKET_PRIORITY_LABEL,
  TICKET_STATUS_CLASS, TICKET_STATUS_LABEL,
} from '../../lib/tickets';

export const SupportTicketDetailView = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<TicketDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await ticketsApi.get(id)); }
    catch (e: any) { setError(e?.message ?? 'خطا در بارگذاری تیکت'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="max-w-5xl mx-auto"><Card><SkeletonRows rows={6} /></Card></div>;
  if (error || !data) return <div className="max-w-5xl mx-auto"><ErrorState message={error ?? 'تیکت یافت نشد'} onRetry={load} /></div>;

  const t = data.ticket;
  const open = isTicketOpen(t.status);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <button
        onClick={() => navigate('/app/support')}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowRight size={14} />بازگشت به فهرست تیکت‌ها
      </button>

      <PageHeader
        title={t.subject}
        subtitle={`${t.number} · ${TICKET_CATEGORY_LABEL[t.category]} · ثبت‌شده در ${formatDateTime(t.createdAtUtc)}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${TICKET_STATUS_CLASS[t.status]}`}>
              {TICKET_STATUS_LABEL[t.status]}
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${TICKET_PRIORITY_CLASS[t.priority]}`}>
              اولویت {TICKET_PRIORITY_LABEL[t.priority]}
            </span>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-3.5 text-sm font-extrabold">
              گفتگو ({fa(data.messages.length)} پیام)
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.messages.map(m => <MessageBubble key={m.id} message={m} />)}
            </div>
          </Card>

          {open ? (
            <ReplyBox ticketId={t.id} onSent={setData} />
          ) : (
            <ClosedActions ticket={data} onChanged={load} />
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <h3 className="text-sm font-extrabold mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand-600" />وضعیت پیگیری
            </h3>
            <dl className="space-y-3 text-xs">
              <Row label="کارشناس مسئول" value={t.assignedToName ?? 'در انتظار تخصیص'} />
              <Row
                label="مهلت پاسخ اولیه"
                value={t.firstResponseAtUtc
                  ? `پاسخ داده شد · ${formatRelative(t.firstResponseAtUtc)}`
                  : formatSlaRemaining(t.dueAtUtc, t.isSlaBreached)}
                danger={t.isSlaBreached}
              />
              <Row label="آخرین فعالیت" value={formatRelative(t.lastMessageAtUtc)} />
              {t.resolvedAtUtc && <Row label="زمان حل" value={formatDateTime(t.resolvedAtUtc)} />}
              {t.closedAtUtc && <Row label="زمان بستن" value={formatDateTime(t.closedAtUtc)} />}
              {t.reopenCount > 0 && <Row label="تعداد بازگشایی" value={`${fa(t.reopenCount)} بار`} />}
              {t.satisfactionRating !== null && (
                <Row label="امتیاز رضایت شما" value={`${fa(t.satisfactionRating)} از ۵`} />
              )}
            </dl>
          </Card>

          {data.attachments.length > 0 && (
            <Card>
              <h3 className="text-sm font-extrabold mb-3 flex items-center gap-2">
                <Paperclip size={16} className="text-brand-600" />پیوست‌ها
              </h3>
              <div className="space-y-2">
                {data.attachments.map(a => (
                  <a
                    key={a.id} href={a.url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="truncate">{a.fileName}</span>
                    <span className="flex shrink-0 items-center gap-2 text-gray-400">
                      {formatFileSize(a.sizeBytes)}<Download size={13} />
                    </span>
                  </a>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="text-sm font-extrabold mb-3 flex items-center gap-2">
              <History size={16} className="text-brand-600" />تاریخچه
            </h3>
            <ol className="space-y-3">
              {data.events.map(e => (
                <li key={e.id} className="flex gap-3 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <div className="min-w-0">
                    <div className="text-gray-700 dark:text-gray-300">{describeTicketEvent(e)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {e.actorName} · {formatDateTime(e.occurredAtUtc)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, danger }: { label: string; value: string; danger?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className={`font-bold ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-gray-800 dark:text-gray-200'}`}>{value}</dd>
  </div>
);

const MessageBubble = ({ message }: { message: TicketMessageDto }) => {
  const fromPlatform = message.authorSide === 1;
  return (
    <div className={`p-4 sm:p-5 ${fromPlatform ? 'bg-brand-50/40 dark:bg-brand-950/10' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-xl text-[10px] font-black text-white ${fromPlatform ? 'bg-brand-600' : 'bg-gray-700 dark:bg-gray-600'}`}>
          {fromPlatform ? 'SW' : message.authorName.slice(0, 1)}
        </span>
        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{message.authorName}</span>
        {fromPlatform && (
          <span className="rounded-full bg-brand-100 dark:bg-brand-950/50 px-2 py-0.5 text-[9px] font-bold text-brand-700 dark:text-brand-300">
            پشتیبانی
          </span>
        )}
        <span className="mr-auto text-[10px] text-gray-400">{formatDateTime(message.createdAtUtc)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-300">{message.body}</p>
      {message.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.attachments.map(a => (
            <a
              key={a.id} href={a.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-[11px] hover:border-brand-300"
            >
              <Paperclip size={11} className="text-gray-400" />
              <span className="max-w-[160px] truncate">{a.fileName}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const ReplyBox = ({ ticketId, onSent }: { ticketId: string; onSent: (d: TicketDetailDto) => void }) => {
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<TicketAttachmentUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const uploaded = await Promise.all(Array.from(files).slice(0, 10).map(f => ticketsApi.uploadAttachment(f)));
      setAttachments(prev => [...prev, ...uploaded].slice(0, 10));
    } catch (e: any) { toast.error(e?.message ?? 'بارگذاری پیوست ناموفق بود'); }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    try {
      onSent(await ticketsApi.addMessage(ticketId, body.trim(), attachments));
      setBody('');
      setAttachments([]);
      toast.success('پیام شما ارسال شد');
    } catch (e: any) { toast.error(e?.message ?? 'ارسال پیام ناموفق بود'); }
    finally { setBusy(false); }
  };

  const close = async () => {
    setClosing(true);
    try {
      await ticketsApi.close(ticketId, 'مشکل برطرف شد.');
      onSent(await ticketsApi.get(ticketId));
      toast.success('تیکت بسته شد');
    } catch (e: any) { toast.error(e?.message ?? 'بستن تیکت ناموفق بود'); }
    finally { setClosing(false); }
  };

  return (
    <Card>
      <form onSubmit={send} className="space-y-3">
        <textarea
          rows={4} maxLength={4000} value={body} onChange={e => setBody(e.target.value)}
          placeholder="پاسخ خود را بنویسید…"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm leading-7"
        />
        {attachments.length > 0 && <AttachmentChips items={attachments} onRemove={i => setAttachments(a => a.filter((_, idx) => idx !== i))} />}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <Paperclip size={14} />افزودن پیوست
            <input type="file" multiple className="hidden" onChange={e => upload(e.target.files)} />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={close} disabled={closing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 disabled:opacity-60"
            >
              <CheckCircle2 size={14} />{closing ? 'در حال بستن…' : 'مشکل حل شد، تیکت را ببند'}
            </button>
            <button
              type="submit" disabled={busy || !body.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Send size={15} />{busy ? 'در حال ارسال…' : 'ارسال پاسخ'}
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
};

const ClosedActions = ({ ticket, onChanged }: { ticket: TicketDetailDto; onChanged: () => void }) => {
  const t = ticket.ticket;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const reopen = async () => {
    setBusy(true);
    try {
      await ticketsApi.reopen(t.id, 'مشکل دوباره تکرار شد.');
      toast.success('تیکت بازگشایی شد');
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? 'بازگشایی ناموفق بود'); }
    finally { setBusy(false); }
  };

  const rate = async () => {
    if (rating < 1) return;
    setBusy(true);
    try {
      await ticketsApi.rate(t.id, rating, comment || null);
      toast.success('از ثبت نظر شما سپاسگزاریم');
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? 'ثبت امتیاز ناموفق بود'); }
    finally { setBusy(false); }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <Clock size={16} className="text-gray-400" />
        این تیکت {TICKET_STATUS_LABEL[t.status]} است
      </div>

      {t.satisfactionRating === null ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            پشتیبانی چطور بود؟ امتیاز شما به بهبود کیفیت خدمات کمک می‌کند.
          </p>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n} type="button" onClick={() => setRating(n)}
                className={`rounded-lg p-1.5 transition-colors ${n <= rating ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'}`}
                aria-label={`${n} ستاره`}
              >
                <Star size={22} fill={n <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <textarea
            rows={2} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)}
            placeholder="نظر اختیاری…"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={rate} disabled={busy || rating < 1}
              className="rounded-xl bg-gray-900 dark:bg-gray-100 px-5 py-2.5 text-xs font-bold text-white dark:text-gray-900 disabled:opacity-50"
            >
              ثبت امتیاز
            </button>
            <button
              onClick={reopen} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 disabled:opacity-60"
            >
              <RotateCcw size={13} />بازگشایی تیکت
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            امتیاز ثبت‌شده: <b className="text-amber-600">{fa(t.satisfactionRating)} از ۵</b>
            {ticket.satisfactionComment && <span className="block mt-1">«{ticket.satisfactionComment}»</span>}
          </div>
          <button
            onClick={reopen} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 disabled:opacity-60"
          >
            <RotateCcw size={13} />بازگشایی تیکت
          </button>
        </div>
      )}
    </Card>
  );
};

export default SupportTicketDetailView;
