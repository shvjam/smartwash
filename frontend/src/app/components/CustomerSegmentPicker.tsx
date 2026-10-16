import React, { useState } from 'react';
import { Filter, Loader2, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { customerSegmentApi } from '../api';
import { LoyaltyTier, type CustomerSegment, type CustomerSegmentFilter } from '../api/types';
import { toJalaliLabel } from '../lib/persian';
import { localIsoDate } from '../lib/dates';

const fa = (n: number) => n.toLocaleString('fa-IR');
const iso = (d: Date) => localIsoDate(d);
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

/**
 * Ready-made ways of describing a group, in the manager's own words.
 *
 * The filter underneath takes a dozen optional fields that combine freely, but nobody opens a
 * screen wanting to fill in a dozen fields. These are the groups that actually get messaged,
 * one click each; the fields stay available underneath for the case a preset does not cover.
 */
const PRESETS: Array<{ label: string; filter: CustomerSegmentFilter }> = [
  { label: 'سررسید ۱۰ روز آینده', filter: { dueFrom: iso(new Date()), dueTo: inDays(10) } },
  { label: 'سررسید این ماه', filter: { dueFrom: iso(new Date()), dueTo: inDays(30) } },
  { label: 'سررسید گذشته', filter: { dueTo: iso(new Date()) } },
  { label: '۳۰ روز مراجعه نکرده', filter: { notVisitedInDays: 30 } },
  { label: '۴۵ روز مراجعه نکرده', filter: { notVisitedInDays: 45 } },
  { label: '۹۰ روز مراجعه نکرده', filter: { notVisitedInDays: 90 } },
  { label: 'مشتریان پرتکرار', filter: { minVisits: 5 } },
  { label: 'مشتریان ویژه', filter: { minTier: LoyaltyTier.Gold } },
];

/**
 * Picks a group of customers and hands it back.
 *
 * Choosing and sending are kept apart on purpose: this shows who matches and how many, and the
 * screen that owns it decides what to do with them. A picker that sent messages as a side
 * effect of being used would be a dangerous thing to leave on a page.
 */
export const CustomerSegmentPicker = ({
  onPick,
  onClose,
}: {
  onPick: (segment: CustomerSegment, description: string) => void;
  onClose: () => void;
}) => {
  const [filter, setFilter] = useState<CustomerSegmentFilter>({ take: 500 });
  const [result, setResult] = useState<CustomerSegment | null>(null);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (f: CustomerSegmentFilter, description: string) => {
    setLoading(true); setErr(null); setLabel(description);
    try {
      const next = { ...f, take: 500 };
      setFilter(next);
      setResult(await customerSegmentApi.query(next));
    } catch {
      setErr('فهرست مشتریان بارگذاری نشد');
    } finally { setLoading(false); }
  };

  const describe = (f: CustomerSegmentFilter) => {
    const parts: string[] = [];
    if (f.dueFrom || f.dueTo) parts.push(`سررسید ${f.dueFrom ? toJalaliLabel(f.dueFrom) : '—'} تا ${f.dueTo ? toJalaliLabel(f.dueTo) : '—'}`);
    if (f.notVisitedInDays) parts.push(`${fa(f.notVisitedInDays)} روز مراجعه نکرده`);
    if (f.visitedInDays) parts.push(`طی ${fa(f.visitedInDays)} روز مراجعه کرده`);
    if (f.minVisits) parts.push(`حداقل ${fa(f.minVisits)} مراجعه`);
    if (f.minTier !== undefined) parts.push('سطح وفاداری بالا');
    return parts.join(' · ') || 'همه‌ی مشتریان';
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          <Filter size={15} className="text-brand-600" />انتخاب گروهی مشتریان
        </span>
        <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={15} /></button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => run(p.filter, p.label)} disabled={loading}
            className={clsx('rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50',
              label === p.label ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-gray-500">سررسید از</span>
          <input type="date" value={filter.dueFrom ?? ''} onChange={e => setFilter({ ...filter, dueFrom: e.target.value || undefined })}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-gray-500">سررسید تا</span>
          <input type="date" value={filter.dueTo ?? ''} onChange={e => setFilter({ ...filter, dueTo: e.target.value || undefined })}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-gray-500">مراجعه نکرده (روز)</span>
          <input type="number" min="0" value={filter.notVisitedInDays ?? ''}
            onChange={e => setFilter({ ...filter, notVisitedInDays: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-gray-500">حداقل مراجعه</span>
          <input type="number" min="0" value={filter.minVisits ?? ''}
            onChange={e => setFilter({ ...filter, minVisits: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" />
        </label>
        <button onClick={() => run(filter, describe(filter))} disabled={loading}
          className="col-span-2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 sm:col-span-4">
          {loading ? <Loader2 size={13} className="mx-auto animate-spin" /> : 'اعمال فیلتر دلخواه'}
        </button>
      </div>

      {err && <p className="mb-2 text-xs text-red-600">{err}</p>}

      {result && (
        <div className="rounded-xl border border-gray-100 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
              <Users size={13} className="text-brand-600" />
              {fa(result.matchCount)} مشتری یافت شد
            </span>
            {result.customers.length > 0 && (
              <button onClick={() => onPick(result, label || describe(filter))}
                className="rounded-xl bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-700">
                انتخاب این گروه
              </button>
            )}
          </div>

          {result.customers.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-gray-400">هیچ مشتری‌ای با این شرایط پیدا نشد.</p>
          ) : (
            <>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {result.customers.slice(0, 30).map(c => (
                  <div key={c.customerId} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-gray-800">{c.fullName}</span>
                    <span className="flex-shrink-0 font-mono text-gray-400" dir="ltr">{c.phone}</span>
                    <span className="w-24 flex-shrink-0 text-left text-gray-500">
                      {c.daysSinceLastVisit > 9000 ? 'بدون مراجعه' : `${fa(c.daysSinceLastVisit)} روز پیش`}
                    </span>
                  </div>
                ))}
              </div>
              {result.matchCount > 30 && (
                <p className="mt-1.5 text-center text-[10px] text-gray-400">
                  {fa(result.matchCount - 30)} مشتری دیگر نمایش داده نشده — همه‌ی آن‌ها در گروه هستند.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
