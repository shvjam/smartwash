import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  AlertTriangle, LifeBuoy, MessageSquare, Paperclip, Plus, Search, Send, Star, X,
} from 'lucide-react';
import {
  ticketsApi, type TicketAttachmentUpload, type TicketCategory, type TicketListItemDto,
  type TicketPriority, type TicketStatus, type TicketSummaryDto,
} from '../../api';
import { Card, EmptyState, ErrorState, PageHeader, SkeletonRows, StatCard } from '../../components/app/PageHeader';
import {
  fa, formatFileSize, formatRelative, TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, TICKET_PRIORITIES,
  TICKET_PRIORITY_CLASS, TICKET_PRIORITY_LABEL, TICKET_STATUS_CLASS, TICKET_STATUS_LABEL, TICKET_STATUSES,
} from '../../lib/tickets';

const emptyForm = {
  subject: '',
  description: '',
  category: 0 as TicketCategory,
  priority: 1 as TicketPriority,
};

export const SupportView = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<TicketListItemDto[]>([]);
  const [summary, setSummary] = useState<TicketSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        ticketsApi.list({
          status: status === '' ? undefined : status,
          category: category === '' ? undefined : category,
          search: search.trim() || undefined,
          pageSize: 50,
        }),
        ticketsApi.summary(),
      ]);
      setItems(list.items);
      setSummary(sum);
    } catch (e: any) {
      setError(e?.message ?? 'خطا در بارگذاری تیکت‌ها');
    } finally {
      setLoading(false);
    }
  }, [status, category, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <PageHeader
        title="پشتیبانی"
        subtitle="ارتباط مستقیم با تیم پشتیبانی SmartWash؛ پیگیری همه‌ی درخواست‌ها در یک جا"
        actions={
          <button
            onClick={() => setComposerOpen(v => !v)}
            className="inline-flex items-center gap-2 rounded-2xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-bold text-white"
          >
            {composerOpen ? <X size={16} /> : <Plus size={16} />}
            {composerOpen ? 'بستن فرم' : 'تیکت جدید'}
          </button>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="تیکت‌های باز" value={fa(summary.open)} accent="amber" hint="در جریان بررسی" />
          <StatCard label="پاسخ‌های خوانده‌نشده" value={fa(summary.unreadForTenant)} accent="red" hint="منتظر مطالعه شما" />
          <StatCard label="حل‌شده" value={fa(summary.resolved)} accent="emerald" hint="آماده تایید و امتیازدهی" />
          <StatCard label="کل تیکت‌ها" value={fa(summary.total)} accent="sky" hint="از ابتدای همکاری" />
        </div>
      )}

      {composerOpen && <TicketComposer onCreated={id => { setComposerOpen(false); navigate(`/app/support/${id}`); }} />}

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="جستجو در شماره یا عنوان تیکت…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pr-10 pl-3 py-2.5 text-sm"
            />
          </label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value === '' ? '' : Number(e.target.value) as TicketStatus)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
          >
            <option value="">همه وضعیت‌ها</option>
            {TICKET_STATUSES.map(s => <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>)}
          </select>
          <select
            value={category}
            onChange={e => setCategory(e.target.value === '' ? '' : Number(e.target.value) as TicketCategory)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
          >
            <option value="">همه دسته‌ها</option>
            {TICKET_CATEGORIES.map(c => <option key={c} value={c}>{TICKET_CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <Card><SkeletonRows rows={6} /></Card>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="تیکتی ثبت نشده است"
          hint="هر سوال یا مشکلی دارید، با ثبت تیکت مستقیماً به تیم پشتیبانی برسانید."
          action={
            <button onClick={() => setComposerOpen(true)} className="rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 text-xs font-bold">
              ثبت اولین تیکت
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map(t => <TicketRow key={t.id} ticket={t} onOpen={() => navigate(`/app/support/${t.id}`)} />)}
        </div>
      )}
    </div>
  );
};

