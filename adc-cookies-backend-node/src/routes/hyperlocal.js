import { Router } from 'express';
import { getOne, query, nowIso } from '../db.js';
import { shiprocketStatusToOrderStatus } from '../shiprocket.js';

/*
 * Shiprocket Hyperlocal webhook — the ONLY way tracking reaches us.
 *
 * Their hyperlocal spec has no pull-based tracking endpoint, so if this route is missing or wrong,
 * an intracity order simply never moves past its created state on our side.
 *
 * The route is deliberately NOT called /shiprocket: their panel rejects any webhook URL containing
 * "shiprocket", "kartrocket", "sr", "kr" or "localhost". Renaming the path is the fix; the naming
 * looks arbitrary until you hit the validation error.
 */

const router = Router();

/*
 * Shared secret, sent as x-api-key (their panel's "Auth Token Type").
 *
 * FAIL CLOSED. This endpoint moves orders to DELIVERED and CANCELLED, so accepting unauthenticated
 * calls when the variable happens to be unset is not a safe default — an unset variable on one
 * deploy would silently open it.
 */
function authed(req) {
  const secret = (process.env.SHIPROCKET_WEBHOOK_TOKEN || '').trim();
  if (!secret) {
    if (process.env.SHIPROCKET_WEBHOOK_ALLOW_UNAUTH === 'true') {
      console.warn('[HYPERLOCAL] ⚠ unauthenticated call allowed — SHIPROCKET_WEBHOOK_TOKEN is not set');
      return true;
    }
    console.warn('[HYPERLOCAL] ✗ rejected: SHIPROCKET_WEBHOOK_TOKEN not set, refusing unauthenticated call');
    return false;
  }
  const got = String(req.get('x-api-key') || req.get('authorization') || '').trim();
  return got === secret || got.replace(/^Bearer\s+/i, '') === secret;
}

router.post('/webhook', async (req, res) => {
  const b = req.body || {};
  // `awb` arrives as a NUMBER in their real payloads, not a string.
  const awb = String(b.awb ?? '').trim();
  /*
   * Match on channel_order_id, NOT order_id.
   *
   * `order_id` is SHIPROCKET's internal id (e.g. 13905312). Ours is `channel_order_id` — the create
   * response pairs them: {"order_id":1488719462,"channel_order_id":"ADCSR1785587438692"}. Reading
   * order_id as ours means no webhook ever matches, and the order silently never progresses.
   */
  const clientOrderId = String(b.channel_order_id ?? '').trim();
  const status = String(b.current_status || b.shipment_status || '').trim();
  const ts = nowIso();

  console.log(`[HYPERLOCAL] <- awb=${awb || '-'} | channel_order=${clientOrderId || '-'} | sr_order=${b.order_id ?? '-'} | status=${status} | courier=${b.courier_name || '-'}`);

  // Answer 200 even when we cannot act on it. Shiprocket retries non-200s, and a retry cannot fix
  // an unknown order or a status we do not model — it would just repeat forever.
  if (!authed(req)) { console.log('[HYPERLOCAL] webhook | rejected: bad x-api-key'); return res.status(401).json({ ok: false }); }

  try {
    const order = clientOrderId
      ? await getOne('SELECT id, order_status, order_number FROM orders WHERE order_number = $1', [clientOrderId])
      : awb ? await getOne('SELECT id, order_status, order_number FROM orders WHERE delhivery_waybill = $1', [awb]) : null;

    if (!order) { console.log(`[HYPERLOCAL] webhook | order not found (order_id=${clientOrderId} awb=${awb})`); return res.json({ ok: true, matched: false }); }

    // Keep the carrier's own wording on the shipment, and the AWB, so the admin sees what they see.
    await query(
      `UPDATE orders SET shipment_status=$1, delhivery_waybill=COALESCE(NULLIF($2,''), delhivery_waybill),
              carrier='SHIPROCKET', updated_at=$3 WHERE id=$4`,
      [status || 'IN_TRANSIT', awb, ts, order.id]
    );

    const next = shiprocketStatusToOrderStatus(status);
    const terminal = ['DELIVERED', 'CANCELLED'].includes(order.order_status);
    if (next && !terminal && next !== order.order_status) {
      await query('UPDATE orders SET order_status=$1, updated_at=$2 WHERE id=$3', [next, ts, order.id]);
      await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
        [order.id, next, `Shiprocket: ${status}${b.courier_name ? ` (${b.courier_name})` : ''}`, ts]);
      console.log(`[HYPERLOCAL] webhook | order=${order.order_number} | ${order.order_status} → ${next}`);
    } else {
      // Still worth a tracking row: rider-reached-pickup and similar are useful to the admin even
      // though they do not move our own status. Their latest scan line is the most human-readable
      // detail they give us, so keep it when present.
      const latest = Array.isArray(b.scans) && b.scans.length ? b.scans[0] : null;
      const note = latest?.activity ? `Shiprocket: ${status} — ${latest.activity}` : `Shiprocket: ${status}`;
      await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
        [order.id, order.order_status, note, ts]);
    }
    return res.json({ ok: true, matched: true });
  } catch (err) {
    console.log(`[HYPERLOCAL] webhook | ✗ ${err.message}`);
    return res.json({ ok: false, error: 'could not process' });
  }
});

// Lets us confirm the URL is reachable before wiring it into their panel, and gives their
// "Test Webhook" button something friendly to hit.
router.get('/webhook', (_req, res) => res.json({ ok: true, service: 'adc-hyperlocal-webhook' }));

export default router;
