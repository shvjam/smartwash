import type { TicketCategory, TicketEventDto, TicketPriority, TicketStatus } from '../api';

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  0: 'جدید',
  1: 'در حال بررسی',
  2: 'در انتظار پاسخ مشتری',
  3: 'حل‌شده',
  4: 'بسته‌شده',
  5: 'لغوشده',
};

export const TICKET_STATUS_CLASS: Record<TicketStatus, string> = {
  0: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  1: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  2: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  4: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  5: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  0: 'کم',
  1: 'عادی',
  2: 'زیاد',
  3: 'فوری',
};

export const TICKET_PRIORITY_CLASS: Record<TicketPriority, string> = {
  0: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  1: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  2: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  3: 'bg-red-600 text-white',
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  0: 'فنی',
  1: 'مالی و صورتحساب',
  2: 'پیامک',
  3: 'درخواست قابلیت',
  4: 'آموزش',
  5: 'گزارش خطا',
  99: 'سایر',
};

export const TICKET_STATUSES: TicketStatus[] = [0, 1, 2, 3, 4, 5];
export const TICKET_PRIORITIES: TicketPriority[] = [0, 1, 2, 3];
export const TICKET_CATEGORIES: TicketCategory[] = [0, 1, 2, 3, 4, 5, 99];

/** وضعیت‌هایی که تیکت در آن‌ها همچنان در جریان است. */
export const isTicketOpen = (status: TicketStatus) => status === 0 || status === 1 || status === 2;

const faNum = new Intl.NumberFormat('fa-IR');
export const fa = (n: number) => faNum.format(n);

const dateTimeFmt = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? dateTimeFmt.format(new Date(iso)) : '—';
export const formatDate = (iso: string | null | undefined) =>
  iso ? dateFmt.format(new Date(iso)) : '—';

/** فاصله‌ی زمانی خوانا نسبت به اکنون، برای «آخرین پیام». */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${fa(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${fa(days)} روز پیش`;
  return formatDate(iso);
}

/** مهلت باقی‌مانده تا نقض SLA؛ منفی بودن یعنی مهلت گذشته است. */
export function formatSlaRemaining(dueAtUtc: string, breached: boolean): string {
  if (breached) return 'مهلت پاسخ گذشته';
  const diffMs = new Date(dueAtUtc).getTime() - Date.now();
  if (diffMs <= 0) return 'مهلت پاسخ گذشته';
  const hours = Math.floor(diffMs / 3600000);
  if (hours >= 24) return `${fa(Math.floor(hours / 24))} روز تا مهلت پاسخ`;
  if (hours >= 1) return `${fa(hours)} ساعت تا مهلت پاسخ`;
  return `${fa(Math.max(1, Math.round(diffMs / 60000)))} دقیقه تا مهلت پاسخ`;
}

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${fa(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${fa(Math.round(bytes / 1024))} کیلوبایت`;
  return `${fa(Math.round((bytes / 1048576) * 10) / 10)} مگابایت`;
};

const STATUS_BY_NAME: Record<string, string> = {
  New: 'جدید', InProgress: 'در حال بررسی', AwaitingCustomer: 'در انتظار پاسخ مشتری',
  Resolved: 'حل‌شده', Closed: 'بسته‌شده', Cancelled: 'لغوشده',
  Low: 'کم', Normal: 'عادی', High: 'زیاد', Urgent: 'فوری',
  Technical: 'فنی', Billing: 'مالی و صورتحساب', Sms: 'پیامک', FeatureRequest: 'درخواست قابلیت',
  Training: 'آموزش', Bug: 'گزارش خطا', Other: 'سایر',
};

/** رخدادهای تاریخچه از نام enum بک‌اند به متن فارسی ترجمه می‌شوند. */
export function describeTicketEvent(e: TicketEventDto): string {
  const from = e.fromValue ? STATUS_BY_NAME[e.fromValue] ?? e.fromValue : null;
  const to = e.toValue ? STATUS_BY_NAME[e.toValue] ?? e.toValue : null;
  switch (e.type) {
    case 0: return `تیکت ${to ?? ''} ایجاد شد`;
    case 1: return e.note ? `پیام جدید (${e.note})` : 'پیام جدید ثبت شد';
    case 2: return `وضعیت از ${from ?? '—'} به ${to ?? '—'} تغییر کرد`;
    case 3: return `اولویت از ${from ?? '—'} به ${to ?? '—'} تغییر کرد`;
    case 4: return `دسته‌بندی از ${from ?? '—'} به ${to ?? '—'} تغییر کرد`;
    case 5: return `مسئول تیکت: ${to ?? '—'}`;
    case 6: return 'تیکت حل‌شده اعلام شد';
    case 7: return 'تیکت بسته شد';
    case 8: return 'تیکت بازگشایی شد';
    case 9: return `امتیاز رضایت ثبت شد: ${to ? fa(Number(to)) : '—'} از ۵`;
    case 10: return 'پیوست اضافه شد';
    default: return 'رخداد';
  }
}
