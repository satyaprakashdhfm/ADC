import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../../db/index.js';
import { ApiError } from '../../middlewares/auth.middleware.js';
import { serializeProduct, withImageUrls } from '../../serializers/index.js';
import { ADC_STORES } from '../../services/store.service.js';
import { relayOrder, unmappedProducts } from '../../services/petpooja.service.js';
// Same constant the poller counts against, so the panel and the retry cannot disagree about
// what "out of attempts" means.
import { RIDER_RETRY_MAX } from '../../jobs/statusPoller.js';

const router = Router();

/* ---------- Petpooja (POS / billing) ---------- */

// Everything the mapping screen needs in one call: their catalogue, our products, and what is
// still unlinked. An order cannot relay until every product it contains has a Petpooja item id.
router.get('/petpooja/mapping', async (_req, res) => {
  const restId = process.env.PETPOOJA_REST_ID || '';
  const [items, products, unmapped, pushes, taxes] = await Promise.all([
    getAll(`SELECT item_id, variation_id, name, variation_name, price, in_stock, product_id, category_id
              FROM petpooja_items WHERE rest_id = $1 ORDER BY name, variation_name`, [restId]),
    getAll('SELECT id, name, price, is_available FROM products ORDER BY id'),
    unmappedProducts(restId),
    // Every menu Petpooja has ever pushed. Kept because a push that arrives malformed is otherwise
    // invisible — their dashboard only ever says "Menu trigger failed" with no detail.
    getAll(`SELECT id, rest_id, source, item_count, received_at FROM petpooja_menu_snapshots
             ORDER BY id DESC LIMIT 10`),
    getAll('SELECT tax_id, name, percentage FROM petpooja_taxes WHERE rest_id = $1 ORDER BY tax_id', [restId]),
  ]);
  res.json({ restId, items, products, unmapped, taxes, pushes, menuSynced: items.length > 0 });
});

/*
 * Link from OUR side: given one of our products, choose which Petpooja item it is.
 *
 * The item-first direction reads backwards in practice. Our catalogue is the fixed, known set —
 * thirteen products we actually sell — while theirs is larger and includes things we never list
 * online (coffees, combo packs). Working product-by-product means every row is one you care about,
 * and "which of our products still has no POS item" is answerable at a glance.
 *
 * A product maps to exactly one item, so any previous link for that product is cleared first —
 * otherwise re-pointing a product would silently leave two items claiming it, and relayOrder would
 * pick whichever the query happened to return.
 */
router.post('/petpooja/mapping/by-product', async (req, res) => {
  const restId = process.env.PETPOOJA_REST_ID || '';
  const { productId, itemId, variationId = '' } = req.body || {};
  if (!productId) throw new ApiError('productId is required');
  const ts = nowIso();

  await query('UPDATE petpooja_items SET product_id = NULL, updated_at = $1 WHERE rest_id = $2 AND product_id = $3',
    [ts, restId, Number(productId)]);

  if (itemId) {
    const r = await query(
      `UPDATE petpooja_items SET product_id = $1, updated_at = $2
        WHERE rest_id = $3 AND item_id = $4 AND variation_id = $5`,
      [Number(productId), ts, restId, String(itemId), String(variationId)]);
    if (!r.rowCount) throw new ApiError('That Petpooja item is not in the synced menu', 404);
  }
  res.json({ ok: true });
});

/*
 * Create one of OUR products straight from a Petpooja item, and link the two.
 *
 * Mapping assumes a matching product already exists on our side. For a catalogue that lives in the
 * POS first — which is the normal direction here, since the kitchen owns the menu — it usually does
 * not, and the alternative is retyping every name and price into the Products tab and coming back.
 */