const TicketRow = ({ ticket, onOpen }: { ticket: TicketListItemDto; onOpen: () => void }) => (
  <button
    onClick={onOpen}
    className="w-full text-right bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-red-200 dark:hover:border-red-900 p-4 sm:p-5 transition-colors"
  >
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-[11px] font-bold text-gray-400 tabular-nums" dir="ltr">{ticket.number}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TICKET_STATUS_CLASS[ticket.status]}`}>
            {TICKET_STATUS_LABEL[ticket.status]}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TICKET_PRIORITY_CLASS[ticket.priority]}`}>
            {TICKET_PRIORITY_LABEL[ticket.priority]}
          </span>
          {ticket.unreadForTenant > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {fa(ticket.unreadForTenant)} پاسخ جدید
            </span>
          )}
        </div>
        <div className="font-bold text-gray-900 dark:text-gray-100 truncate">{ticket.subject}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-3 flex-wrap">
          <span>{TICKET_CATEGORY_LABEL[ticket.category]}</span>
          <span className="flex items-center gap-1"><MessageSquare size={12} />{fa(ticket.messageCount)} پیام</span>
          <span>آخرین فعالیت {formatRelative(ticket.lastMessageAtUtc)}</span>
          {ticket.satisfactionRating !== null && (
            <span className="flex items-center gap-1 text-amber-600"><Star size={12} />{fa(ticket.satisfactionRating)} از ۵</span>
          )}
        </div>
      </div>
      {ticket.assignedToName && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
          کارشناس: <b className="text-gray-700 dark:text-gray-200">{ticket.assignedToName}</b>
        </div>
      )}
    </div>
  </button>
);

const TicketComposer = ({ onCreated }: { onCreated: (id: string) => void }) => {
  const [form, setForm] = useState(emptyForm);
  const [attachments, setAttachments] = useState<TicketAttachmentUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).slice(0, 10).map(f => ticketsApi.uploadAttachment(f)));
      setAttachments(prev => [...prev, ...uploaded].slice(0, 10));
    } catch (e: any) {
      toast.error(e?.message ?? 'بارگذاری پیوست ناموفق بود');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const created = await ticketsApi.create({ ...form, attachments });
      toast.success(`تیکت ${created.ticket.number} ثبت شد`);
      setForm(emptyForm);
      setAttachments([]);
      onCreated(created.ticket.id);
    } catch (e: any) {
      toast.error(e?.message ?? 'ثبت تیکت ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-5">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="md:col-span-3">
            <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">عنوان تیکت</span>
            <input
              required maxLength={200} value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="مثلاً: خطا در ثبت سفارش جایگاه ۲"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">دسته‌بندی</span>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: Number(e.target.value) as TicketCategory })}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
            >
              {TICKET_CATEGORIES.map(c => <option key={c} value={c}>{TICKET_CATEGORY_LABEL[c]}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">اولویت</span>
            <select
              value={form.priority}
              onChange={e => setForm({ ...form, priority: Number(e.target.value) as TicketPriority })}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
            >
              {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{TICKET_PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="flex items-end">
            <span className="w-full">
              <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">پیوست</span>
              <span className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2.5 text-xs text-gray-500">
                <Paperclip size={14} />
                {uploading ? 'در حال بارگذاری…' : 'تصویر، PDF یا ZIP'}
                <input type="file" multiple className="hidden" onChange={e => upload(e.target.files)} />
              </span>
            </span>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">توضیحات</span>
          <textarea
            required maxLength={4000} rows={5} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="مشکل یا درخواست خود را با جزئیات بنویسید؛ هرچه دقیق‌تر، پاسخ سریع‌تر."
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm leading-6"
          />
        </label>

        {attachments.length > 0 && <AttachmentChips items={attachments} onRemove={i => setAttachments(a => a.filter((_, idx) => idx !== i))} />}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-500" />
            مهلت پاسخ اولیه بر اساس اولویت انتخابی محاسبه می‌شود؛ فوری ۴ ساعت، زیاد ۱۲ ساعت، عادی ۴۸ ساعت.
          </p>
          <button
            type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-100 px-5 py-2.5 text-sm font-bold text-white dark:text-gray-900 disabled:opacity-60"
          >
            <Send size={15} />{saving ? 'در حال ثبت…' : 'ثبت تیکت'}
          </button>
        </div>
      </form>
    </Card>
  );
};

export const AttachmentChips = ({
  items, onRemove,
}: { items: TicketAttachmentUpload[]; onRemove?: (index: number) => void }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((a, i) => (
      <span key={`${a.path}-${i}`} className="inline-flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-[11px]">
        <Paperclip size={12} className="text-gray-400" />
        <span className="max-w-[180px] truncate">{a.fileName}</span>
        <span className="text-gray-400">{formatFileSize(a.sizeBytes)}</span>
        {onRemove && (
          <button type="button" onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-600">
            <X size={12} />
          </button>
        )}
      </span>
    ))}
  </div>
);

export default SupportView;
