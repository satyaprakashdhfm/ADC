import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../../db/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { serializeWarehouse } from '../../serializers/index.js';
import { delhiveryConfigured, createWarehouseOnDelhivery, updateWarehouseOnDelhivery, getShippingCost } from '../../services/delhivery.client.js';
import { ADC_STORES } from '../../services/store.service.js';
import { listPickups, shiprocketConfigured } from '../../services/shiprocket.client.js';

const router = Router();

/* ======================================================================
   Delivery — Warehouses
   ====================================================================== */

/*
 * GET /api/admin/delivery/stores — can each ADC store dispatch a same-day order?
 *
 * What matters is that the store's pickup nickname EXISTS in Shiprocket, because orders are
 * collected from whatever that name resolves to on their side. A missing or misspelt nickname means
 * we would quote a store we cannot collect from.
 *
 * Their `status` field is reported for reference only and is NOT used to gate anything: it reads 2
 * on the primary location and 1 on every other, while their panel shows all of them VERIFIED, and
 * bookings from status=1 locations were accepted in a live test on 2026-08-07.
 */
router.get('/delivery/stores', async (_req, res) => {
  if (!shiprocketConfigured()) {
    return res.json({ configured: false, stores: ADC_STORES.map((s) => ({ ...s, verified: null })), verifiedCount: 0 });
  }
  const { ok, reason, pickups } = await listPickups();
  const byNick = new Map(pickups.map((p): [any, any] => [p.nickname.toLowerCase(), p]));
  const stores = ADC_STORES.map((s) => {
    const nick = String(s.pickupName || '').trim().toLowerCase();
    const p: any = nick ? byNick.get(nick) : null;
    return {
      name: s.name, city: s.city, state: s.state, pincode: s.pincode,
      latitude: s.latitude, longitude: s.longitude,
      pickupName: s.pickupName || null,
      registered: !!p,
      verified: p ? p.verified : false,   // their status===2 — informational only, gates nothing
      isPrimary: p?.isPrimary ?? false,
      phoneVerified: p?.phoneVerified ?? false,
      pickupId: p?.id ?? null,
      contact: p?.contact ?? null,
      // Exactly why this store cannot take an order right now, in the operator's language.
      // Only a genuinely unusable store gets a reason. A status of 1 is normal for every
      // non-primary location and does not stop it being booked.
      blockedReason: !nick ? 'No Shiprocket pickup nickname configured for this store — it cannot be used for same-day.'
        : !p ? `No pickup location named "${s.pickupName}" exists in Shiprocket. Add it in their panel, or correct the nickname.`
        : null,
      usable: !!nick && !!p,
    };
  });
  res.json({
    configured: true, ok, reason: reason ?? null, stores,
    verifiedCount: stores.filter((s) => s.usable).length,
    // Orphans: registered with Shiprocket but not mapped to any store of ours.
    unmappedPickups: pickups.filter((p) => !ADC_STORES.some((s) => String(s.pickupName || '').toLowerCase() === p.nickname.toLowerCase())),
  });
});

router.get('/delivery/warehouses', async (_req, res) => {
  const rows = await getAll('SELECT * FROM warehouses ORDER BY is_default DESC, id ASC');
  res.json(rows.map(serializeWarehouse));
});

router.post('/delivery/warehouses', async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.pickupLocation || !b.pincode) throw new ApiError('name, pickupLocation and pincode are required', 400);

  // Register with Delhivery unless caller says it's already registered there.
  const dhResult = (!b.skipDelhivery && delhiveryConfigured())
    ? await createWarehouseOnDelhivery(b)
    : { ok: true, skipped: true };

  if (b.isDefault) await query('UPDATE warehouses SET is_default = FALSE');

  const row = await getOne(
    `INSERT INTO warehouses (name, registered_name, pickup_location, address_line1, address_line2, city, state, pincode, return_pincode, phone, email, is_active, is_default, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [b.name, b.registeredName || b.name, b.pickupLocation, b.addressLine1 || null, b.addressLine2 || null,
     b.city || null, b.state || null, b.pincode, b.returnPincode || b.pincode,
     b.phone || null, b.email || null, true, !!b.isDefault, nowIso()]
  );
  res.json({ ...serializeWarehouse(row), delhivery: dhResult });
});

router.put('/delivery/warehouses/:id', async (req, res) => {
  const existing = await getOne('SELECT * FROM warehouses WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Warehouse not found', 404);
  const b = req.body || {};

  const dhResult = delhiveryConfigured() ? await updateWarehouseOnDelhivery({ ...b, pickupLocation: existing.pickup_location }) : { ok: false, reason: 'not_configured' };

  const row = await getOne(
    `UPDATE warehouses SET name=$1, registered_name=$2, address_line1=$3, address_line2=$4, city=$5, state=$6, pincode=$7, return_pincode=$8, phone=$9, email=$10
     WHERE id=$11 RETURNING *`,
    [b.name || existing.name, b.registeredName || existing.registered_name,
     b.addressLine1 || null, b.addressLine2 || null, b.city || null, b.state || null,
     b.pincode || existing.pincode, b.returnPincode || existing.return_pincode,
     b.phone || null, b.email || null, req.params.id]
  );
  res.json({ ...serializeWarehouse(row), delhivery: dhResult });
});

router.patch('/delivery/warehouses/:id/default', async (req, res) => {
  const existing = await getOne('SELECT 1 FROM warehouses WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Warehouse not found', 404);
  await query('UPDATE warehouses SET is_default = FALSE');
  await query('UPDATE warehouses SET is_default = TRUE WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.patch('/delivery/warehouses/:id/toggle', async (req, res) => {
  const existing = await getOne('SELECT * FROM warehouses WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Warehouse not found', 404);
  const row = await getOne('UPDATE warehouses SET is_active = $1 WHERE id = $2 RETURNING *', [!existing.is_active, req.params.id]);
  res.json(serializeWarehouse(row));
});

/* ======================================================================
   Delivery — Shipping cost (admin reference; customer always pays ₹100)
   ====================================================================== */

router.get('/delivery/shipping-cost', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const { destPin, weight = '0.5', cod = '0', mode = 'S' } = req.query;
  // Origin from default warehouse, fall back to env
  const wh = await getOne('SELECT pincode FROM warehouses WHERE is_default = TRUE AND is_active = TRUE LIMIT 1');
  const originPin = wh?.pincode || process.env.ORIGIN_PINCODE || '';
  if (!originPin) throw new ApiError('No default warehouse / origin pincode configured', 400);
  if (!destPin) throw new ApiError('destPin is required', 400);
  const result = await getShippingCost({
    originPin: String(originPin ?? ''), destPin: String(destPin ?? ''),
    weight: Number(weight), cod: Number(cod), mode: String(mode ?? 'S'),
  });
  res.json(result);
});

export default router;
