/**
 * Money, as the platform stores it and as people read it.
 *
 * The API and the database hold every amount in rials. Everyone who uses the panel thinks and
 * types in tomans. So every amount crosses that line exactly twice: rials → tomans on the way
 * to the screen, tomans → rials on the way back.
 *
 * Each screen used to do this for itself with its own little helper, and about half of them
 * did not do it at all. The same order total read 15,000 تومان on one screen and 150,000 ریال
 * on the next; the public pricing page printed the rial figure with the word "تومان" after
 * it, which made every plan look ten times its price. One place, one rule.
 */

export const RIAL_PER_TOMAN = 10;

/** Rials from the API → tomans for display. */
export const toToman = (rials: number) => Math.round((rials ?? 0) / RIAL_PER_TOMAN);

/** Tomans typed by a person → rials for the API. */
export const toRials = (tomans: number) => Math.round(tomans ?? 0) * RIAL_PER_TOMAN;

/** A rial amount as a Persian-digit toman number, without the unit. */
export const tomanNumber = (rials: number) => toToman(rials).toLocaleString('fa-IR');

/** A rial amount as "۱۵٬۰۰۰ تومان" — the form almost every screen wants. */
export const tomanLabel = (rials: number) => `${tomanNumber(rials)} تومان`;

/**
 * Reads what someone typed into a money field — which may be Persian digits, may carry
 * thousands separators — as a number of tomans. Empty or unreadable input is 0.
 */
export const parseToman = (input: string | number) => {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  const latin = input
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\d.-]/g, '');
  const n = Number(latin);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A rial amount as a price is said aloud — "۱۵ میلیون تومان", "۸۵۰ هزار تومان" — for headlines,
 * where a run of zeros is harder to read than the word for them. Falls back to the full figure
 * whenever the round form would hide part of the price.
 */
export const tomanSpoken = (rials: number) => {
  const t = toToman(rials);
  if (t >= 1_000_000 && t % 100_000 === 0) return `${(t / 1_000_000).toLocaleString('fa-IR')} میلیون تومان`;
  if (t >= 1_000 && t % 1_000 === 0) return `${(t / 1_000).toLocaleString('fa-IR')} هزار تومان`;
  return tomanLabel(rials);
};
