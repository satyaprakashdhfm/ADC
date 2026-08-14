import { Router } from 'express';
import { getOne, query } from '../../db.js';
import { ApiError } from '../../middleware.js';

const router = Router();

/* ---------- Site settings (homepage promo popup target + header banner offer) ---------- */
router.get('/settings', async (_req, res) => {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'promo_product_id'");
  const offer = await getOne("SELECT value FROM site_settings WHERE key = 'header_offer'");
  const stall = await getOne("SELECT value FROM site_settings WHERE key = 'stall_info'");
  const outstationFee = await getOne("SELECT value FROM site_settings WHERE key = 'delivery_fee_outstation'");
  const paused = await getOne("SELECT value FROM site_settings WHERE key = 'ordering_paused'");
  res.json({
    promoProductId: row?.value ? Number(row.value) : null, headerOffer: offer?.value || null, stallInfo: stall?.value || null,
    orderingPaused: paused?.value || null,
    // Intracity is never a flat setting — it's Shiprocket's own live per-order quote (see
    // orders.js/delivery.js). Only outstation is a single admin-set number.
    deliveryFeeOutstation: outstationFee?.value != null ? Number(outstationFee.value) : 100,
  });
});
router.put('/settings', async (req, res) => {
  if (req.body?.promoProductId !== undefined) {
    const raw = req.body.promoProductId;
    const val = raw == null || raw === '' ? null : String(Number(raw));
    if (val === null || Number.isNaN(Number(val))) {
      await query("DELETE FROM site_settings WHERE key = 'promo_product_id'");
    } else {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('promo_product_id', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [val]
      );
    }
  }
  // Free text the admin controls directly — e.g. "Get 5% off with code XYZ" — so the header
  // banner never advertises a discount that isn't a real, currently-active coupon.
  if (req.body?.headerOffer !== undefined) {
    const text = String(req.body.headerOffer || '').trim();
    if (!text) {
      await query("DELETE FROM site_settings WHERE key = 'header_offer'");
    } else {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('header_offer', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [text]
      );
    }
  }
  /* Ordering paused.
     Stored as the message rather than a boolean: the row existing IS the pause, and its text is
     what the customer reads. One value, so there is no way to be paused with nothing to say, or to
     leave a stale message behind after going live. Deleting the row is going live. */
  if (req.body?.orderingPaused !== undefined) {
    const text = String(req.body.orderingPaused || '').trim();
    if (!text) {
      await query("DELETE FROM site_settings WHERE key = 'ordering_paused'");
    } else {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('ordering_paused', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [text.slice(0, 300)]);
    }
  }

  // Today's stall/store-visit note shown as a homepage card — same free-text pattern.
  if (req.body?.stallInfo !== undefined) {
    const text = String(req.body.stallInfo || '').trim();
    if (!text) {
      await query("DELETE FROM site_settings WHERE key = 'stall_info'");
    } else {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('stall_info', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [text]
      );
    }
  }
  // A flat, admin-set number the customer actually gets charged for outstation (Delhivery) delivery
  // — see the matching read in orders.js's order-creation charge and delivery.js's checkout quote,
  // so a change here takes effect on the very next quote/order with no redeploy.
  if (req.body?.deliveryFeeOutstation !== undefined) {
    const n = Number(req.body.deliveryFeeOutstation);
    if (!Number.isFinite(n) || n < 0) throw new ApiError('Delivery fee must be a non-negative number');
    await query(
      `INSERT INTO site_settings (key, value) VALUES ('delivery_fee_outstation', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [String(n)]
    );
  }
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'promo_product_id'");
  const offer = await getOne("SELECT value FROM site_settings WHERE key = 'header_offer'");
  const stall = await getOne("SELECT value FROM site_settings WHERE key = 'stall_info'");
  const outstationFee = await getOne("SELECT value FROM site_settings WHERE key = 'delivery_fee_outstation'");
  res.json({
    promoProductId: row?.value ? Number(row.value) : null, headerOffer: offer?.value || null, stallInfo: stall?.value || null,
    deliveryFeeOutstation: outstationFee?.value != null ? Number(outstationFee.value) : 100,
  });
});

export default router;
