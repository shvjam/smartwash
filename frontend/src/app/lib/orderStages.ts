import { BayType, OrderStage } from '../api/types';

/**
 * The journey a car takes through the wash, in the order it takes it.
 *
 * Kept in one place because five screens need to agree on it: the bay board, the order screen,
 * the queue, the archive report and the bottleneck report. When these lived in each screen they
 * drifted, and a stage meant one thing on the board and another in the report.
 */
export const STAGE_ORDER: OrderStage[] = [
  OrderStage.Received,
  OrderStage.QueuedForWash,
  OrderStage.Washing,
  OrderStage.QueuedForDry,
  OrderStage.Drying,
  OrderStage.OptionServices,
  OrderStage.ReadyForPickup,
  OrderStage.Delivered,
];

type StageMeta = {
  label: string;
  /** What pressing the button to enter this stage means, in the operator's words. */
  action: string;
  /** Said on screen, because a bay releasing itself surprises people otherwise. */
  hint?: string;
  tone: string;
  dot: string;
  /** The kind of bay this stage needs, or null when the car is not in one. */
  bay: BayType | null;
  /** True while the car is standing in a line rather than being worked on. */
  queue: boolean;
};

export const STAGE_META: Record<OrderStage, StageMeta> = {
  [OrderStage.Received]: {
    label: 'پذیرش',
    action: 'پذیرش شد',
    hint: 'خودرو در جایگاه پذیرش شده است.',
    tone: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400',
    bay: null, queue: false,
  },
  [OrderStage.QueuedForWash]: {
    label: 'صف شستشو',
    action: 'ارسال به صف شستشو',
    hint: 'نوبت خودرو در صف تعیین می‌شود و به مشتری اعلام می‌شود.',
    tone: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500',
    bay: null, queue: true,
  },
  [OrderStage.Washing]: {
    label: 'در حال شستشو',
    action: 'ورود به جایگاه شستشو',
    hint: 'زمان کار از این لحظه شمرده می‌شود.',
    tone: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500',
    bay: BayType.Wash, queue: false,
  },
  [OrderStage.QueuedForDry]: {
    label: 'صف خشک',
    action: 'پایان شستشو',
    hint: 'جایگاه شستشو همین‌جا آزاد می‌شود و خودرو منتظر جایگاه خشک می‌ماند.',
    tone: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500',
    bay: null, queue: true,
  },
  [OrderStage.Drying]: {
    label: 'خشک‌کردن',
    action: 'ورود به جایگاه خشک',
    hint: 'خودرو وارد جایگاه خشک می‌شود.',
    tone: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500',
    bay: BayType.Dry, queue: false,
  },
  [OrderStage.OptionServices]: {
    label: 'خدمات آپشن',
    action: 'شروع واکس و پولیش',
    hint: 'در همان جایگاه خشک انجام می‌شود، مگر جایگاه دیگری انتخاب کنید.',
    tone: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500',
    bay: BayType.Dry, queue: false,
  },
  [OrderStage.ReadyForPickup]: {
    label: 'آماده تحویل',
    action: 'آماده تحویل',
    hint: 'کار تمام است و جایگاه آزاد می‌شود.',
    tone: 'bg-teal-50 text-teal-700', dot: 'bg-teal-500',
    bay: null, queue: false,
  },
  [OrderStage.Delivered]: {
    label: 'تحویل شد',
    action: 'تحویل به مشتری',
    hint: 'فقط پس از تسویه‌ی کامل ممکن است.',
    tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500',
    bay: null, queue: false,
  },
};

export const BAY_TYPE_LABEL: Record<BayType, string> = {
  [BayType.Wash]: 'شستشو',
  [BayType.Dry]: 'خشک',
  [BayType.Wax]: 'واکس',
  [BayType.Polish]: 'پولیش',
  [BayType.EngineWash]: 'موتورشویی',
  [BayType.Special]: 'ویژه',
};

/** The stage that comes after this one, or null at the end of the journey. */
export const nextStage = (current: OrderStage): OrderStage | null => {
  const i = STAGE_ORDER.indexOf(current);
  return i < 0 || i === STAGE_ORDER.length - 1 ? null : STAGE_ORDER[i + 1];
};

/**
 * The stages a car may move to from here.
 *
 * More than one, because sites differ: a carwash without a drying bay sends a car from washing
 * straight to ready, and offering only the very next step would force it to record two stages
 * that never happened. Everything ahead is offered; nothing behind ever is.
 */
export const forwardStages = (current: OrderStage): OrderStage[] =>
  STAGE_ORDER.filter(s => s > current);

export const stageLabel = (stage: OrderStage) => STAGE_META[stage]?.label ?? '—';
export const stageNeedsBay = (stage: OrderStage) => STAGE_META[stage]?.bay ?? null;
export const stageIsQueue = (stage: OrderStage) => STAGE_META[stage]?.queue ?? false;

/** True once the car has left the wash bay, which happens on the way into the dry queue. */
export const hasLeftWashBay = (stage: OrderStage) => stage >= OrderStage.QueuedForDry;
