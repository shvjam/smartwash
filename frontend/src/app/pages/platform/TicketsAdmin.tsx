import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlarmClock, Building2, Inbox, Lock, MessageSquare, Paperclip, Search, Send, Star, TimerReset, UserCheck,
} from 'lucide-react';
import {
  platformTicketsApi, type SupportAgentDto, type TicketAttachmentUpload, type TicketCategory,
  type TicketDeskStatsDto, type TicketDetailDto, type TicketListItemDto, type TicketPriority, type TicketStatus,
} from '../../api';
import { Card, EmptyState, PageHeader, SkeletonRows } from '../../components/app/PageHeader';
import {
  describeTicketEvent, fa, formatDateTime, formatFileSize, formatRelative, formatSlaRemaining,
  TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, TICKET_PRIORITIES, TICKET_PRIORITY_CLASS,
  TICKET_PRIORITY_LABEL, TICKET_STATUS_CLASS, TICKET_STATUS_LABEL, TICKET_STATUSES,
} from '../../lib/tickets';

type Filters = {
  status: TicketStatus | '';
  category: TicketCategory | '';
  priority: TicketPriority | '';
  search: string;
  queue: 'all' | 'unanswered' | 'unassigned' | 'breached';
};

const initialFilters: Filters = { status: '', category: '', priority: '', search: '', queue: 'unanswered' };

const QUEUE_TABS: { key: Filters['queue']; label: string }[] = [
  { key: 'unanswered', label: 'منتظر پاسخ ما' },
  { key: 'unassigned', label: 'بدون مسئول' },
  { key: 'breached', label: 'نقض مهلت SLA' },
  { key: 'all', label: 'همه تیکت‌ها' },
];

