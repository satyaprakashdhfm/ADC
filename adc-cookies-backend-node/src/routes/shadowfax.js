import { Router } from 'express';
import { getOne, query, nowIso } from '../db.js';

const router = Router();

// Shadowfax marketplace status_id → our order_status. Only terminal/meaningful transitions move the
// customer-facing order_status; everything else just updates the shipment_status label + timeline.
const ORDER_STATUS_FOR = {
  delivered: 'DELIVERED',
  rts_d: 'CANCELLED',              // returned to seller (undeliverable)
  cancelled_by_customer: 'CANCELLED',
  cancelled_by_seller: 'CANCELLED',
  lost: 'CANCELLED',
};

/**
 * Shadowfax push callback (webhook). PUBLIC route — Shadowfax's servers call it, so it can't
 * require a user login. We protect it with a shared secret: set SHADOWFAX_WEBHOOK_SECRET and
 * configure the same value as the `Authorization` header on the Shadowfax dashboard webhook.
 *
 * Payload (see documentations/shadowfax.md §5): awb_number, order_id (our order_number), event
 * (status_id), status (human label), event_timestamp, comments, estimatedDeliveryDate (optional).
 */
router.post('/webhook', async (req, res) => {
  const secret = (process.env.SHADOWFAX_WEBHOOK_SECRET || '').trim();
  if (secret) {
    const got = String(req.get('authorization') || req.get('Authorization') || '').trim();
    // Accept both a bare secret and a "Token <secret>" style header.
    const ok = got === secret || got === `Token ${secret}` || got.replace(/^Token\s+/i, '') === secret;
    if (!ok) {
      console.log('[SFX-WEBHOOK] rejected | bad/missing Authorization header');
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
  }

  const b = req.body || {};
  const awb = String(b.awb_number || '').trim();
  const orderId = String(b.order_id || '').trim();
  const event = String(b.event || '').trim().toLowerCase();
  const statusLabel = String(b.status || b.event || '').trim();
  const comments = String(b.comments || '').trim();
  const eventTs = String(b.event_timestamp || '').trim();
  const eta = String(b.estimatedDeliveryDate || '').trim();

  console.log(`[SFX-WEBHOOK] HIT | awb=${awb || '—'} | order_id=${orderId || '—'} | event=${event || '—'} | status=${statusLabel || '—'}${eta ? ` | eta=${eta}` : ''}`);

  // Match the order by AWB (stored in delhivery_waybill) first, then by our order_number.
  let order = null;
  if (awb) order = await getOne('SELECT * FROM orders WHERE delhivery_waybill = $1', [awb]);
  if (!order && orderId) order = await getOne('SELECT * FROM orders WHERE order_number = $1', [orderId]);
  if (!order) {
    console.log('[SFX-WEBHOOK] no matching order — ack anyway so Shadowfax stops retrying');
    return res.json({ ok: true, matched: false }); // 200 so Shadowfax doesn't keep retrying
  }

  const ts = nowIso();
  const newOrderStatus = ORDER_STATUS_FOR[event];

  // Update shipment status (+ optional promised date, + order_status on terminal events).
  const sets = ['shipment_status = $1', 'updated_at = $2'];
  const params = [statusLabel || order.shipment_status, ts];
  if (eta) { params.push(eta); sets.push(`estimated_delivery = $${params.length}`); }
  if (newOrderStatus) { params.push(newOrderStatus); sets.push(`order_status = $${params.length}`); }
  params.push(order.id);
  await query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  // Append to the tracking timeline so the customer/admin sees the scan history.
  await query(
    'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, statusLabel || event || 'update', comments || null, eventTs || ts]
  );

  console.log(`[SFX-WEBHOOK] order=${order.order_number} | shipment_status="${statusLabel}"${newOrderStatus ? ` | order_status=${newOrderStatus}` : ''} | ✓`);
  return res.json({ ok: true, matched: true });
});

export default router;
