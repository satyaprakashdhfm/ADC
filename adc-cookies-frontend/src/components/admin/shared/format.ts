export const money = (v: number) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

/*
 * "Today" and "N days ago" in IST, not UTC.
 *
 * toISOString() is UTC, and the shop trades in Asia/Kolkata — the analytics endpoint groups every
 * row by (created_at AT TIME ZONE 'Asia/Kolkata')::date. A UTC date here therefore asks for a
 * different day than the one the data is filed under, and it broke the range filter three ways:
 *
 *   - Between midnight and 05:30 IST, toISOString() returns YESTERDAY. Today's orders were missing
 *     from every chart, and `max` on the "to" input made today impossible to even select.
 *   - The 7/30/90-day buttons compare range.to against todayStr() to decide which is active. With
 *     the two disagreeing, none of them ever highlighted — the filter looked like it did nothing.
 *   - A range ending "today" silently ended a day early for five and a half hours out of every
 *     twenty-four, which is the worst kind of wrong: right most of the day.
 *
 * A fixed +05:30 is safe because India has no daylight saving. Shifting the clock and THEN taking
 * the UTC date is the trick: it yields the calendar date as an observer in IST would name it.
 */
const IST_OFFSET_MS = 5.5 * 3600_000;
const istDay = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

export const todayStr = () => istDay(Date.now());
export const daysAgoStr = (n: number) => istDay(Date.now() - n * 864e5);

/**
 * A date on its own. For values that genuinely have no time — a coupon's expiry day — where a
 * "12:00 am" would be invented precision rather than information.
 */
export const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * A timestamp, with the time.
 *
 * Everything in the dashboard that records WHEN something happened — an order arriving, a payment
 * landing, a status changing, a menu push — is a moment, not a day. Showing only the date left no
 * way to tell an order placed at breakfast from one placed at closing, or to see how long a status
 * sat before it moved, which is most of what the timeline is read for.
 *
 * Rendered in the browser's own timezone, which for this shop's staff is IST. Deliberately not
 * pinned to Asia/Kolkata: if somebody opens the dashboard from elsewhere, the honest answer is the
 * time on the clock in front of them, and everything shown alongside it follows the same rule.
 */
export const fmtDateTime = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
};
