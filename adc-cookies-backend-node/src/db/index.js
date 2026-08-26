import pg from 'pg';

const { Pool } = pg;

/*
 * How Postgres types come back into JavaScript.
 *
 * These MUST stay in step with the 0002/0003 migrations, and must be registered before any query
 * runs. node-postgres' defaults would otherwise change the shape of values the routes already
 * depend on, silently:
 *
 *   NUMERIC (1700)     default is a STRING, to avoid losing precision on huge values. Our amounts
 *                      are rupees, so a JS number is exact and safe — and leaving it a string would
 *                      turn `subtotal + deliveryFee` into "500" + "40" = "50040". Parsed to number.
 *   TIMESTAMPTZ (1184) default is a JS Date. The API has always emitted strings here, so we keep
 *                      strings — normalised to ISO, which is what most rows already held.
 *   DATE (1082)        default is a JS Date. coupons.js compares expiry_date directly against a
 *                      'YYYY-MM-DD' string in three places; a Date would stringify as
 *                      "Mon Aug 11 2026 ..." and expire coupons a day early. Kept as the raw
 *                      'YYYY-MM-DD' string it has always been.
 */
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number.parseFloat(v)));
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString()));
pg.types.setTypeParser(1082, (v) => v);

// If DATABASE_URL is set (and non-empty) it wins; otherwise node-postgres reads
// PGHOST / PGDATABASE / PGUSER / PGPASSWORD / PGPORT from the environment (.env).
// Remote hosts (e.g. Supabase) require SSL; local Unix-socket auth does not.
// max:10 — we connect through the Supabase SESSION pooler, which caps THIS backend at
// ~15 client connections (exceeding it returns EMAXCONNSESSION). 10 stays safely under that.
// To raise it, switch DATABASE_URL to the TRANSACTION pooler (port 6543), which multiplexes
// connections and removes the per-client session cap.
export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 10 }
    : { max: 10 }
);

export const query  = (sql, p = []) => pool.query(sql, p);
export const getOne = async (sql, p = []) => (await pool.query(sql, p)).rows[0] ?? null;
export const getAll = async (sql, p = []) => (await pool.query(sql, p)).rows;
export const nowIso = () => new Date().toISOString();

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
