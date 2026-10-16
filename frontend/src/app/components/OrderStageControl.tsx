import React, { useState } from 'react';
import { ArrowLeft, Check, Loader2, Lock, MapPin, MoveRight } from 'lucide-react';
import clsx from 'clsx';
import { BayStatus, BayType, OrderStage, type BayDto } from '../api/types';
import { STAGE_META, BAY_TYPE_LABEL } from '../lib/orderStages';

const fmtToman = (rials: number) => Math.round(rials / 10).toLocaleString('fa-IR');
const fa = (n: number) => n.toLocaleString('fa-IR');
const time = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : null;

/** The kinds of bay a car may be moved into for a stage; mirrors the server. */
const MOVE_TO: Partial<Record<OrderStage, BayType[]>> = {
  [OrderStage.Washing]: [BayType.Wash, BayType.EngineWash, BayType.Special],
  [OrderStage.Drying]: [BayType.Dry],
  [OrderStage.OptionServices]: [BayType.Dry, BayType.Wax, BayType.Polish, BayType.Special],
};
const IN_BAY = (s: OrderStage) => s === OrderStage.Washing || s === OrderStage.Drying || s === OrderStage.OptionServices;

/** The step each stage normally leads to. */
const NEXT: Partial<Record<OrderStage, OrderStage>> = {
  [OrderStage.Received]: OrderStage.Washing,
  [OrderStage.QueuedForWash]: OrderStage.Washing,
  [OrderStage.Washing]: OrderStage.Drying,
  [OrderStage.QueuedForDry]: OrderStage.Drying,
  [OrderStage.Drying]: OrderStage.ReadyForPickup,
  [OrderStage.OptionServices]: OrderStage.ReadyForPickup,
  [OrderStage.ReadyForPickup]: OrderStage.Delivered,
};

type Step = { stage: OrderStage; move?: boolean };

/**
 * Where this car is, and how to move it on.
 *
 * There are two ways into the carwash and only one of them waits:
 *
 * - A car booked onto a free bay is in that bay from the start. Reception, washing, drying and
 *   extras all happen there, so none of those steps asks for a bay and none puts the car in a
 *   queue. Moving it to a drying bay is offered, never required.
 * - A reservation that arrived while every wash bay was busy waits in the wash queue with no
 *   bay. Its one step is into a bay, picked automatically when only one is free.
 *
 * Handing the car back stays locked while money is owed, and says so, rather than failing
 * after it is pressed.
 *
 * Text that changes sits in its own element: extensions that rewrite page text break React
 * when it has to swap a bare text node they have wrapped.
 */
