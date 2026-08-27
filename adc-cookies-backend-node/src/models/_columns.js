/*
 * Column types that make Drizzle hand back EXACTLY what query()/getOne()/getAll() hand back.
 *
 * Without these the two disagree on the only two types that matter, and disagree silently.
 * db/index.js registers node-postgres parsers globally, but Drizzle does not use them:
 *
 *   - its node-postgres session HARDCODES identity parsers for TIMESTAMPTZ, TIMESTAMP, DATE and
 *     INTERVAL, so a timestamp arrives as raw Postgres text ("2026-06-12 22:13:05.441+05:30")
 *     rather than the ISO string the API has always emitted;
 *   - NUMERIC reaches the pg parser and comes back a number, and then Drizzle's own numeric column
 *     maps it BACK to a string, because Drizzle types numeric as string by default.
 *
 * Measured, not assumed. On the same order row:
 *
 *     raw      subtotal + delivery_fee  =  234
 *     drizzle  subtotal + deliveryFee   =  18549        <- "185" + "49"
 *
 * That is the string-concatenation trap the 0002_money_numeric migration was written to close,
 * reopened by the ORM. It would have gone wrong on totals, at checkout, without throwing.
 *
 * So each type below mirrors one parser in db/index.js, line for line. Keep them in step: if a
 * parser there changes, change it here too, or the two halves of the port drift apart.
 */
import { customType } from 'drizzle-orm/pg-core';

/** NUMERIC -> JS number. Mirrors setTypeParser(1700, parseFloat). */
export const money = customType({
  dataType: (c) => `numeric(${c?.precision ?? 12}, ${c?.scale ?? 2})`,
  fromDriver: (v) => (v === null || v === undefined ? v : Number.parseFloat(v)),
});

/** TIMESTAMPTZ -> ISO string. Mirrors setTypeParser(1184, v => new Date(v).toISOString()). */
export const tstz = customType({
  dataType: () => 'timestamp with time zone',
  fromDriver: (v) => (v === null || v === undefined ? v : new Date(v).toISOString()),
});

/*
 * DATE -> the raw 'YYYY-MM-DD' string, deliberately NOT a Date. Mirrors setTypeParser(1082, v => v).
 * Load-bearing: coupon expiry is compared directly against a 'YYYY-MM-DD' string, and a Date would
 * stringify as "Mon Aug 11 2026 …" and expire coupons a day early.
 */
export const dateOnly = customType({
  dataType: () => 'date',
  fromDriver: (v) => v,
});
