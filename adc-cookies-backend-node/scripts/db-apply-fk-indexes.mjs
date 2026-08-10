// Applies drizzle/0001_fk_indexes.sql. CONCURRENTLY cannot run inside a transaction, so each
// statement is issued on its own. Every statement is IF NOT EXISTS, so this is re-runnable.
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log('host:', c.connectionParameters.host);
const stmts = [
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_user_id_idx ON orders (user_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS order_items_order_id_idx ON order_items (order_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS addresses_user_id_idx ON addresses (user_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_order_id_idx ON payments (order_id)',
];
for (const s of stmts) { await c.query(s); console.log('ok:', s.match(/EXISTS (\w+)/)[1]); }
const { rows } = await c.query(`select c.relname, i.indisvalid from pg_index i
  join pg_class c on c.oid=i.indexrelid where c.relname like '%_idx' and c.relname in
  ('orders_user_id_idx','order_items_order_id_idx','addresses_user_id_idx','payments_order_id_idx') order by 1`);
console.log('verified:', rows.map(r => `${r.relname}=${r.indisvalid ? 'valid' : 'INVALID'}`).join(' '));
await c.end();
