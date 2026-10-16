import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2, UserPlus, X, Loader2, Users, Info } from 'lucide-react';
import clsx from 'clsx';
import { PageHeader, Card, EmptyState } from '../../components/app/PageHeader';
import { WorkerAvatar } from '../../components/WorkerAvatar';
import { rostersApi, baysApi, workersApi, usersApi, ApiException } from '../../api';
import { StaffRole, type ShiftRosterDto, type BayDto, type WorkerDto } from '../../api/types';
import { resolveUploadUrl } from '../../api/adapters';
import { useCarWash } from '../../store';
import { toJalaliLabel } from '../../lib/persian';
import { localIsoDate, parseLocalDate } from '../../lib/dates';

const fa = (n: number) => n.toLocaleString('fa-IR');
const iso = (d: Date) => localIsoDate(d);

const ROLE_LABEL: Record<StaffRole, string> = {
  [StaffRole.Washer]: 'شستشو',
  [StaffRole.Dryer]: 'خشک‌کن',
  [StaffRole.OptionServices]: 'واکس و پولیش',
  [StaffRole.Cashier]: 'صندوق‌دار',
  [StaffRole.ShiftLead]: 'سرشیفت',
  [StaffRole.Other]: 'سایر',
};

const ROLE_TONE: Record<StaffRole, string> = {
  [StaffRole.Washer]: 'bg-blue-50 text-blue-700',
  [StaffRole.Dryer]: 'bg-orange-50 text-orange-700',
  [StaffRole.OptionServices]: 'bg-violet-50 text-violet-700',
  [StaffRole.Cashier]: 'bg-emerald-50 text-emerald-700',
  [StaffRole.ShiftLead]: 'bg-amber-50 text-amber-700',
  [StaffRole.Other]: 'bg-gray-100 text-gray-600',
};

/** Roles filled by someone who signs in, rather than by a body on the floor. */
const ACCOUNT_ROLES = new Set([StaffRole.Cashier, StaffRole.ShiftLead]);

/**
 * Who is working, when, and on which bay.
 *
 * Deliberately separate from the cash-register shift already in the app. That one is about a
 * till being opened with a float and counted at the end; this is about people. Running them
 * together is what left the system knowing exactly how much money a shift took and nothing at
 * all about who worked it — so neither "how many were on yesterday" nor "which bay sat idle
 * for want of staff" could be answered.
 */
