import { Router } from 'express';
import { getOne, query, nowIso } from '../../db/index.js';
import { ingestMenu, setStoreOpen, getStoreOpen } from '../../services/petpooja.service.js';
import { REST_ID } from '../../services/petpooja.client.js';

/*
 * Endpoints Petpooja calls on US. All are PUBLIC by necessity — their servers have no user login —
 * so an optional shared secret (PETPOOJA_WEBHOOK_SECRET, matched against the Authorization header,
 * configured as "Client Authorization" in their dashboard) gates them when set.
 *
 * Two deliberate rules throughout:
 *   • Reply in the exact shape their spec expects, or the dashboard reports the endpoint as failing
 *     even when we processed the call correctly.
 *   • Never 500. A webhook that errors gets retried, and a retry storm on a bad payload is worse
 *     than recording the payload and moving on — everything is stored raw for later inspection.
 */

const router = Router();

/* Log every inbound call before any handler can reject it. When a push fails, Petpooja's dashboard
   says only "Menu trigger failed" — it never reports the status or body we returned — so without
   this there is no way to tell "they never called us" from "they called and we 4xx'd". */
router.use((req, _res, next) => {
  const len = req.get('content-length') || '?';
  const keys = req.body && typeof req.body === 'object' ? Object.keys(req.body).join(',') : '(unparsed)';
  console.log(`[PETPOOJA] <- ${req.method} ${req.path} | ct=${req.get('content-type') || 'none'} | bytes=${len} | keys=${keys.slice(0, 220)}`);
  next();
});

/*
 * Shared secret, configured as "Client Authorization" in their dashboard.
 *
 * FAIL CLOSED. This previously returned true when no secret was configured, which left these
 * endpoints wide open on any deploy where the variable was unset — and they are not read-only:
 * update-store-status closes the shop, item-stock delists products from the storefront, and
 * callback moves any order to DELIVERED or CANCELLED. Verified exploitable with a plain curl.
 *
 * PETPOOJA_WEBHOOK_ALLOW_UNAUTH=true exists only as a first-run window while the secret is being
 * pasted into their panel. It warns on every request so it cannot quietly be left on.
 */
function authed(req) {
  const secret = (process.env.PETPOOJA_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    if (process.env.PETPOOJA_WEBHOOK_ALLOW_UNAUTH === 'true') {
      console.warn('[PETPOOJA] ⚠ unauthenticated call allowed — PETPOOJA_WEBHOOK_SECRET is not set');
      return true;
    }
    console.warn('[PETPOOJA] ✗ rejected: PETPOOJA_WEBHOOK_SECRET not set, refusing unauthenticated call');
    return false;
  }
  const got = String(req.get('authorization') || req.get('x-api-key') || '').trim();
  return got === secret || got.replace(/^(Bearer|Token)\s+/i, '') === secret;
}

/*
 * Only act on calls naming OUR restaurant.
 *
 * Defence in depth behind the secret: a request carrying a different restID has no business
 * touching our catalogue or orders. A blank restID passes, because their store-status calls do not
 * always carry one.
 */
function restIdOk(body) {
  const ours = String(REST_ID || '').trim();
  if (!ours) return true;
  const got = String(body?.restID ?? body?.restaurants?.[0]?.details?.menusharingcode ?? '').trim();
  if (!got || got === ours) return true;
  console.warn(`[PETPOOJA] ✗ rejected: restID mismatch (got ${got}, expected ${ours})`);
  return false;
}

/** Both gates, as one guard. Returns true when the request has been answered and must stop. */
function blocked(req, res, failBody) {
  if (!authed(req)) { res.status(401).json(failBody); return true; }
  if (!restIdOk(req.body)) { res.status(403).json(failBody); return true; }
  return false;
}

/* ---- Menu push: they call this after every menu change ---- */
router.post('/pushmenu', async (req, res) => {
  if (blocked(req, res, { success: '0', message: 'unauthorized' })) return;
  const body = req.body || {};
  try {
    // Let ingestMenu resolve the id — it knows to prefer the menu-sharing code over restaurantid,
    // which is the id orders are relayed with. Passing one in from here only overrode that.
    const r = await ingestMenu(body, { source: 'push' });
    if (!r.ok) {
      console.log(`[PETPOOJA] pushmenu | ✗ ${r.reason}`);
      return res.json({ success: '0', message: r.reason });
    }
    return res.json({ success: '1', message: `Menu saved (${r.items} items, ${r.addons} addons)` });
  } catch (err) {
    // Store nothing rather than retry-loop: log loudly, answer 200 so they stop resending.
    console.log(`[PETPOOJA] pushmenu | ✗ ${err.message}`);
    return res.json({ success: '0', message: 'menu could not be stored' });
  }
});

/* ---- Order callback: the merchant accepted / rejected / progressed the order ----
   status: -1 Cancelled · 1/2/3 Accepted · 4 Dispatched · 5 Food ready · 10 Delivered */
const ORDER_STATUS_FOR = {
  '-1': 'CANCELLED',
  '1': 'CONFIRMED', '2': 'CONFIRMED', '3': 'CONFIRMED',
  '4': 'OUT_FOR_DELIVERY',
  // 5 is "Food Ready" — preparation is FINISHED, so PACKED ("packed and ready for pickup"), not
  // PREPARING. Mapping it to PREPARING showed the customer "Preparing" for an order already sitting
  // ready for the courier, which under-reports progress at exactly the point they are watching.
  '5': 'PACKED',
  '10': 'DELIVERED',
};

