/**
 * Calendar dates as the operator sees them, not as UTC sees them.
 *
 * toISOString().slice(0, 10) gives the UTC day. Iran is ahead of UTC, so local midnight — and
 * anything before 03:30 — is still the previous day there. That put every reservation tab one
 * day behind, and made "today" in a date field read as yesterday for the first hours of a day.
 */
export const localIsoDate = (d: Date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Reads YYYY-MM-DD as local midnight; new Date('YYYY-MM-DD') reads it as UTC midnight. */
export const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Today plus or minus some days, as a local calendar date. */
export const localIsoDateIn = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localIsoDate(d);
};
