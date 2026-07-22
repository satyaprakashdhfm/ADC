// One-off cleanup: remove the hardcoded demo/seed data from seed.js (order 1 "ADC20260610001"
// and its seed customer "Priya Sharma" / priya@example.com, user id 2) — confirmed via seed.js
// lines 29/130/138 to be fabricated demo content from initial project setup, not a real customer
// or a product of any current-code bug. Zero other real activity found under this user.
import 'dotenv/config';
import { query } from '../src/db.js';

async function main() {
  await query('DELETE FROM payments WHERE order_id = 1');
  await query('DELETE FROM order_tracking WHERE order_id = 1');
  await query('DELETE FROM order_items WHERE order_id = 1');
  await query('DELETE FROM orders WHERE id = 1');
  await query('DELETE FROM cart WHERE user_id = 2');
  await query('DELETE FROM addresses WHERE user_id = 2');
  await query('DELETE FROM users WHERE id = 2');
  console.log('Deleted seed order 1 (ADC20260610001) and seed user 2 (Priya Sharma) + all dependents.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
