const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

/**
 * Keeps form values API-safe when a Persian/Arabic keypad is used. Display-only
 * values are formatted separately with the fa-IR locale.
 */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

/**
 * The Jalali rendering of an ISO date (yyyy-mm-dd), for showing beside a native date input.
 *
 * The browser's date picker is Gregorian and cannot be changed, so a form that only shows
 * "2026-09-01" leaves the person converting in their head and second-guessing what they
 * picked. Echoing the Jalali date under the field removes that doubt without replacing the
 * picker.
 */
export function toJalaliLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric', month: 'long', day: 'numeric', calendar: 'persian',
  }).format(d);
}

const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/**
 * The Jalali year and month a date falls in, as a sortable key ("1405-07") and a label ("مهر").
 *
 * Monthly reports used to group by the Gregorian month and then print a Persian name beside
 * it, January as دی and so on — but Gregorian and Jalali months do not line up: دی ends on
 * the twentieth of January. So two-thirds of every bar was filed under the wrong month name.
 */
export function jalaliMonth(date: string | Date): { key: string; label: string; year: number; month: number } {
  const d = typeof date === 'string' ? new Date(date.length === 10 ? `${date}T12:00:00` : date) : date;
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric' }).formatToParts(d);
  const year = Number(parts.find(p => p.type === 'year')?.value ?? 0);
  const month = Number(parts.find(p => p.type === 'month')?.value ?? 1);
  return { key: `${year}-${String(month).padStart(2, '0')}`, label: JALALI_MONTHS[month - 1] ?? '', year, month };
}
