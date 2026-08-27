/*
 * The Drizzle client, over the SAME pool as query()/getOne()/getAll().
 *
 * Sharing the pool is not a tidiness preference, it is a hard constraint. We connect through
 * Supabase's SESSION pooler, which caps this backend at roughly 15 client connections and answers
 * EMAXCONNSESSION past that; db/index.js already sets max:10 to stay under it. A second pool for
 * Drizzle would double that and start refusing connections under load — and it would do it first
 * on the busiest path, which is checkout.
 *
 * Sharing it also means the two styles can be mixed safely during the port: a Drizzle read and a
 * raw query() see the same data, the same transaction when one is passed a client, and the same
 * type parsers.
 *
 * ABOUT THOSE PARSERS, because they make Drizzle behave differently here than its docs suggest.
 * db/index.js registers node-postgres parsers globally, and Drizzle uses that same driver:
 *
 *   NUMERIC (1700)     parsed to a JS number. Drizzle TYPES numeric as string, and its own docs say
 *                      to expect a string — but the parser wins at runtime, so money comes back a
 *                      number, exactly as every existing route already expects. Do not "fix" this
 *                      by reading .toString() off it.
 *   TIMESTAMPTZ (1184) parsed to an ISO string, which is why the models say mode: 'string'.
 *   DATE (1082)        left as the raw 'YYYY-MM-DD' string, which coupon expiry comparisons rely on.
 *
 * So a Drizzle row and a raw-SQL row of the same record are the same shape. That is what makes
 * porting one service at a time safe rather than a flag day.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './index.js';
import * as schema from '../models/index.js';

export const db = drizzle(pool, { schema });

/** Run Drizzle work inside an existing node-postgres client (i.e. inside withTransaction). */
export const dbFor = (client) => drizzle(client, { schema });

export { schema };
