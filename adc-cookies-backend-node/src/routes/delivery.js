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

  // Intracity: if the pincode is in a city where we have a store (Bengaluru / Chennai zones), it
  // ALWAYS ships SAME-DAY, ~1 hour, fulfilled from the nearest store — that's the intracity promise,
  // so a store-zone pincode is never dropped to multi-day Delhivery. When the hyperlocal carrier
  // (Shiprocket) is live and we have coordinates, we quote its real rate/ETA; otherwise we promise a
  // store-fulfilled ~1h delivery at the configured intracity fee (the shipment is created at order
  // time, trying the carrier first and falling back to the store's own rider).
  const pickup = nearestStore(pin);
  if (pickup) {
    const hyperlocalLive = shiprocketConfigured() && !SHIPROCKET_DISABLED;
    let quotedFee = null, etaHours = 1, carrier = 'STORE';
    if (hyperlocalLive && lat && lng) {
      try {
        const q = await srServiceability({
          pickupPin: SHIPROCKET_ORIGIN.pin, deliveryPin: pin,
          latFrom: SHIPROCKET_ORIGIN.lat, longFrom: SHIPROCKET_ORIGIN.long, latTo: lat, longTo: lng,
        });
        if (q.serviceable) { quotedFee = q.rate; etaHours = q.couriers?.[0]?.etd_hours ?? 1; carrier = 'SHIPROCKET'; }
      } catch (e) {
        // A failed quote isn't fatal — the zone is still same-day serviceable; only the live rate is
        // missing, so we leave the fee to the configured default and promise store-fulfilled ~1h.
        console.log(`[DELIVERY] check | pin=${pin} | hyperlocal quote failed (${e?.message || e}) → store same-day`);
      }
    }
    console.log(`[DELIVERY] check | pin=${pin} | carrier=${carrier} | SAME-DAY ~${etaHours}h from ${pickup.name} | fee=${quotedFee ?? 'default'}`);
    return res.json({ serviceable: true, intracity: true, sameDay: true, carrier, store: pickup.name, city: pickup.city,
      deliveryFee: quotedFee, etaHours, etaLabel: 'within ~1 hour', tat: null, expectedDeliveryDate: null, pincode: pin });
  }

  console.log(`[DELIVERY] check | pin=${pin} | carrier=DELHIVERY | out-of-town`);
  res.json(await delhiveryQuote());
});

export default router;