export const RostersView = () => {
  const { branches } = useCarWash();
  const [weekStart, setWeekStart] = useState(() => {
    // Weeks start on Saturday here, not Sunday.
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
    return iso(d);
  });

  const [rosters, setRosters] = useState<ShiftRosterDto[]>([]);
  const [bays, setBays] = useState<BayDto[]>([]);
  const [workers, setWorkers] = useState<WorkerDto[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ date: iso(new Date()), name: 'شیفت صبح', startsAt: '07:00', endsAt: '15:00' });
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState<{ role: StaffRole; personId: string; bayId: string }>({
    role: StaffRole.Washer, personId: '', bayId: '',
  });

  const weekEnd = useMemo(() => {
    const d = parseLocalDate(weekStart);
    d.setDate(d.getDate() + 6);
    return iso(d);
  }, [weekStart]);

  const branchId = branches[0]?.id;

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      setRosters(await rostersApi.list(weekStart, weekEnd));
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'برنامه‌ی شیفت بارگذاری نشد');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [weekStart, weekEnd]);

  useEffect(() => {
    baysApi.list(undefined, true).then(setBays).catch(() => { });
    workersApi.list(undefined, true).then(setWorkers).catch(() => { });
    usersApi.list().then(u => setUsers(u.map(x => ({ id: x.id, displayName: x.displayName })))).catch(() => { });
  }, []);

  const wrap = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try { await fn(); await load(); }
    catch (e) { setErr(e instanceof ApiException ? e.message : 'عملیات انجام نشد'); }
    finally { setBusy(false); }
  };

  const createRoster = () => wrap(async () => {
    if (!branchId) throw new ApiException(400, 'Branch.Missing', 'شعبه‌ای برای این کارواش یافت نشد.');
    await rostersApi.create({ branchId, ...form });
    setCreating(false);
  });

  const submitAssign = (rosterId: string) => wrap(async () => {
    const isAccount = ACCOUNT_ROLES.has(assignForm.role);
    await rostersApi.assign(rosterId, {
      role: assignForm.role,
      workerId: isAccount ? null : assignForm.personId || null,
      userId: isAccount ? assignForm.personId || null : null,
      bayId: assignForm.bayId || null,
    });
    setAssigningTo(null);
    setAssignForm(f => ({ ...f, personId: '', bayId: '' }));
  });

  const shiftWeek = (delta: number) => {
    const d = parseLocalDate(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(iso(d));
  };

  const byDay = useMemo(() => {
    const map = new Map<string, ShiftRosterDto[]>();
    for (const r of rosters) {
      const key = r.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [rosters]);

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = parseLocalDate(weekStart);
      d.setDate(d.getDate() + i);
      out.push(iso(d));
    }
    return out;
  }, [weekStart]);

  const peopleFor = (role: StaffRole) =>
    ACCOUNT_ROLES.has(role)
      ? users.map(u => ({ id: u.id, name: u.displayName }))
      : workers.map(w => ({ id: w.id, name: w.fullName }));

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <PageHeader
        title="برنامه‌ی شیفت"
        subtitle="چه کسی، چه ساعتی، در کدام جایگاه"
        actions={
          <button onClick={() => setCreating(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">
            <Plus size={14} />شیفت جدید
          </button>
        }
      />

      {err && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</div>}

      <Card className="mb-4 p-3">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => shiftWeek(-1)} className="rounded-xl bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100">هفته‌ی قبل</button>
          <span className="text-xs font-bold text-gray-700">
            {toJalaliLabel(weekStart)} تا {toJalaliLabel(weekEnd)}
          </span>
          <button onClick={() => shiftWeek(1)} className="rounded-xl bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100">هفته‌ی بعد</button>
        </div>
      </Card>

      {creating && (
        <Card className="mb-4 border-brand-100 bg-brand-50/40 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <label className="col-span-2 block sm:col-span-1">
              <span className="mb-1 block text-[10px] font-medium text-gray-500">تاریخ</span>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="col-span-2 block sm:col-span-1">
              <span className="mb-1 block text-[10px] font-medium text-gray-500">نام شیفت</span>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-gray-500">شروع</span>
              <input type="time" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-gray-500">پایان</span>
              <input type="time" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" />
            </label>
            <button onClick={createRoster} disabled={busy}
              className="col-span-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-1 sm:self-end">
              {busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'ثبت شیفت'}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            تاریخ میلادی وارد می‌شود؛ معادل شمسی: <b className="text-gray-700">{toJalaliLabel(form.date)}</b>
          </p>
        </Card>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400"><Loader2 className="mx-auto mb-2 animate-spin" size={20} />در حال بارگذاری…</div>
      ) : rosters.length === 0 ? (
        <Card><EmptyState icon={CalendarDays} title="شیفتی برای این هفته ثبت نشده"
          hint="با «شیفت جدید» برنامه‌ی این هفته را بسازید و نفرات هر جایگاه را مشخص کنید." /></Card>
      ) : (
        <div className="space-y-3">
          {days.map(day => {
            const forDay = byDay.get(day) ?? [];
            if (forDay.length === 0) return null;
            return (
              <div key={day}>
                <div className="mb-1.5 px-1 text-[11px] font-bold text-gray-500">{toJalaliLabel(day)}</div>
                <div className="space-y-2">
                  {forDay.map(r => (
                    <Card key={r.id} className="p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <b className="text-sm text-gray-900">{r.name}</b>
                          <span className="mr-2 font-mono text-[11px] text-gray-500">
                            {r.startsAt.slice(0, 5)} — {r.endsAt.slice(0, 5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-600">
                            <Users size={12} />{fa(r.headCount)} نفر
                          </span>
                          <button onClick={() => setAssigningTo(assigningTo === r.id ? null : r.id)}
                            className="rounded-lg bg-brand-50 p-1.5 text-brand-600 hover:bg-brand-100" title="افزودن نفر">
                            <UserPlus size={14} />
                          </button>
                          <button onClick={() => wrap(() => rostersApi.remove(r.id))}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="حذف شیفت">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {assigningTo === r.id && (
                        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-4">
                          <select value={assignForm.role}
                            onChange={e => setAssignForm({ ...assignForm, role: Number(e.target.value) as StaffRole, personId: '' })}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                            {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <select value={assignForm.personId} onChange={e => setAssignForm({ ...assignForm, personId: e.target.value })}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                            <option value="">— انتخاب نفر —</option>
                            {peopleFor(assignForm.role).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={assignForm.bayId} onChange={e => setAssignForm({ ...assignForm, bayId: e.target.value })}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                            <option value="">بدون جایگاه مشخص</option>
                            {bays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          <button onClick={() => submitAssign(r.id)} disabled={busy || !assignForm.personId}
                            className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">افزودن</button>
                        </div>
                      )}

                      {r.assignments.length === 0 ? (
                        <p className="py-3 text-center text-[11px] text-gray-400">هنوز کسی به این شیفت اضافه نشده.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {r.assignments.map(a => (
                            <div key={a.id} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-2">
                              <WorkerAvatar src={resolveUploadUrl(a.workerAvatarUrl)} name={a.workerName ?? a.userName ?? ''} size={30} rounded="xl" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-bold text-gray-900">{a.workerName ?? a.userName ?? '—'}</div>
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                  <span className={clsx('rounded px-1.5 py-0.5 font-bold', ROLE_TONE[a.role])}>{ROLE_LABEL[a.role]}</span>
                                  {a.bayName && <span>{a.bayName}</span>}
                                </div>
                              </div>
                              <button onClick={() => wrap(() => rostersApi.unassign(r.id, a.id))}
                                className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-600">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-gray-50 p-4 text-[11px] leading-6 text-gray-500">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
        <p>
          «کارگر» کسی است که روی خودرو کار می‌کند و لازم نیست حساب کاربری داشته باشد؛ «صندوق‌دار» و «سرشیفت»
          از میان کاربران سامانه انتخاب می‌شوند چون وارد برنامه می‌شوند. این برنامه از شیفت صندوق جداست:
          آن یکی درباره‌ی پول است، این یکی درباره‌ی آدم‌ها.
        </p>
      </div>
    </div>
  );
};
