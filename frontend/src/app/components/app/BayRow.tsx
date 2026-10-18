import React, { useState } from 'react';
import { Car, Check, Pencil, Wrench, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { baysApi, type BayDto, ApiException } from '../../api';
import { BayStatus, BayType } from '../../api/types';
import { BAY_TYPE_LABEL } from '../../lib/orderStages';

/**
 * One bay in the branch's bay list: read it, change it, take it out of service and put it back.
 *
 * The list used to offer only a spanner. It sent the bay to maintenance and then showed the
 * same spanner again, so a bay taken out for a broken pump could not be brought back from the
 * screen that took it out — and nothing on it could be renamed, renumbered or retyped, though
 * the API had accepted all three from the start.
 */
export const BayRow = ({ bay, onChanged }: { bay: BayDto; onChanged: () => Promise<void> | void }) => {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: bay.name, number: bay.number, type: bay.type, queueCapacity: bay.queueCapacity,
  });

  const run = async (action: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await onChanged();
      return true;
    } catch (e) {
      toast.error(e instanceof ApiException ? e.message : failed);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('نام جایگاه را وارد کنید'); return; }
    if (form.number < 1) { toast.error('شماره‌ی جایگاه باید از ۱ بزرگ‌تر باشد'); return; }
    const ok = await run(
      () => baysApi.update(bay.id, {
        name: form.name.trim(), number: form.number, notes: bay.notes ?? null,
        type: form.type, queueCapacity: Math.max(0, form.queueCapacity),
      }),
      'جایگاه به‌روزرسانی شد', 'ذخیره‌ی جایگاه انجام نشد');
    if (ok) setEditing(false);
  };

  const inMaintenance = bay.status === BayStatus.Maintenance;
  const occupied = bay.status === BayStatus.Occupied;

  const toggleService = () => inMaintenance
    ? run(() => baysApi.free(bay.id), 'جایگاه به چرخه‌ی کار برگشت', 'بازگرداندن جایگاه انجام نشد')
    : confirm(`«${bay.name}» از سرویس خارج شود؟ تا بازگرداندن، سفارشی روی آن ثبت نمی‌شود.`)
      && run(() => baysApi.maintenance(bay.id, 'خارج از سرویس از پنل مدیریت'),
        'جایگاه از سرویس خارج شد', 'خارج‌کردن جایگاه از سرویس انجام نشد');

  if (editing) {
    return (
      <div className="rounded-2xl bg-white border border-brand-200 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block">
            <span className="mb-1 block text-[10px] font-medium text-gray-500">نام</span>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-gray-500">شماره</span>
            <input type="number" min="1" value={form.number}
              onChange={e => setForm({ ...form, number: Number(e.target.value) || 1 })}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-gray-500">ظرفیت صف</span>
            <input type="number" min="0" value={form.queueCapacity}
              onChange={e => setForm({ ...form, queueCapacity: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-[10px] font-medium text-gray-500">نوع</span>
            <select value={form.type} onChange={e => setForm({ ...form, type: Number(e.target.value) as BayType })}
              disabled={occupied}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50">
              {Object.entries(BAY_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {occupied && <span className="mt-1 block text-[10px] text-amber-600">تا وقتی خودرویی روی جایگاه است، نوع آن تغییر نمی‌کند.</span>}
          </label>
        </div>
        <div className="flex gap-2">
          <button disabled={busy} onClick={save}
            className="flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            <Check size={13} />ذخیره
          </button>
          <button onClick={() => { setEditing(false); setForm({ name: bay.name, number: bay.number, type: bay.type, queueCapacity: bay.queueCapacity }); }}
            className="flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">
            <X size={13} />انصراف
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white border border-gray-100 p-3">
      <div className="flex items-center gap-2">
        <span className={`grid size-9 place-items-center rounded-xl ${inMaintenance ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'}`}>
          {inMaintenance ? <Wrench size={17} /> : <Car size={17} />}
        </span>
        <div>
          <b className="text-sm">{bay.name}</b>
          <p className="text-[11px] text-gray-500">
            جایگاه {bay.number} · {BAY_TYPE_LABEL[bay.type]}
            {bay.queueCapacity > 0 ? ` · صف ${bay.queueLength}/${bay.queueCapacity}` : ''}
            {inMaintenance && <span className="text-amber-600"> · خارج از سرویس</span>}
            {occupied && <span className="text-sky-600"> · در حال کار</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button disabled={busy} onClick={() => setEditing(true)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" title="ویرایش">
          <Pencil size={15} />
        </button>
        <button disabled={busy || occupied} onClick={toggleService}
          className={`rounded-lg p-2 disabled:opacity-40 ${inMaintenance ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}
          title={occupied ? 'خودرو روی جایگاه است' : inMaintenance ? 'بازگرداندن به سرویس' : 'خارج‌کردن از سرویس'}>
          {inMaintenance ? <RotateCcw size={16} /> : <Wrench size={16} />}
        </button>
      </div>
    </div>
  );
};
