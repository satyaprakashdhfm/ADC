// One-time: normalize existing addresses' city (canonical + Title Case) and state (Title Case),
// so analytics group cleanly without waiting for rows to be re-saved. Idempotent.
// Imports from dist/, not src/: the source is TypeScript now, so run `npm run build`
// before this script.
import 'dotenv/config';
const db = await import('../dist/db/index.js');
const { canonicalCity, titleCase } = await import('../dist/routes/addresses.routes.js');

const rows = await db.getAll('SELECT id, city, state FROM addresses');
let changed = 0;
for (const r of rows) {
  const city = canonicalCity(r.city);
  const state = titleCase(r.state);
  if (city !== (r.city || '') || state !== (r.state || '')) {
    await db.query('UPDATE addresses SET city = $1, state = $2 WHERE id = $3', [city, state, r.id]);
    changed++;
    console.log(`  #${r.id}: "${r.city}" -> "${city}" | "${r.state}" -> "${state}"`);
  }
}
console.log(`\n✓ Normalized ${changed}/${rows.length} addresses.`);
await db.pool.end();