router.post('/petpooja/mapping/create-product', async (req, res) => {
  const restId = process.env.PETPOOJA_REST_ID || '';
  const { itemId, variationId = '' } = req.body || {};
  if (!itemId) throw new ApiError('itemId is required');

  const item = await getOne(
    `SELECT * FROM petpooja_items WHERE rest_id = $1 AND item_id = $2 AND variation_id = $3`,
    [restId, String(itemId), String(variationId)]);
  if (!item) throw new ApiError('That Petpooja item is not in the synced menu', 404);
  if (item.product_id) throw new ApiError('This item is already linked to a product', 409);

  // Their variation name belongs in the product name — "Choco Chip" and "Choco Chip (500g)" are
  // different products to a customer, and identical ones would be impossible to tell apart.
  const name = [item.name, item.variation_name].filter(Boolean).join(' — ');
  const existing = await getOne('SELECT id FROM products WHERE lower(name) = lower($1)', [name]);
  const ts = nowIso();
  let productId;
  if (existing) {
    productId = existing.id;   // don't duplicate a product that is already there — just link it
  } else {
    const row = await getOne(
      `INSERT INTO products (name, category, description, price, images, options,
                             is_available, menu_group, tag, featured, created_at, updated_at)
       VALUES ($1,'COOKIES',$2,$3,NULL,NULL,$4,NULL,NULL,FALSE,$5,$5) RETURNING id`,
      [name, `Imported from Petpooja (item ${item.item_id})`, Number(item.price) || 0, !!item.in_stock, ts]);
    productId = row.id;
  }

  await query(
    `UPDATE petpooja_items SET product_id = $1, updated_at = $2
      WHERE rest_id = $3 AND item_id = $4 AND variation_id = $5`,
    [productId, ts, restId, String(itemId), String(variationId)]);

  const product = await getOne('SELECT * FROM products WHERE id = $1', [productId]);
  res.json({ ok: true, created: !existing, product: await withImageUrls(serializeProduct(product)) });
});

// Link or unlink one of their items to one of our products. product_id null clears the link.
router.post('/petpooja/mapping', async (req, res) => {
  const { itemId, variationId = '', productId } = req.body || {};
  if (!itemId) throw new ApiError('itemId is required');
  await query(
    `UPDATE petpooja_items SET product_id = $1, updated_at = $2
      WHERE rest_id = $3 AND item_id = $4 AND variation_id = $5`,
    [productId ?? null, nowIso(), process.env.PETPOOJA_REST_ID || '', String(itemId), String(variationId)]
  );
  res.json({ ok: true });
});

// Relay history — which orders reached the POS, which failed and why.
router.get('/petpooja/orders', async (_req, res) => {
  const rows = await getAll(
    `SELECT p.order_id, o.order_number, o.total_amount, p.relay_ok, p.petpooja_order_id,
            p.petpooja_status, p.attempts, p.last_error, p.updated_at
       FROM petpooja_orders p JOIN orders o ON o.id = p.order_id
      ORDER BY p.updated_at DESC LIMIT 100`);
  res.json(rows);
});

// Retry a relay that failed — after fixing a mapping, say. relayOrder is idempotent: an order
// already relayed is skipped rather than duplicated at the POS. It also refuses unpaid and
// cancelled orders; force:true is the escape hatch for a payment reconciled outside Razorpay.
router.post('/petpooja/orders/:id/retry', async (req, res) => {
  const r = await relayOrder(Number(req.params.id), { force: String(req.body?.force) === 'true' });
  res.json(r);
});

/*
 * GET /api/admin/attention — every order that took money but did not complete downstream.
 *
 * This is the one screen that answers "did anything fall through the cracks today". Each list is
 * something a human has to act on; an empty response means every paid order reached both the
 * kitchen and a courier.
 */
/*
 * How long a stage is allowed to take before its silence counts as a failure.
 *
 * The panel used to list a stage the moment it was incomplete, which meant it listed every healthy
 * order for the first minutes of its life: a hyperlocal booking is accepted instantly but the AWB
 * arrives only once a rider has been found, so a perfectly normal order sat under "no courier
 * booked" — beside a button offering to book it a second time — for the whole search. A list that
 * is mostly orders doing exactly what they should be doing is a list nobody reads.
 *
 * A recorded failure still shows at once. These windows only govern silence.
 */
