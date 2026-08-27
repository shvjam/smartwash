import React, { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import { platformAuditApi, AuditLogDto } from '../../api';

const fmtDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(d);
  } catch { return iso; }
};

const actionColor = (a: string) => {
  const low = a.toLowerCase();
  if (low.includes('delete') || low.includes('remove') || low.includes('cancel')) return 'bg-red-500/15 text-red-300';
  if (low.includes('create') || low.includes('add')) return 'bg-emerald-500/15 text-emerald-300';
  if (low.includes('update') || low.includes('edit') || low.includes('change')) return 'bg-amber-500/15 text-amber-300';
  return 'bg-sky-500/15 text-sky-300';
};

export const AuditLogView = () => {
  const [items, setItems] = useState<AuditLogDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [entityName, setEntityName] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const reload = async (p = page) => {
    setLoading(true); setErr(null);
    try {
      const r = await platformAuditApi.list({
        entityName: entityName || undefined,
        action: action || undefined,
        fromUtc: from ? new Date(from).toISOString() : undefined,
        toUtc: to ? new Date(to).toISOString() : undefined,
        page: p, pageSize,
      });
      setItems(r.items); setTotal(r.totalCount); setPage(r.page);
    } catch (e: any) {
      setErr(e?.message ?? 'خطا در بارگذاری');
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(1); /* eslint-disable-next-line */ }, []);

  const applyFilters = () => reload(1);
  const clearFilters = () => {
    setEntityName(''); setAction(''); setFrom(''); setTo('');
    setTimeout(() => reload(1), 0);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center text-violet-300">
            <ScrollText size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">لاگ ممیزی</h1>
            <p className="text-xs text-gray-400">رکوردهای تغییرات سامانه‌ای — قابل فیلتر</p>
          </div>
        </div>
        <button
          onClick={() => reload(page)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-gray-200 transition"
        >
          <RefreshCw size={16} /> بروزرسانی
        </button>
      </header>

      <div className="bg-gray-900 border border-white/5 rounded-3xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">نوع موجودیت</label>
            <input value={entityName} onChange={e => setEntityName(e.target.value)}
              placeholder="Order, Customer..."
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">عملیات</label>
            <input value={action} onChange={e => setAction(e.target.value)}
              placeholder="Created, Updated..."
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">از تاریخ</label>
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">تا تاریخ</label>
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={applyFilters}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold">
            اعمال فیلتر
          </button>
          <button onClick={clearFilters}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm">
            پاک‌سازی
          </button>
          <div className="mr-auto text-xs text-gray-400">مجموع: {new Intl.NumberFormat('fa-IR').format(total)}</div>
        </div>
      </div>

      <div className="bg-gray-900 border border-white/5 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">در حال بارگذاری...</div>
        ) : err ? (
          <div className="p-10 text-center text-rose-300">{err}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-gray-500">رکوردی یافت نشد.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map(it => {
              const open = expanded === it.id;
              return (
                <div key={it.id} className="p-4 hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${actionColor(it.action)}`}>{it.action}</span>
                    <span className="text-sm font-bold text-white">{it.entityName}</span>
                    <span className="text-[11px] text-gray-500 font-mono">#{it.entityId}</span>
                    <span className="text-[11px] text-gray-400">{fmtDateTime(it.occurredAtUtc)}</span>
                    {it.userDisplayName && <span className="text-[11px] text-gray-300">توسط: {it.userDisplayName}</span>}
                    {it.tenantSlug && <span className="text-[11px] text-violet-300">مستاجر: {it.tenantSlug}</span>}
                    {it.ipAddress && <span className="text-[11px] text-gray-500 font-mono">{it.ipAddress}</span>}
                    <button onClick={() => setExpanded(open ? null : it.id)}
                      className="mr-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300">
                      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                  {open && (
                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <div className="text-[10px] text-gray-500 mb-1 font-bold">قبل</div>
                        <pre className="text-[11px] text-gray-300 whitespace-pre-wrap break-all max-h-60 overflow-auto">{it.oldValues ?? '—'}</pre>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <div className="text-[10px] text-gray-500 mb-1 font-bold">بعد</div>
                        <pre className="text-[11px] text-gray-300 whitespace-pre-wrap break-all max-h-60 overflow-auto">{it.newValues ?? '—'}</pre>
                      </div>
                      {it.correlationId && (
                        <div className="lg:col-span-2 text-[10px] text-gray-500 font-mono">CorrelationId: {it.correlationId}</div>
                      )}
                      {it.userAgent && (
                        <div className="lg:col-span-2 text-[10px] text-gray-500 truncate">UA: {it.userAgent}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => reload(page - 1)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-sm text-gray-200">قبلی</button>
          <span className="text-xs text-gray-400">صفحه {new Intl.NumberFormat('fa-IR').format(page)} از {new Intl.NumberFormat('fa-IR').format(totalPages)}</span>
          <button disabled={page >= totalPages} onClick={() => reload(page + 1)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-sm text-gray-200">بعدی</button>
        </div>
      )}
    </div>
  );
};

export default AuditLogView;