export const TicketsAdmin = () => {
  const [items, setItems] = useState<TicketListItemDto[]>([]);
  const [stats, setStats] = useState<TicketDeskStatsDto | null>(null);
  const [agents, setAgents] = useState<SupportAgentDto[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        platformTicketsApi.list({
          status: filters.status === '' ? undefined : filters.status,
          category: filters.category === '' ? undefined : filters.category,
          priority: filters.priority === '' ? undefined : filters.priority,
          search: filters.search.trim() || undefined,
          openOnly: filters.queue !== 'all',
          unansweredOnly: filters.queue === 'unanswered',
          unassignedOnly: filters.queue === 'unassigned',
          slaBreachedOnly: filters.queue === 'breached',
          pageSize: 60,
        }),
        platformTicketsApi.stats(),
      ]);
      setItems(list.items);
      setStats(s);
    } catch (e: any) {
      setError(e?.message ?? 'خطا در بارگذاری میز پشتیبانی');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { platformTicketsApi.agents().then(setAgents).catch(() => setAgents([])); }, []);

  return (
    <div className="max-w-[1400px] mx-auto pb-10">
      <PageHeader title="میز پشتیبانی" subtitle="صف تیکت‌های مستاجران، پایش SLA و پاسخ‌دهی تیم پلتفرم" />

      {error && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Metric icon={Inbox} label="منتظر پاسخ ما" value={fa(stats.unansweredByPlatform)} hint={`${fa(stats.new)} تیکت جدید`} />
          <Metric icon={AlarmClock} label="نقض مهلت SLA" value={fa(stats.slaBreached)} hint="بدون پاسخ اولیه در مهلت" danger />
          <Metric icon={UserCheck} label="بدون مسئول" value={fa(stats.unassigned)} hint="نیازمند تخصیص کارشناس" />
          <Metric
            icon={TimerReset}
            label="میانگین پاسخ اولیه"
            value={stats.avgFirstResponseHours === null ? '—' : `${fa(stats.avgFirstResponseHours)} ساعت`}
            hint={stats.avgSatisfaction === null
              ? 'هنوز امتیازی ثبت نشده'
              : `رضایت ${fa(stats.avgSatisfaction)} از ۵ در ${fa(stats.ratedCount)} نظر`}
          />
        </div>
      )}

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {QUEUE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilters(f => ({ ...f, queue: tab.key }))}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                filters.queue === tab.key
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="شماره، عنوان یا نام درخواست‌کننده…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pr-10 pl-3 py-2.5 text-sm"
            />
          </label>
          <Select
            value={filters.status}
            onChange={v => setFilters(f => ({ ...f, status: v === '' ? '' : Number(v) as TicketStatus }))}
            placeholder="همه وضعیت‌ها"
            options={TICKET_STATUSES.map(s => ({ value: s, label: TICKET_STATUS_LABEL[s] }))}
          />
          <Select
            value={filters.priority}
            onChange={v => setFilters(f => ({ ...f, priority: v === '' ? '' : Number(v) as TicketPriority }))}
            placeholder="همه اولویت‌ها"
            options={TICKET_PRIORITIES.map(p => ({ value: p, label: TICKET_PRIORITY_LABEL[p] }))}
          />
          <Select
            value={filters.category}
            onChange={v => setFilters(f => ({ ...f, category: v === '' ? '' : Number(v) as TicketCategory }))}
            placeholder="همه دسته‌ها"
            options={TICKET_CATEGORIES.map(c => ({ value: c, label: TICKET_CATEGORY_LABEL[c] }))}
          />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr] items-start">
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-3.5 text-sm font-extrabold">
            صف تیکت‌ها {items.length > 0 && <span className="text-gray-400">({fa(items.length)})</span>}
          </div>
          {loading ? (
            <div className="p-5"><SkeletonRows rows={6} /></div>
          ) : items.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Inbox} title="تیکتی در این صف نیست" hint="فیلترها را تغییر دهید یا صف دیگری را ببینید." />
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {items.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-right p-4 transition-colors ${
                    selectedId === t.id ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[10px] font-bold text-gray-400 tabular-nums" dir="ltr">{t.number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TICKET_PRIORITY_CLASS[t.priority]}`}>
                      {TICKET_PRIORITY_LABEL[t.priority]}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TICKET_STATUS_CLASS[t.status]}`}>
                      {TICKET_STATUS_LABEL[t.status]}
                    </span>
                    {t.isSlaBreached && (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">SLA</span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{t.subject}</div>
                  <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Building2 size={11} />{t.tenantName ?? t.tenantSlug ?? '—'}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare size={11} />{fa(t.messageCount)}</span>
                    <span>{formatRelative(t.lastMessageAtUtc)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selectedId ? (
          <TicketWorkspace key={selectedId} ticketId={selectedId} agents={agents} onMutated={load} />
        ) : (
          <EmptyState icon={MessageSquare} title="تیکتی انتخاب نشده" hint="از صف سمت راست یک تیکت را برای بررسی و پاسخ انتخاب کنید." />
        )}
      </div>
    </div>
  );
};

const Metric = ({
  icon: Icon, label, value, hint, danger,
}: { icon: any; label: string; value: string; hint: string; danger?: boolean }) => (
  <Card className={`border-0 ${danger ? 'bg-rose-950 text-white' : 'bg-gray-900 text-white'}`}>
    <Icon size={18} className={`mb-4 ${danger ? 'text-rose-300' : 'text-red-300'}`} />
    <div className="text-2xl font-black">{value}</div>
    <div className="text-sm font-bold mt-1">{label}</div>
    <div className="text-[11px] text-gray-400 mt-1">{hint}</div>
  </Card>
);

const Select = ({
  value, onChange, placeholder, options,
}: {
  value: number | '';
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: number; label: string }[];
}) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
  >
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const TicketWorkspace = ({
  ticketId, agents, onMutated,
}: { ticketId: string; agents: SupportAgentDto[]; onMutated: () => void }) => {
  const [data, setData] = useState<TicketDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [attachments, setAttachments] = useState<TicketAttachmentUpload[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await platformTicketsApi.get(ticketId)); }
    catch (e: any) { toast.error(e?.message ?? 'خطا در بارگذاری تیکت'); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    try {
      setData(await platformTicketsApi.reply(ticketId, body.trim(), internal, attachments));
      setBody('');
      setAttachments([]);
      toast.success(internal ? 'یادداشت داخلی ثبت شد' : 'پاسخ برای مستاجر ارسال شد');
      onMutated();
    } catch (e: any) { toast.error(e?.message ?? 'ارسال ناموفق بود'); }
    finally { setBusy(false); }
  };

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      await load();
      onMutated();
      toast.success(successMessage);
    } catch (e: any) { toast.error(e?.message ?? 'عملیات ناموفق بود'); }
    finally { setBusy(false); }
  };

  if (loading || !data) return <Card><SkeletonRows rows={7} /></Card>;

  const t = data.ticket;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-bold text-gray-400 tabular-nums" dir="ltr">{t.number}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TICKET_STATUS_CLASS[t.status]}`}>
                {TICKET_STATUS_LABEL[t.status]}
              </span>
              {t.isSlaBreached && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">نقض SLA</span>}
            </div>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{t.subject}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t.tenantName ?? '—'} · {t.requesterName}
              {t.requesterPhone && <span dir="ltr"> · {t.requesterPhone}</span>}
              {' · '}{formatDateTime(t.createdAtUtc)}
            </p>
          </div>
          <div className="text-left text-[11px]">
            <div className={t.isSlaBreached ? 'font-bold text-rose-600' : 'text-gray-500 dark:text-gray-400'}>
              {t.firstResponseAtUtc
                ? `پاسخ اولیه ${formatRelative(t.firstResponseAtUtc)}`
                : formatSlaRemaining(t.dueAtUtc, t.isSlaBreached)}
            </div>
            {t.satisfactionRating !== null && (
              <div className="mt-1 inline-flex items-center gap-1 text-amber-600">
                <Star size={12} fill="currentColor" />{fa(t.satisfactionRating)} از ۵
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-gray-100 dark:border-gray-800 pt-4">
          <TriageSelect
            label="وضعیت" value={t.status} disabled={busy}
            options={TICKET_STATUSES.map(s => ({ value: s, label: TICKET_STATUS_LABEL[s] }))}
            onChange={v => runAction(() => platformTicketsApi.setStatus(t.id, v as TicketStatus), 'وضعیت تیکت به‌روزرسانی شد')}
          />
          <TriageSelect
            label="اولویت" value={t.priority} disabled={busy}
            options={TICKET_PRIORITIES.map(p => ({ value: p, label: TICKET_PRIORITY_LABEL[p] }))}
            onChange={v => runAction(() => platformTicketsApi.setPriority(t.id, v as TicketPriority), 'اولویت تیکت به‌روزرسانی شد')}
          />
          <TriageSelect
            label="دسته‌بندی" value={t.category} disabled={busy}
            options={TICKET_CATEGORIES.map(c => ({ value: c, label: TICKET_CATEGORY_LABEL[c] }))}
            onChange={v => runAction(() => platformTicketsApi.setCategory(t.id, v as TicketCategory), 'دسته‌بندی تیکت به‌روزرسانی شد')}
          />
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-gray-500 dark:text-gray-400">کارشناس مسئول</span>
            <select
              value={t.assignedToUserId ?? ''}
              disabled={busy}
              onChange={e => runAction(
                () => platformTicketsApi.assign(t.id, e.target.value || null),
                'مسئول تیکت به‌روزرسانی شد',
              )}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
            >
              <option value="">بدون مسئول</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.displayName} ({fa(a.openTickets)})</option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-3.5 text-sm font-extrabold">
          گفتگو ({fa(data.messages.length)} پیام)
        </div>
        <div className="max-h-[45vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {data.messages.map(m => (
            <div
              key={m.id}
              className={`p-4 sm:p-5 ${
                m.isInternalNote ? 'bg-amber-50/60 dark:bg-amber-950/20'
                  : m.authorSide === 1 ? 'bg-red-50/40 dark:bg-red-950/10' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{m.authorName}</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  m.authorSide === 1
                    ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {m.authorSide === 1 ? 'پشتیبانی' : 'مستاجر'}
                </span>
                {m.isInternalNote && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-900">
                    <Lock size={9} />یادداشت داخلی
                  </span>
                )}
                <span className="mr-auto text-[10px] text-gray-400">{formatDateTime(m.createdAtUtc)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-300">{m.body}</p>
              {m.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.attachments.map(a => (
                    <a
                      key={a.id} href={a.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-[11px] hover:border-red-300"
                    >
                      <Paperclip size={11} className="text-gray-400" />
                      <span className="max-w-[160px] truncate">{a.fileName}</span>
                      <span className="text-gray-400">{formatFileSize(a.sizeBytes)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <form onSubmit={send} className="space-y-3">
          <textarea
            rows={4} maxLength={4000} value={body} onChange={e => setBody(e.target.value)}
            placeholder={internal ? 'یادداشت داخلی برای تیم پشتیبانی (برای مستاجر نمایش داده نمی‌شود)…' : 'پاسخ خود را برای مستاجر بنویسید…'}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm leading-7 ${
              internal
                ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
                : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
            }`}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} className="accent-amber-600" />
              <Lock size={13} className="text-amber-600" />ثبت به‌عنوان یادداشت داخلی
            </label>
            <button
              type="submit" disabled={busy || !body.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Send size={15} />{busy ? 'در حال ارسال…' : internal ? 'ثبت یادداشت' : 'ارسال پاسخ'}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="text-sm font-extrabold mb-3">تاریخچه تیکت</h3>
        <ol className="space-y-2.5">
          {data.events.map(e => (
            <li key={e.id} className="flex gap-3 text-xs">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
              <div className="min-w-0">
                <span className="text-gray-700 dark:text-gray-300">{describeTicketEvent(e)}</span>
                <span className="text-[10px] text-gray-400"> — {e.actorName} · {formatDateTime(e.occurredAtUtc)}</span>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
};

const TriageSelect = ({
  label, value, options, onChange, disabled,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
  disabled?: boolean;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
    <select
      value={value} disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
);

export default TicketsAdmin;
