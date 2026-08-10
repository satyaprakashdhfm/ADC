// Read-only inspection of whichever database DATABASE_URL points at.
// Run against production with:  railway run --service adc-backend node scripts/db-inspect.mjs
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const one = async (sql) => (await c.query(sql)).rows[0];
const { host } = c.connectionParameters;
console.log('host       :', host);
for (const t of ['orders', 'products', 'users', 'order_items']) {
  const r = await one(`select count(*)::int n from ${t}`);
  console.log(`${t.padEnd(11)}:`, r.n);
}
const idx = await c.query(`
  select c.relname, i.indisvalid from pg_index i join pg_class c on c.oid = i.indexrelid
  where c.relname in ('orders_user_id_idx','order_items_order_id_idx','addresses_user_id_idx','payments_order_id_idx')
  order by 1`);
console.log('fk indexes :', idx.rowCount, idx.rows.map(r => `${r.relname}${r.indisvalid ? '' : '(INVALID)'}`).join(', ') || '(none)');
await c.end();
