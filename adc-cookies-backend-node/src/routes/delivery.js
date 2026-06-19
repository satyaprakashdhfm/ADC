import { Router } from 'express';
import { getOne } from '../db.js';
import { ApiError } from '../middleware.js';
import { checkServiceability, expectedTat, delhiveryConfigured } from '../delhivery.js';

const router = Router();

// Origin pincode: prefer default warehouse, fall back to ORIGIN_PINCODE env var.
async function getOriginPin() {
  try {
    const wh = await getOne('SELECT pincode FROM warehouses WHERE is_default = TRUE AND is_active = TRUE LIMIT 1');
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
  if (!/^\d{6}$/.test(pin)) return res.json({ serviceable: false, reason: 'invalid_pincode' });

  if (!delhiveryConfigured()) {
    // When not configured, return a graceful default so checkout still works.
    return res.json({ serviceable: true, reason: 'unconfigured', tat: null, expectedDeliveryDate: null });
  }

  const [svc, tat] = await Promise.all([
    checkServiceability(pin),
    (async () => {
      const origin = await getOriginPin();
      if (!origin) return { ok: false, reason: 'origin_not_set' };
      return expectedTat({ originPin: origin, destinationPin: pin });
    })(),
  ]);

  res.json({
    serviceable: svc.serviceable,
    embargo: svc.embargo || false,
    reason: svc.reason,
    cod: svc.cod,
    pincode: pin,
    tat: tat.ok ? tat.tat : null,
    expectedDeliveryDate: tat.ok ? tat.expectedDeliveryDate : null,
  });
});

export default router;
