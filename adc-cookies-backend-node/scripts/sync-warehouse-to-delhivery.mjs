// Register the active default DB warehouse on the currently-configured Delhivery env
// (staging or production, per .env). Safe to re-run; "already exists" is treated as OK.
import 'dotenv/config';
const dh = await import('../src/delhivery.js');
const db = await import('../src/db.js');

const wh = await db.getOne('SELECT * FROM warehouses WHERE is_active = TRUE ORDER BY is_default DESC, id ASC LIMIT 1');
if (!wh) { console.error('No active warehouse in DB.'); await db.pool.end(); process.exit(1); }

console.log(`\nRegistering "${wh.pickup_location}" on ${dh.delhiveryBaseUrl()} ...`);
const r = await dh.createWarehouseOnDelhivery({
  name: wh.name, pickupLocation: wh.pickup_location, registeredName: wh.registered_name || wh.name,
  addressLine1: wh.address_line1, addressLine2: wh.address_line2, city: wh.city, state: wh.state,
  pincode: wh.pincode, returnPincode: wh.return_pincode || wh.pincode, phone: wh.phone, email: wh.email,
});

if (r.ok) console.log(`✅ Registered "${wh.pickup_location}".`);
else {
  const msg = JSON.stringify(r.detail || r.reason);
  const exists = /exist|already/i.test(msg);
  console.log(exists ? `✅ "${wh.pickup_location}" already exists on Delhivery — OK.` : `❌ Failed: ${msg.slice(0, 300)}`);
}
await db.pool.end();