export const OrderStageControl = ({
  stage,
  outstandingRials,
  queuePosition,
  currentBayId,
  bays,
  stageTimes,
  onAdvance,
  disabled,
  lineCount,
}: {
  stage: OrderStage;
  outstandingRials: number;
  queuePosition?: number | null;
  /** The bay the car is standing in now, if any. */
  currentBayId?: string | null;
  bays?: BayDto[];
  stageTimes?: Partial<Record<OrderStage, string>>;
  onAdvance: (next: OrderStage, bayId?: string | null) => Promise<unknown>;
  disabled?: boolean;
  /** Services on the order; a car with none cannot be handed back. */
  lineCount?: number;
}) => {
  const [busy, setBusy] = useState<OrderStage | null>(null);
  const [picking, setPicking] = useState<OrderStage | null>(null);

  const holding = bays?.find(b => b.id === currentBayId) ?? null;
  const inBay = !!currentBayId;

  /** Free bays of the right kind for a stage, not counting the one the car is in. */
  const freeFor = (s: OrderStage): BayDto[] =>
    (bays ?? []).filter(b =>
      (MOVE_TO[s] ?? []).includes(b.type) && b.isActive
      && b.status === BayStatus.Free && b.id !== currentBayId);

  // Queue stages are only drawn for a car that actually waited in one.
  const shown = [
    OrderStage.Received,
    ...(stage === OrderStage.QueuedForWash || stageTimes?.[OrderStage.QueuedForWash] ? [OrderStage.QueuedForWash] : []),
    OrderStage.Washing,
    ...(stage === OrderStage.QueuedForDry || stageTimes?.[OrderStage.QueuedForDry] ? [OrderStage.QueuedForDry] : []),
    OrderStage.Drying,
    OrderStage.OptionServices,
    OrderStage.ReadyForPickup,
    OrderStage.Delivered,
  ];

  const recommended = NEXT[stage] ?? null;

  const alternatives: Step[] = [];
  // A car waiting in the queue has one way on: into a bay.
  if (recommended !== null && stage !== OrderStage.QueuedForWash) {
    for (const s of [OrderStage.Drying, OrderStage.OptionServices, OrderStage.ReadyForPickup, OrderStage.Delivered]) {
      if (s > stage && s !== recommended && (inBay || !IN_BAY(s))) alternatives.push({ stage: s });
    }
    // Sites with drying bays can send the car there and free its wash bay.
    if (inBay && stage < OrderStage.Drying && freeFor(OrderStage.Drying).length > 0)
      alternatives.push({ stage: OrderStage.Drying, move: true });
  }

  const noServices = lineCount === 0;
  const blockedByDebt = (s: OrderStage) => s === OrderStage.Delivered && (outstandingRials > 0 || noServices);
  // A car waiting for a bay cannot start until one is free.
  const noBayYet = (s: OrderStage) => IN_BAY(s) && !inBay && freeFor(s).length === 0;

  const go = async (s: OrderStage, bayId: string | null) => {
    if (busy !== null) return;
    setBusy(s);
    try {
      await onAdvance(s, bayId);
      setPicking(null);
    } finally {
      setBusy(null);
    }
  };

  const start = ({ stage: s, move }: Step) => {
    if (!IN_BAY(s)) return go(s, null);
    // In a bay and not being moved: the step happens right there. The server does the same.
    if (inBay && !move) return go(s, null);
    const options = freeFor(s);
    if (options.length === 1) return go(s, options[0].id);
    setPicking(s);
    return undefined;
  };

  const actionLabel = (s: OrderStage) => {
    if (s === OrderStage.Washing) return inBay ? 'شروع شستشو' : 'ورود به جایگاه شستشو';
    if (s === OrderStage.Drying) return stage === OrderStage.Washing ? 'پایان شستشو، شروع خشک‌کردن' : 'شروع خشک‌کردن';
    return STAGE_META[s].action;
  };

  const hintFor = (s: OrderStage) => {
    if (s === OrderStage.Delivered && noServices) return 'هنوز خدمتی ثبت نشده؛ ابتدا خدمت اضافه کنید.';
    if (blockedByDebt(s)) return `مانده‌ی ${fmtToman(outstandingRials)} تومان باید پرداخت شود. از بخش پرداخت تسویه کنید.`;
    if (IN_BAY(s) && inBay) return holding ? `در ${holding.name} انجام می‌شود.` : 'در همین جایگاه انجام می‌شود.';
    if (IN_BAY(s)) {
      const free = freeFor(s);
      const kind = (MOVE_TO[s] ?? []).filter(t => (bays ?? []).some(b => b.type === t)).map(t => BAY_TYPE_LABEL[t]).join(' یا ') || 'مناسب';
      if (free.length === 0) return `جایگاه ${kind} آزادی نیست؛ خودرو در صف می‌ماند تا یکی آزاد شود.`;
      if (free.length === 1) return `خودرو به ${free[0].name} می‌رود.`;
      return `یکی از ${fa(free.length)} جایگاه ${kind} آزاد را انتخاب می‌کنید.`;
    }
    if (holding && s === OrderStage.ReadyForPickup) return `${holding.name} آزاد می‌شود.`;
    return STAGE_META[s].hint ?? '';
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4" translate="no">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-gray-500">مسیر خودرو</span>
        <span className="flex items-center gap-1.5">
          {holding && (
            <span key="bay" className="flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-700">
              <MapPin size={11} /><span>{holding.name}</span>
            </span>
          )}
          {queuePosition ? (
            <span key="queue" className="rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700">
              <span>نفر {fa(queuePosition)} در صف</span>
            </span>
          ) : null}
        </span>
      </div>

      <ol className="mb-4 flex items-center gap-0.5">
        {shown.map((s, i) => {
          const done = s < stage;
          const current = s === stage;
          const at = time(stageTimes?.[s]);
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                <span className={clsx('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done || current ? 'bg-brand-400' : 'bg-gray-200')} />
                <span className={clsx('grid size-5 flex-shrink-0 place-items-center rounded-full text-[9px] font-bold',
                  current ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                    : done ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400')}>
                  {done ? <Check key="done" size={10} /> : <span key="n">{i + 1}</span>}
                </span>
                <span className={clsx('h-0.5 flex-1', i === shown.length - 1 ? 'bg-transparent' : done ? 'bg-brand-400' : 'bg-gray-200')} />
              </div>
              <span className={clsx('truncate text-center text-[9px] leading-tight', current ? 'font-bold text-gray-900' : 'text-gray-400')}>
                {STAGE_META[s].label}
              </span>
              <span className="font-mono text-[8px] text-gray-300">{at ?? '—'}</span>
            </li>
          );
        })}
      </ol>

      {picking !== null ? (
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
            <MapPin size={13} />
            <span>{STAGE_META[picking].label} در کدام جایگاه؟</span>
          </div>
          {freeFor(picking).length === 0 ? (
            <p className="text-[11px] leading-5 text-amber-700">{hintFor(picking)}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {freeFor(picking).map(b => (
                <button key={b.id} onClick={() => go(picking, b.id)} disabled={busy !== null}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50">
                  {busy === picking ? <Loader2 key="spin" size={12} className="animate-spin" /> : <MapPin key="pin" size={12} />}
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setPicking(null)} disabled={busy !== null}
            className="mt-2 text-[11px] font-bold text-gray-500 hover:text-gray-700">انصراف</button>
        </div>
      ) : recommended !== null ? (
        <>
          <button
            onClick={() => start({ stage: recommended })}
            disabled={busy !== null || disabled || blockedByDebt(recommended) || noBayYet(recommended)}
            className={clsx('flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors',
              blockedByDebt(recommended) || noBayYet(recommended) ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60')}>
            {busy === recommended ? <Loader2 key="spin" size={15} className="animate-spin" />
              : blockedByDebt(recommended) ? <Lock key="lock" size={15} /> : <ArrowLeft key="go" size={15} />}
            <span>{busy === recommended ? 'در حال ثبت…' : blockedByDebt(recommended) ? (noServices ? 'ابتدا خدمت اضافه کنید' : 'ابتدا تسویه کنید') : actionLabel(recommended)}</span>
          </button>

          <p className="mt-2 text-center text-[11px] leading-5 text-gray-500"><span>{hintFor(recommended)}</span></p>

          {alternatives.length > 0 && (
            <div className="mt-3 border-t border-gray-50 pt-2.5">
              <div className="mb-1.5 text-[10px] text-gray-400">یا:</div>
              <div className="flex flex-wrap gap-1.5">
                {alternatives.map(a => (
                  <button key={`${a.stage}-${a.move ? 'm' : 's'}`} onClick={() => start(a)}
                    disabled={busy !== null || disabled || blockedByDebt(a.stage)}
                    title={a.move ? 'خودرو به جایگاه خشک می‌رود و این جایگاه آزاد می‌شود.' : hintFor(a.stage)}
                    className="flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">
                    {busy === a.stage ? <Loader2 key="spin" size={11} className="animate-spin" />
                      : a.move ? <MoveRight key="move" size={11} /> : null}
                    <span>{a.move ? 'انتقال به جایگاه خشک' : STAGE_META[a.stage].label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-xs font-bold text-emerald-700">
          <span>خودرو تحویل داده شده است.</span>
        </div>
      )}
    </div>
  );
};