const RELAY_GRACE_MIN = 10;    // the POS ticket is a single call; ten minutes is already long
const BOOKING_GRACE_MIN = 10;  // nothing should go this long without a booking even being attempted
const RIDER_GRACE_MIN = 45;    // a rider search runs for a while; past this it is not searching

router.get('/attention', async (_req, res) => {
  // Stores whose orders WE relay to Petpooja. Everywhere else the staff bill on their own terminal,
  // so "no POS ticket" is the normal state there and listing it would bury the real failures.
  const autoPosStores = ADC_STORES.filter((s) => s.posMode === 'AUTO').map((s) => s.code);
  const [noShipment, noRelay, cancelStuck, disputes, riderExhausted] = await Promise.all([
    /*
     * Paid, live, and no courier is coming.
     *
     * `has_address` matters: an order with no address can NEVER be booked, so the UI must explain
     * that rather than offer a retry that always fails. A MANUAL store's order sitting unbooked
     * because nobody there has tapped Accept yet is not a failure either — that is the deliberate
     * deferred-booking flow (see finalizePaidOrder).
     *
     * A cancelled booking is not a failure either — ours or theirs. Someone decided that, and
     * nagging them about their own decision is how a panel like this stops being read. Matched
     * loosely rather than against our own 'CANCELLED': Shiprocket spells it "Canceled", and an
     * exact comparison would have quietly kept every carrier-side cancellation on the list.
     */
    getAll(`SELECT o.id, o.order_number, o.total_amount, o.created_at, o.shipment_error, o.carrier,
                   o.carrier_order_id, o.delhivery_shipment_id AS shipment_id, o.shipment_status,
                   (o.address_id IS NOT NULL) AS has_address
              FROM orders o
             WHERE o.payment_status = 'PAID' AND o.order_status <> 'CANCELLED'
               AND o.delhivery_waybill IS NULL
               AND COALESCE(o.shipment_status, '') !~* 'cancel'
               AND NOT (o.store_code IS NOT NULL AND NOT (o.store_code = ANY($1::text[])) AND o.store_accepted_at IS NULL)
               -- Out of Ship Now attempts is its own list below, with its own action. Listing the
               -- same order twice under two headings is how a panel stops being read.
               AND COALESCE(o.rider_retry_count, 0) < $4
               AND (
                 -- The carrier said no. That is an answer, not silence, so it shows straight away.
                 o.shipment_error IS NOT NULL
                 -- Nothing was ever attempted.
                 OR (o.carrier_order_id IS NULL AND o.delhivery_shipment_id IS NULL
                     AND o.created_at < now() - make_interval(mins => $2::int))
                 -- Booked, but the rider search has run past the point of being a search.
                 OR o.created_at < now() - make_interval(mins => $3::int)
               )
             ORDER BY o.created_at DESC LIMIT 100`, [autoPosStores, BOOKING_GRACE_MIN, RIDER_GRACE_MIN, RIDER_RETRY_MAX]),
    /*
     * Paid, relayed by us, and the kitchen never got the ticket.
     *
     * `not_configured` is excluded: it means Petpooja has no credentials on this deployment, which
     * is one thing to fix once, not a fault in every order that happens to pass through afterwards.
     * Listed per order it would fill this panel and hide the relays that genuinely broke.
     */
    getAll(`SELECT o.id, o.order_number, o.total_amount, o.created_at,
                   p.last_error, COALESCE(p.attempts, 0) AS attempts
              FROM orders o LEFT JOIN petpooja_orders p ON p.order_id = o.id
             WHERE o.payment_status = 'PAID' AND o.order_status <> 'CANCELLED'
               AND COALESCE(o.shipment_status, '') !~* 'cancel'
               AND (p.relay_ok IS NULL OR p.relay_ok = FALSE)
               AND COALESCE(p.last_error, '') <> 'not_configured'
               AND o.store_code = ANY($1::text[])
               AND o.created_at < now() - make_interval(mins => $2::int)
             ORDER BY o.created_at DESC LIMIT 100`, [autoPosStores, RELAY_GRACE_MIN]),
    // Cancelled on our side but a downstream leg refused — POS ticket or rider still live. Drops
    // off once a later cancel succeeds, so the list can actually reach empty; before this it could
    // only ever grow, and a counter that never returns to zero stops meaning anything.
    /* Only orders that are actually cancelled on our side, which is what the heading claims.
       A failed cancel on an order that then went on to be DELIVERED is not a loose end — the
       parcel arrived, nothing is live, and there is nobody to phone. Worse, it could never clear:
       the escape below waits for a later SHIPMENT_CANCELLED that a delivered order will never get,
       so one press of Cancel on a delivered shipment pinned a permanent row here. */
    getAll(`SELECT DISTINCT o.id, o.order_number, t.status, t.remarks, t.created_at
              FROM orders o JOIN order_tracking t ON t.order_id = o.id
             WHERE t.status IN ('POS_CANCEL_FAILED','SHIPMENT_CANCEL_FAILED')
               AND o.order_status = 'CANCELLED'
               AND NOT EXISTS (
                 SELECT 1 FROM order_tracking d
                  WHERE d.order_id = o.id AND d.created_at > t.created_at
                    AND d.status = replace(t.status, '_CANCEL_FAILED', '_CANCELLED'))
             ORDER BY t.created_at DESC LIMIT 100`),
    // Money reversed or contested after the fact.
    getAll(`SELECT DISTINCT o.id, o.order_number, t.status, t.remarks, t.created_at
              FROM orders o JOIN order_tracking t ON t.order_id = o.id
             WHERE t.status IN ('DISPUTE_OPENED','REFUNDED','REFUND_FAILED','FULFILLED_THEN_REFUNDED')
             ORDER BY t.created_at DESC LIMIT 100`),
    /*
     * Same-day orders the carrier has now been asked to ship three times without finding a rider.
     *
     * Distinct from "no courier booked": the booking exists and is perfectly healthy, it is the
     * RIDER that does not. Nothing here is retryable by us any more - the automatic Ship Now has
     * spent its attempts - so the action is a person deciding, which is why the row leads to the
     * order rather than to another button that would do what already failed.
     */
    getAll(`SELECT o.id, o.order_number, o.total_amount, o.created_at, o.shipment_error,
                   o.delhivery_shipment_id AS shipment_id, o.shipment_status,
                   COALESCE(o.rider_retry_count, 0) AS rider_retry_count, o.rider_retry_at
              FROM orders o
             WHERE o.payment_status = 'PAID' AND o.order_status NOT IN ('CANCELLED','DELIVERED')
               AND o.carrier = 'SHIPROCKET'
               AND o.delhivery_waybill IS NULL
               AND COALESCE(o.shipment_status, '') !~* 'cancel'
               AND COALESCE(o.rider_retry_count, 0) >= $1
             ORDER BY o.created_at DESC LIMIT 100`, [RIDER_RETRY_MAX]),
  ]);
  /*
   * The manual stores' missing bill numbers used to be a fifth list here. It is a real gap — a
   * Razorpay settlement with nothing on a till to reconcile against — but head office cannot type a
   * bill number that only exists on a shop's own terminal, so it appeared with no action beside it
   * and one row per manual order. The store portal already asks for it at the counter, straight
   * after Accept, which is the only place anyone can actually answer.
   */
  res.json({
    paidNoShipment: noShipment,
    paidNoPosTicket: noRelay,
    cancelStuckDownstream: cancelStuck,
    moneyReversed: disputes,
    riderSearchExhausted: riderExhausted,
    riderRetryMax: RIDER_RETRY_MAX,
    total: noShipment.length + noRelay.length + cancelStuck.length + disputes.length + riderExhausted.length,
  });
});

export default router;
