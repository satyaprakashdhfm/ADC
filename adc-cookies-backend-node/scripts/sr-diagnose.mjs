/*
 * Which of our stores can Shiprocket actually dispatch from, and why not?
 *
 * Run: railway run --service <svc> node scripts/sr-diagnose.mjs [dropPin] [dropLat] [dropLng]
 *
 * Established 2026-08-11: serviceability is decided by the PICKUP PINCODE, not by the pickup
 * location, its verification state or its coordinates. Swapping coordinates between two stores
 * changes only the distance/price; swapping the pincode flips serviceable on/off. Only 560114
 * (Begur) and 600090 (Besant Nagar) had hyperlocal coverage — so every Bengaluru order routed
 * through Begur and paid for the longer distance.
 *
 * Note their Quick dashboard (quick.shiprocket.in) quotes routes this API rejects, e.g. pickup
 * 560100 -> drop 560087. That is a different product from /courier/serviceability's
 * is_new_hyperlocal, not a bug in our call. Re-run this after Shiprocket change anything.
 */
// Imports from dist/, not src/: the source is TypeScript now, so run `npm run build`
// before this script.
import { listPickups, checkServiceability } from '../dist/services/shiprocket.client.js';
import { ADC_STORES } from '../dist/services/store.service.js';

const [, , dropPin, dropLat, dropLng] = process.argv;

console.log('--- pickup locations as Shiprocket reports them ---');
const r = await listPickups();
for (const p of (r.pickups || [])) {
  console.log(`  ${String(p.nickname).padEnd(11)} pin=${String(p.pincode).padEnd(7)} verified=${p.verified} status=${p.status} primary=${p.isPrimary}`);
}

const probe = async (label, s, pin, lat, lng) => {
  const q = await checkServiceability({
    pickupPin: String(s.pincode), deliveryPin: String(pin),
    latFrom: s.latitude, longFrom: s.longitude, latTo: lat, longTo: lng,
  });
  console.log(`  ${String(s.pickupName || s.code).padEnd(11)} pin=${String(s.pincode).padEnd(7)} ${q.serviceable ? `OK  Rs${q.rate}  ${q.couriers?.[0]?.distance ?? '?'}km` : 'NO COURIERS'}   ${label}`);
};

console.log('\n--- can each store serve its OWN pincode? ---');
for (const s of ADC_STORES) {
  if (s.latitude == null) { console.log(`  ${(s.pickupName||s.code).padEnd(11)} no coordinates configured`); continue; }
  await probe('(self)', s, s.pincode, s.latitude, s.longitude);
}

if (dropPin && dropLat && dropLng) {
  console.log(`\n--- can each store serve ${dropPin}? ---`);
  for (const s of ADC_STORES) {
    if (s.latitude == null) continue;
    await probe(`-> ${dropPin}`, s, dropPin, dropLat, dropLng);
  }
}
