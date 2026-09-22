/*
 * Number formatting for the Traffic tab. Every figure here is shown to someone deciding whether an
 * ad is worth paying for, so "—" means "we do not know" and is never replaced by a zero.
 */

export const num = (n: number | null | undefined) =>
  n == null ? '—' : Math.round(n).toLocaleString('en-IN');

/** Rupees: whole rupees from ₹100 up, paise below it, where they are most of the number. */
export const rupees = (n: number | null | undefined) =>
  n == null ? '—' : `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;

/** part as a share of whole: "4%", or "0.8%" when it is small enough that rounding would hide it. */
export const pct = (part: number, whole: number) => {
  if (!whole) return '—';
  const r = (part / whole) * 100;
  return `${r < 10 && r > 0 ? r.toFixed(1) : Math.round(r)}%`;
};

export const duration = (seconds: number) =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

/** What each one cost: spend ÷ count. Unknown when there is no spend figure or nothing to divide by. */
export const costPer = (spend: number | null | undefined, count: number) =>
  spend == null || !count ? '—' : rupees(spend / count);

/** Return on ad spend: rupees of orders per rupee of spend, e.g. "3.2×". */
export const returnOn = (revenue: number, spend: number | null | undefined) =>
  !spend ? '—' : `${(revenue / spend).toFixed(1)}×`;