router.post('/callback', async (req, res) => {
  if (blocked(req, res, { success: '0', message: 'unauthorized' })) return;
  const b = req.body || {};
  const clientOrderId = String(b.orderID || '').trim();     // our order_number, echoed back
  const status = String(b.status ?? '').trim();
  const ts = nowIso();
  console.log(`[PETPOOJA] callback | order=${clientOrderId} | status=${status}${b.cancel_reason ? ` | reason=${b.cancel_reason}` : ''}`);

  try {
    const order = clientOrderId
      ? await getOne('SELECT id, order_status FROM orders WHERE order_number = $1', [clientOrderId])
      : null;
    if (!order) {
      // Answer 200 anyway: an unknown id is not something a retry can fix.
      console.log(`[PETPOOJA] callback | order_not_found=${clientOrderId}`);
      return res.json({ success: '0', message: 'order not found' });
    }

    await query(
      `UPDATE petpooja_orders SET petpooja_status=$1, updated_at=$2 WHERE order_id=$3`,
      [status, ts, order.id]
    );

    const next = ORDER_STATUS_FOR[status];
    // Never walk a delivered/cancelled order backwards on a late or duplicate callback.
    const terminal = ['DELIVERED', 'CANCELLED'].includes(order.order_status);
    if (next && !terminal && next !== order.order_status) {
      await query('UPDATE orders SET order_status=$1, updated_at=$2 WHERE id=$3', [next, ts, order.id]);
      // Column is `remarks`, as everywhere else in the codebase — not `description`.
      await query(
        `INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)`,
        [order.id, next, b.cancel_reason ? `Petpooja: ${b.cancel_reason}` : `Petpooja status ${status}`, ts]
      );
    }
    return res.json({ success: '1', message: 'received' });
  } catch (err) {
    console.log(`[PETPOOJA] callback | ✗ ${err.message}`);
    return res.json({ success: '0', message: 'could not process' });
  }
});

/* ---- Item / add-on stock toggle. Their docs advise ONE endpoint for both on and off. ---- */
router.post('/item-stock', async (req, res) => {
  if (blocked(req, res, { code: '400', status: 'failed', message: 'unauthorized' })) return;
  const b = req.body || {};
  const restId = String(b.restID || REST_ID || '').trim();
  const inStock = b.inStock === true || String(b.inStock).toLowerCase() === 'true';
  const type = String(b.type || 'item').toLowerCase();
  const ids = (Array.isArray(b.itemID) ? b.itemID : [b.itemID]).filter(Boolean).map(String);
  const ts = nowIso();

  try {
    if (ids.length) {
      const table = type.includes('addon') ? 'petpooja_addons' : 'petpooja_items';
      const col = type.includes('addon') ? 'addon_id' : 'item_id';
      await query(
        `UPDATE ${table} SET in_stock=$1, updated_at=$2 WHERE rest_id=$3 AND ${col} = ANY($4::text[])`,
        [inStock, ts, restId, ids]
      );
      // Mirror onto our storefront so a sold-out item stops being orderable here too.
      if (!type.includes('addon')) {
        await query(
          `UPDATE products SET is_available=$1, updated_at=$2
             WHERE id IN (SELECT product_id FROM petpooja_items
                           WHERE rest_id=$3 AND item_id = ANY($4::text[]) AND product_id IS NOT NULL)`,
          [inStock, ts, restId, ids]
        );
      }
    }
    console.log(`[PETPOOJA] item-stock | ${type} | inStock=${inStock} | ids=${ids.join(',') || 'none'}`);
    return res.json({ code: '200', status: 'success', message: 'Stock status updated successfully' });
  } catch (err) {
    console.log(`[PETPOOJA] item-stock | ✗ ${err.message}`);
    return res.json({ code: '400', status: 'failed', message: 'Stock status not updated successfully' });
  }
});

/* ---- Store status: merchant reads / sets whether we accept online orders ---- */
router.post('/get-store-status', async (req, res) => {
  if (blocked(req, res, { status: 'failed', message: 'unauthorized' })) return;
  const restId = String(req.body?.restID || REST_ID || '').trim();
  try {
    const open = await getStoreOpen(restId);
    return res.json({ restID: restId, status: 'success', store_status: open ? '1' : '0', http_code: '200', message: open ? 'Store is open' : 'Store is closed' });
  } catch {
    return res.json({ restID: restId, status: 'failed', store_status: '1', http_code: '400', message: 'could not read store status' });
  }
});

router.post('/update-store-status', async (req, res) => {
  if (blocked(req, res, { status: 'failed', message: 'unauthorized' })) return;
  const b = req.body || {};
  const restId = String(b.restID || REST_ID || '').trim();
  const open = String(b.store_status ?? '1') === '1';
  try {
    await setStoreOpen(restId, open, { turnOnTime: b.turn_on_time || null, reason: b.reason || null });
    return res.json({ restID: restId, status: 'success', store_status: open ? '1' : '0', message: open ? 'Store turned on' : 'Store turned off' });
  } catch (err) {
    console.log(`[PETPOOJA] update-store-status | ✗ ${err.message}`);
    return res.json({ restID: restId, status: 'failed', store_status: open ? '1' : '0', message: 'could not update store status' });
  }
});

export default router;
