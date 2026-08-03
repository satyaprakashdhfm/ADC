import { Router } from 'express';
import { getOne } from '../db.js';
import { ApiError } from '../middleware.js';
import { checkServiceability, expectedTat, delhiveryConfigured } from '../delhivery.js';
// Aliased: delhivery.js already exports a checkServiceability with a different signature.
import { checkServiceability as srServiceability, shiprocketConfigured, SHIPROCKET_ORIGIN } from '../shiprocket.js';
import { nearestStore } from '../shadowfax.js';

const router = Router();

// Shadowfax same-day delivery is paused (unresolved rider-assignment gap — see project notes).
// Intracity now runs on Shiprocket Hyperlocal — Shadowfax is retired, having never assigned a
// rider in any live test. SHIPROCKET_DISABLED is the equivalent kill switch: while true, intracity
// zones report unserviceable rather than promising a delivery we cannot make.
const SHIPROCKET_DISABLED = process.env.SHIPROCKET_DISABLED === 'true';

// Origin pincode: prefer default active warehouse, fall back to any active warehouse, then env var.
async function getOriginPin() {
  try {
    const wh = await getOne(
      'SELECT pincode FROM warehouses WHERE is_active = TRUE ORDER BY is_default DESC, id ASC LIMIT 1'
    );
    if (wh?.pincode) return wh.pincode;
  } catch {}
  return process.env.ORIGIN_PINCODE || '';
}

// GET /api/delivery/serviceability?pincode=560001
router.get('/serviceability', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delivery checks are not configured yet.', 503);
  res.json(await checkServiceability(req.query.pincode));
});

// GET /api/delivery/tat?destination=560001[&origin=500034&mot=S]
router.get('/tat', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delivery checks are not configured yet.', 503);
  const origin = req.query.origin || (await getOriginPin());
  if (!origin) return res.json({ ok: false, reason: 'origin_not_set' });
  res.json(await expectedTat({ originPin: origin, destinationPin: req.query.destination, mot: req.query.mot || 'S' }));
});

// GET /api/delivery/check?pincode=560001
// Combined serviceability + TAT — used by checkout to show delivery info in one call.
router.get('/check', async (req, res) => {
  const pin = String(req.query.pincode || '').replace(/\D/g, '');
  // Optional — when the shopper has picked a saved address we can quote the real hyperlocal rate.
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ?? req.query.long ? Number(req.query.lng ?? req.query.long) : null;
  console.log(`[DELIVERY] HIT /api/delivery/check | pincode=${pin || req.query.pincode || 'MISSING'}${lat && lng ? ` | coords=${lat},${lng}` : ''}`);
  if (!/^\d{6}$/.test(pin)) return res.json({ serviceable: false, reason: 'invalid_pincode' });

  // Delhivery pan-India quote — used both for out-of-town pincodes and as the fallback for an
  // intracity zone whenever same-day can't be quoted, so a store-city pincode is never hard-blocked.
  const delhiveryQuote = async () => {
    if (!delhiveryConfigured()) {
      console.log(`[DELIVERY] check | pin=${pin} | carrier=DELHIVERY | delhivery=unconfigured → serviceable=true`);
      return { serviceable: true, reason: 'unconfigured', carrier: 'DELHIVERY', pincode: pin, tat: null, expectedDeliveryDate: null };
    }
    const origin = await getOriginPin();
    const [svc, tat] = await Promise.all([
      checkServiceability(pin),
      (async () => {
        if (!origin) return { ok: false, reason: 'origin_not_set' };
        return expectedTat({ originPin: origin, destinationPin: pin });
      })(),
    ]);
    console.log(`[DELIVERY] check result | pin=${pin} | carrier=DELHIVERY | serviceable=${svc.serviceable} | reason=${svc.reason} | tat=${tat.ok ? tat.tat : tat.reason}`);
    return {
      serviceable: svc.serviceable, embargo: svc.embargo || false, reason: svc.reason, cod: svc.cod,
      carrier: 'DELHIVERY', pincode: pin, tat: tat.ok ? tat.tat : null, expectedDeliveryDate: tat.ok ? tat.expectedDeliveryDate : null,
    };
  };

  // Intracity first: if the pincode is in a city where we have a store, it ships same-day from the
  // nearest store via the hyperlocal carrier (Shiprocket). We surface that here based on the store
  // zone (robust + instant); the real serviceability is verified at order time.
  const pickup = nearestStore(pin);
  if (pickup) {
    // Same-day is only offered while the hyperlocal carrier is actually live. If it's paused or
    // unconfigured ("down"), we DON'T block the store-city pincode — we quietly fall back to
    // Delhivery so the order still goes through (just not same-day). Availability first.
    const hyperlocalLive = shiprocketConfigured() && !SHIPROCKET_DISABLED;
    if (!hyperlocalLive) {
      console.log(`[DELIVERY] check | pin=${pin} | hyperlocal down → Delhivery fallback (store ${pickup.name})`);
      const d = await delhiveryQuote();
      return res.json({ ...d, store: pickup.name, city: pickup.city });
    }
    /*
     * Quote the REAL rate when we have coordinates for both ends.
     *
     * Hyperlocal pricing is distance-based and spans 5x — Rs 70.80 at 1 km to Rs 356 at 24 km — so a
     * flat fee is wrong almost everywhere. Coordinates are optional at this stage (a shopper may only
     * have typed a pincode), so a failed or coordinate-less quote still reports the zone serviceable
     * and leaves the fee to the configured default; the shipment itself is created later regardless.
     */
    let quotedFee = null, etaHours = null;
    if (lat && lng) {
      try {
        const q = await srServiceability({
          pickupPin: SHIPROCKET_ORIGIN.pin, deliveryPin: pin,
          latFrom: SHIPROCKET_ORIGIN.lat, longFrom: SHIPROCKET_ORIGIN.long, latTo: lat, longTo: lng,
        });
        if (q.serviceable) { quotedFee = q.rate; etaHours = q.couriers?.[0]?.etd_hours ?? null; }
      } catch (e) {
        // A failed quote isn't fatal — the zone is still same-day serviceable; only the live rate is
        // missing, so we leave the fee to the configured default and the shipment is created later.
        console.log(`[DELIVERY] check | pin=${pin} | hyperlocal quote failed (${e?.message || e}) → default fee`);
      }
    }
    console.log(`[DELIVERY] check | pin=${pin} | carrier=SHIPROCKET | intracity from ${pickup.name} | quote=${quotedFee ?? 'default'} | eta=${etaHours ?? '?'}h`);
    return res.json({ serviceable: true, intracity: true, carrier: 'SHIPROCKET', store: pickup.name, city: pickup.city,
      sameDay: true, deliveryFee: quotedFee, etaHours, tat: null, expectedDeliveryDate: null, pincode: pin });
  }

  console.log(`[DELIVERY] check | pin=${pin} | carrier=DELHIVERY | out-of-town`);
  res.json(await delhiveryQuote());
});

export default router;
