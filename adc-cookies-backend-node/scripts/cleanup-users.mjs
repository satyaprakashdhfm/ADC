/*
 * One-off DB cleanup (confirmed by owner 2026-07-12):
 *   - DELETE 7 junk/seed accounts (all have 0 orders): ids 1,3,4,5,8,9,12
 *   - NULL the synthetic phone-email on 3 real phone customers: ids 10,15,18
 *   - PROMOTE id 10 (phone 919381502998 = admin phone) to ADMIN
 * Safe: runs in a transaction; aborts if any delete target unexpectedly has orders.
 * Run:  node --env-file=.env scripts/cleanup-users.mjs
 */
import pg from 'pg';

const DEL = [1, 3, 4, 5, 8, 9, 12];
const NULL_EMAIL = [10, 15, 18];
const PROMOTE = 10;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
const client = await pool.connect();
try {
  await client.query('BEGIN');

  const oc = await client.query('SELECT user_id, COUNT(*) c FROM orders WHERE user_id = ANY($1) GROUP BY user_id', [DEL]);
  if (oc.rows.length) throw new Error('ABORT: a delete target has orders: ' + JSON.stringify(oc.rows));

  await client.query('DELETE FROM coupon_usage WHERE user_id = ANY($1)', [DEL]);
  const d = await client.query('DELETE FROM users WHERE id = ANY($1) RETURNING id', [DEL]);
  const n = await client.query('UPDATE users SET email = NULL, updated_at = $2 WHERE id = ANY($1) RETURNING id', [NULL_EMAIL, new Date().toISOString()]);
  const p = await client.query('UPDATE users SET role = $2, updated_at = $3 WHERE id = $1 RETURNING id, phone, role', [PROMOTE, 'ADMIN', new Date().toISOString()]);

  await client.query('COMMIT');
  console.log('deleted users:', d.rows.map((r) => r.id));
  console.log('nulled emails:', n.rows.map((r) => r.id));
  console.log('promoted to ADMIN:', p.rows);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('ROLLED BACK:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
