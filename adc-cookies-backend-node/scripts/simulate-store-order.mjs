/*
 * Put a fake PAID order on a store's board, so the portal's new-order alert can be seen without
 * taking a payment.
 *
 * It writes rows directly and calls nothing else. That is the point: no Razorpay, no Petpooja
 * relay, no courier booking. Those all hang off the real checkout path, and none of it runs here —
 * so this cannot bill anyone, cannot put a ticket in a kitchen, and cannot call a rider.
 *
 * The order is marked PAID and left unaccepted, which is exactly the state the portal alerts on.
 * Have /store/<code> open BEFORE running this: the first load records what is already waiting so
 * staff aren't alarmed by hours-old orders, and the alert fires on the next poll (~15s).
 *
 * Usage, with the target environment's DATABASE_URL injected:
 *   railway run -s "adc-backend Copy" -- node scripts/simulate-store-order.mjs [store] [--cleanup]
 *
 * Everything it creates is named SIM-… so --cleanup can find and remove all of it.
 */
import pg from 'pg';

const STORE = (process.argv.find((a) => !a.startsWith('-') && !a.includes('/') && !a.includes('\\') && a !== process.argv[0] && a !== process.argv[1]) || 'jayanagar').toLowerCase();
const CLEANUP = process.argv.includes('--cleanup');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const q = async (s, p = []) => (await pool.query(s, p)).rows;
const one = async (s, p = []) => (await q(s, p))[0] ?? null;
const nowIso = () => new Date().toISOString();

const SIM_EMAIL = 'store-portal-simulation@adoughcookie.test';

if (CLEANUP) {
  const orders = await q("SELECT id FROM orders WHERE order_number LIKE 'SIM-%'");
  const ids = orders.map((o) => o.id);
  if (ids.length) {
    // order_items / order_tracking / payments cascade on order delete, but be explicit about the
    // ones that don't, so a rerun can't trip over a leftover row.
    await q('DELETE FROM order_tracking WHERE order_id = ANY($1)', [ids]);
    await q('DELETE FROM order_items WHERE order_id = ANY($1)', [ids]);
    await q('DELETE FROM orders WHERE id = ANY($1)', [ids]);
  }
  const user = await one('SELECT id FROM users WHERE email = $1', [SIM_EMAIL]);
  if (user) {
    await q('DELETE FROM addresses WHERE user_id = $1', [user.id]);
    await q('DELETE FROM users WHERE id = $1', [user.id]);
  }
  console.log(`Removed ${ids.length} simulated order(s) and the simulation account.`);
  await pool.end();
  process.exit(0);
}

const ts = nowIso();

// A dedicated account, so nothing here is ever confused with a real customer.
let user = await one('SELECT * FROM users WHERE email = $1', [SIM_EMAIL]);
if (!user) {
  user = await one(
    `INSERT INTO users (name, email, phone, password, role, created_at, updated_at)
     VALUES ($1,$2,$3,'simulation',$4,$5,$5) RETURNING *`,
    ['Simulated Order (test)', SIM_EMAIL, null, 'CUSTOMER', ts]
  );
}

// Coordinates matter: the portal shows them, and a real intracity order cannot be quoted without
// them. These sit near the Jayanagar shop.
let address = await one('SELECT * FROM addresses WHERE user_id = $1 LIMIT 1', [user.id]);
if (!address) {
  address = await one(
    `INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, pincode, latitude, longitude, is_default, label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,'Home') RETURNING *`,
    [user.id, 'Test Customer', '9000000000', '12, 4th Block, Jayanagar', 'Near the park',
     'Bengaluru', 'Karnataka', '560041', 12.9250, 77.5938]
  );
}

const products = await q('SELECT id, name, price FROM products WHERE is_available = TRUE ORDER BY id LIMIT 3');
if (!products.length) { console.error('No products in this database — nothing to put on the order.'); process.exit(1); }

const lines = products.map((p, i) => ({ ...p, quantity: i === 0 ? 2 : 1 }));
const subtotal = lines.reduce((s, l) => s + Number(l.price) * l.quantity, 0);

const orderNumber = `SIM-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const order = await one(
  `INSERT INTO orders
     (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount,
      total_amount, coupon_code, payment_status, order_status, shipment_status, label_generated,
      store_code, created_at, updated_at)
   VALUES ($1,$2,$3,$4,0,0,0,$5,NULL,'PAID','CONFIRMED','NOT_CREATED',FALSE,$6,$7,$7) RETURNING *`,
  [orderNumber, user.id, address.id, subtotal, subtotal, STORE, ts]
);

for (const l of lines) {
  await q(
    `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes)
     VALUES ($1,$2,$3,$4,$5,$6,NULL,$7)`,
    [order.id, l.id, l.name, l.quantity, l.price, Number(l.price) * l.quantity,
     l === lines[0] ? 'Simulated order — please do not bake' : null]
  );
}
await q('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
  [order.id, 'CONFIRMED', 'Simulated order created for a store-portal test — no payment was taken', ts]);

console.log(`Created ${orderNumber} for "${STORE}" — ₹${subtotal}`);
for (const l of lines) console.log(`   ${l.quantity} x ${l.name}`);
console.log(`\nIt should appear on /store/${STORE} within ~15 seconds, with the alert and the chime.`);
console.log('Remove it afterwards with:  --cleanup');

await pool.end();
