import 'dotenv/config';
const db = await import('../src/db.js');
const rows = await db.getAll('SELECT id, name, pickup_location, city, pincode, is_active, is_default FROM warehouses ORDER BY id');
console.log(rows.length ? JSON.stringify(rows, null, 2) : '(no warehouses in DB)');
await db.pool.end();
