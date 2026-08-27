// Imports from dist/, not src/: the source is TypeScript now, so run `npm run build`
// before this script.
import 'dotenv/config';
const db = await import('../dist/db/index.js');
const rows = await db.getAll('SELECT id, name, pickup_location, city, pincode, is_active, is_default FROM warehouses ORDER BY id');
console.log(rows.length ? JSON.stringify(rows, null, 2) : '(no warehouses in DB)');
await db.pool.end();
