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
