import { Router } from 'express';
import { getOne } from '../db.js';
import { ApiError } from '../middleware.js';
import { checkServiceability, expectedTat, delhiveryConfigured } from '../delhivery.js';
import { nearestStore } from '../shadowfax.js';

const router = Router();

// Shadowfax same-day delivery is paused (unresolved rider-assignment gap — see project notes).
// While true, intracity zones are self-pickup from the nearest store instead of home delivery.
// Flip back to false the moment Shadowfax is confirmed reliably assigning riders.
const SHADOWFAX_DISABLED = process.env.SHADOWFAX_DISABLED === 'true';

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
  console.log(`[DELIVERY] HIT /api/delivery/check | pincode=${pin || req.query.pincode || 'MISSING'}`);
  if (!/^\d{6}$/.test(pin)) return res.json({ serviceable: false, reason: 'invalid_pincode' });

  // Intracity first: if the pincode is in a city where we have a store, it ships same-day from the
  // nearest store via Shadowfax. We surface that here based on the store zone (robust + instant);
  // the real Shadowfax serviceability is verified at order time, falling back to Delhivery if needed.
  const pickup = nearestStore(pin);
  if (pickup) {
    if (SHADOWFAX_DISABLED) {
      console.log(`[DELIVERY] check | pin=${pin} | carrier=STORE_PICKUP | Shadowfax paused → collect from ${pickup.name}`);
      return res.json({
        serviceable: true, intracity: true, carrier: 'STORE_PICKUP', store: pickup.name, city: pickup.city,
        sameDay: false, pickupOnly: true,
        maintenanceMessage: `Shadowfax same-day delivery is temporarily under maintenance. Please collect your order from our ${pickup.name} store.`,
        tat: null, expectedDeliveryDate: null, pincode: pin,
      });
    }
    console.log(`[DELIVERY] check | pin=${pin} | carrier=SHADOWFAX | intracity zone → same-day from ${pickup.name}`);
    return res.json({ serviceable: true, intracity: true, carrier: 'SHADOWFAX', store: pickup.name, city: pickup.city, sameDay: true, tat: null, expectedDeliveryDate: null, pincode: pin });
  }

  if (!delhiveryConfigured()) {
    console.log(`[DELIVERY] check | pin=${pin} | carrier=DELHIVERY | delhivery=unconfigured → returning serviceable=true`);
    return res.json({ serviceable: true, reason: 'unconfigured', tat: null, expectedDeliveryDate: null });
  }

  const origin = await getOriginPin();
  console.log(`[DELIVERY] check | pin=${pin} | carrier=DELHIVERY | origin=${origin || 'MISSING'}`);

  const [svc, tat] = await Promise.all([
    checkServiceability(pin),
    (async () => {
      if (!origin) return { ok: false, reason: 'origin_not_set' };
      return expectedTat({ originPin: origin, destinationPin: pin });
    })(),
  ]);

  console.log(`[DELIVERY] check result | pin=${pin} | carrier=DELHIVERY | serviceable=${svc.serviceable} | reason=${svc.reason} | tat=${tat.ok ? tat.tat : tat.reason}`);

  res.json({
    serviceable: svc.serviceable,
    embargo: svc.embargo || false,
    reason: svc.reason,
    cod: svc.cod,
    carrier: 'DELHIVERY',
    pincode: pin,
    tat: tat.ok ? tat.tat : null,
    expectedDeliveryDate: tat.ok ? tat.expectedDeliveryDate : null,
  });
});

export default router;
