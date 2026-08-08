import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../db.js';
import { requireAdmin, ApiError } from '../middleware.js';
import { serializeProduct, serializeOrder, serializeOrderItem, serializeAddress, serializeCoupon, serializeUser, serializeWarehouse, PAYMENT_SELECT } from '../serializers.js';
import {
  delhiveryConfigured,
  fetchWaybill,
  createWarehouseOnDelhivery,
  updateWarehouseOnDelhivery,
  getShippingCost,
  createShipment,
  cancelShipment,
  createPickupRequest,
  shippingLabelUrl,
  trackShipment,
  fetchDocument,
  DELHIVERY_DOC_TYPES,
} from '../delhivery.js';
import { ADC_STORES, storeProductAvailable, resolveProductAvailability } from '../stores.js';
import { hashPassword, defaultPasswordFor } from '../storeAuth.js';
import { cancelShiprocketOrder, trackShiprocket, listPickups, shiprocketConfigured } from '../shiprocket.js';
import { cancelOrder as petpoojaCancelOrder, relayOrder, unmappedProducts } from '../petpooja.js';
import { autoCreateShipment } from './orders.js';

const router = Router();
router.use(requireAdmin);

/* ---------- Products ---------- */
router.get('/products', async (_req, res) => {
  const rows = await getAll('SELECT * FROM products ORDER BY id');
  res.json(rows.map(serializeProduct));
});

router.post('/products', async (req, res) => {
  const b = req.body || {};
  const ts = nowIso();
  const row = await getOne(
    `INSERT INTO products (name, category, description, price, stock_quantity, images, options, is_available, menu_group, tag, featured,
       intracity_available, intracity_unavailable_reason, intercity_available, intercity_unavailable_reason, restrict_cities, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [b.name, b.category, b.description ?? null, b.price, b.stockQuantity ?? 0,
     b.images ?? null, b.options ?? null, b.isAvailable !== false,
     b.menuGroup ?? null, b.tag ?? null, !!b.featured,
     b.intracityAvailable !== false, b.intracityUnavailableReason || null,
     b.intercityAvailable !== false, b.intercityUnavailableReason || null,
     b.restrictCities || null, ts, ts]
  );
  res.json(serializeProduct(row));
});

router.put('/products/:id', async (req, res) => {
  const existing = await getOne('SELECT 1 FROM products WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Product not found');
  const b = req.body || {};
  const row = await getOne(
    `UPDATE products SET name=$1, category=$2, description=$3, price=$4, stock_quantity=$5,
       images=$6, options=$7, is_available=$8, menu_group=$9, tag=$10, featured=$11,
       intracity_available=$12, intracity_unavailable_reason=$13,
       intercity_available=$14, intercity_unavailable_reason=$15,
       restrict_cities=$16, updated_at=$17 WHERE id=$18 RETURNING *`,
    [b.name, b.category, b.description ?? null, b.price, b.stockQuantity ?? 0,
     b.images ?? null, b.options ?? null, b.isAvailable !== false,
     b.menuGroup ?? null, b.tag ?? null, !!b.featured,
     b.intracityAvailable !== false, b.intracityUnavailableReason || null,
     b.intercityAvailable !== false, b.intercityUnavailableReason || null,
     b.restrictCities || null, nowIso(), req.params.id]
  );
  res.json(serializeProduct(row));
});

router.patch('/products/:id/stock', async (req, res) => {
  const qty = Number(req.body?.quantity ?? req.query.quantity);
  const existing = await getOne('SELECT 1 FROM products WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError('Product not found');
  await query('UPDATE products SET stock_quantity=$1, updated_at=$2 WHERE id=$3', [qty, nowIso(), req.params.id]);
  res.status(200).end();
});

router.delete('/products/:id', async (req, res) => {
  await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.status(200).end();
});

/* ---------- Orders ---------- */
router.get('/orders', async (req, res) => {
  const { search, status } = req.query;
  let sql = 'SELECT o.* FROM orders o';
  const params = [];
  const where = [];
  if (status) { params.push(status); where.push(`o.order_status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(o.order_number ILIKE $${params.length} OR EXISTS (
      SELECT 1 FROM addresses a WHERE a.id = o.address_id AND (a.full_name ILIKE $${params.length} OR a.city ILIKE $${params.length})
    ))`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY o.created_at DESC, o.id DESC';
  const rows = await getAll(sql, params);
  // Set-based fetch instead of one query per order: 3 queries total, not 3*N. The old
  // per-order Promise.all fired ~3*N simultaneous queries and exhausted the Supabase
  // session pooler (~15 client cap) -> EMAXCONNSESSION -> 500 (empty admin shipments table).
  const orderIds = rows.map((o) => o.id);
  const addrIds = [...new Set(rows.map((o) => o.address_id).filter(Boolean))];
  const [items, payments, addresses, warnings, posRows] = await Promise.all([
    orderIds.length ? getAll('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orderIds]) : [],
    orderIds.length ? getAll('SELECT DISTINCT ON (order_id) order_id, provider, transaction_id, status, paid_at FROM payments WHERE order_id = ANY($1) ORDER BY order_id, id DESC', [orderIds]) : [],
    addrIds.length ? getAll('SELECT * FROM addresses WHERE id = ANY($1)', [addrIds]) : [],
    orderIds.length ? getAll("SELECT DISTINCT order_id FROM order_tracking WHERE order_id = ANY($1) AND status = 'DUPLICATE_CHARGE_WARNING'", [orderIds]) : [],
    // One extra set-based query, not one per order — same reason as the note above.
    orderIds.length ? getAll('SELECT order_id, relay_ok, petpooja_order_id, attempts, last_error FROM petpooja_orders WHERE order_id = ANY($1)', [orderIds]) : [],
  ]);
  const itemsByOrder = new Map();
  for (const it of items) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  }
  const payByOrder = new Map(payments.map((p) => [p.order_id, p]));
  const addrById = new Map(addresses.map((a) => [a.id, a]));
  const duplicateChargeOrderIds = new Set(warnings.map((w) => w.order_id));
  const posByOrder = new Map(posRows.map((p) => [p.order_id, p]));
  const serialized = rows.map((o) =>
    serializeOrder(o, itemsByOrder.get(o.id) || [], o.address_id ? addrById.get(o.address_id) || null : null, payByOrder.get(o.id) || null,
      duplicateChargeOrderIds.has(o.id) ? ['DUPLICATE_CHARGE'] : [], posByOrder.get(o.id) || null)
  );
  res.json(serialized);
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null;
  const payment = await getOne(PAYMENT_SELECT, [order.id]);
  const hasDuplicateCharge = await getOne("SELECT 1 FROM order_tracking WHERE order_id = $1 AND status = 'DUPLICATE_CHARGE_WARNING' LIMIT 1", [order.id]);
  const pos = await getOne('SELECT relay_ok, petpooja_order_id, attempts, last_error FROM petpooja_orders WHERE order_id = $1', [order.id]);
  res.json(serializeOrder(order, items, address, payment, hasDuplicateCharge ? ['DUPLICATE_CHARGE'] : [], pos));
});

/*
 * Cancel an order everywhere it exists downstream — the POS ticket AND the courier booking.
 *
 * Cancelling only on our side used to leave both live: the kitchen kept baking and the rider still
 * turned up for a parcel nobody was going to pay for. Each leg is independent and each records its
 * own outcome on the order timeline, so a partial cancellation is visible rather than assumed.
 *
 * Never throws — a downstream refusal must not stop us cancelling on our own side.
 */
async function cancelDownstream(order, reason) {
  const ts = nowIso();
  const note = async (status, remarks) =>
    query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, status, remarks.slice(0, 500), ts]).catch(() => {});

  // ---- POS ----
  // Only if a ticket actually reached them; cancelling one they never received is a guaranteed error.
  const relayed = await getOne('SELECT relay_ok FROM petpooja_orders WHERE order_id = $1', [order.id]).catch(() => null);
  if (relayed?.relay_ok) {
    try {
      const r = await petpoojaCancelOrder(order.order_number, reason);
      await note(r.ok ? 'POS_CANCELLED' : 'POS_CANCEL_FAILED',
        r.ok ? 'Petpooja ticket cancelled' : `⚠ Petpooja would not cancel: ${JSON.stringify(r.reason).slice(0, 300)} — cancel it in the Petpooja dashboard`);
    } catch (err) {
      await note('POS_CANCEL_FAILED', `⚠ Petpooja cancel threw: ${err?.message || err} — cancel it in the Petpooja dashboard`);
    }
  }

  // ---- Courier ----
  if (!order.delhivery_waybill && !order.carrier_order_id) return;
  if (order.shipment_status === 'CANCELLED') return;
  try {
    let r;
    if (order.carrier === 'SHIPROCKET') {
      // Their cancel API takes THEIR order id, not the shipment id or the AWB.
      if (!order.carrier_order_id) {
        await note('SHIPMENT_CANCEL_FAILED', '⚠ No Shiprocket order id stored (booked before this was recorded) — cancel it in the Shiprocket panel');
        return;
      }
      r = await cancelShiprocketOrder(order.carrier_order_id);
    } else if (order.carrier === 'SHADOWFAX') {
      await note('SHIPMENT_CANCEL_FAILED', '⚠ Shadowfax is retired — cancel this one in their dashboard');
      return;
    } else {
      r = await cancelShipment(order.delhivery_waybill);
    }
    if (r.ok) {
      await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3', ['CANCELLED', ts, order.id]);
      await note('SHIPMENT_CANCELLED', `${order.carrier || 'DELHIVERY'} booking ${order.delhivery_waybill || order.carrier_order_id} cancelled`);
    } else {
      await note('SHIPMENT_CANCEL_FAILED',
        `⚠ ${order.carrier || 'DELHIVERY'} would not cancel ${order.delhivery_waybill || order.carrier_order_id}: ${JSON.stringify(r.reason).slice(0, 300)} — cancel it in their dashboard`);
    }
  } catch (err) {
    await note('SHIPMENT_CANCEL_FAILED', `⚠ Courier cancel threw: ${err?.message || err} — cancel it in their dashboard`);
  }
}

router.patch('/orders/:id/status', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const { status, remarks } = req.body || {};
  const ts = nowIso();
  await query('UPDATE orders SET order_status=$1, updated_at=$2 WHERE id=$3', [status, ts, order.id]);
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, status, remarks ?? null, ts]);

  // Cancel downstream too, or the kitchen keeps a live ticket and the rider still collects a parcel
  // for an order that no longer exists. Awaited rather than fire-and-forget so the response reflects
  // what actually happened — the admin needs to know immediately if a leg refused and needs doing by
  // hand. cancelDownstream never throws, so a carrier outage cannot fail our own cancellation.
  if (status === 'CANCELLED' && order.order_status !== 'CANCELLED') {
    await cancelDownstream(order, remarks || 'Cancelled by ADC admin');
  }
  const updated = await getOne('SELECT * FROM orders WHERE id = $1', [order.id]);
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = updated.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [updated.address_id]) : null;
  // Surface anything the downstream cancel could NOT do, so the admin is told to finish it by hand
  // instead of assuming a green tick meant the rider was called off.
  const failures = await getAll(
    `SELECT status, remarks FROM order_tracking
      WHERE order_id = $1 AND status IN ('POS_CANCEL_FAILED','SHIPMENT_CANCEL_FAILED') AND created_at >= $2`,
    [order.id, ts]).catch(() => []);
  res.json({ ...serializeOrder(updated, items, address), cancelWarnings: failures.map((f) => f.remarks) });
});

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
      `INSERT INTO products (name, category, description, price, stock_quantity, images, options,
                             is_available, menu_group, tag, featured, created_at, updated_at)
       VALUES ($1,'COOKIES',$2,$3,0,NULL,NULL,$4,NULL,NULL,FALSE,$5,$5) RETURNING id`,
      [name, `Imported from Petpooja (item ${item.item_id})`, Number(item.price) || 0, !!item.in_stock, ts]);
    productId = row.id;
  }

  await query(
    `UPDATE petpooja_items SET product_id = $1, updated_at = $2
      WHERE rest_id = $3 AND item_id = $4 AND variation_id = $5`,
    [productId, ts, restId, String(itemId), String(variationId)]);

  const product = await getOne('SELECT * FROM products WHERE id = $1', [productId]);
  res.json({ ok: true, created: !existing, product: serializeProduct(product) });
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
router.get('/attention', async (_req, res) => {
  // Stores whose orders WE relay to Petpooja. Everywhere else the staff bill on their own terminal,
  // so "no POS ticket" is the normal state there and listing it would bury the real failures.
  const autoPosStores = ADC_STORES.filter((s) => s.posMode === 'AUTO').map((s) => s.code);
  const [noShipment, noRelay, cancelStuck, disputes, manualUnbilled] = await Promise.all([
    // Paid, not cancelled, and no courier booked. `has_address` matters: an order with no address
    // can NEVER be booked, so the UI must explain that rather than offer a retry that always fails.
    // A MANUAL store's order sitting unbooked because nobody there has tapped Accept yet is NOT a
    // failure — that's the deliberate deferred-booking flow (see finalizePaidOrder) — so it's
    // excluded here; if booking itself then fails after acceptance, it reappears normally.
    getAll(`SELECT o.id, o.order_number, o.total_amount, o.created_at, o.shipment_error, o.carrier,
                   (o.address_id IS NOT NULL) AS has_address
              FROM orders o
             WHERE o.payment_status = 'PAID' AND o.order_status <> 'CANCELLED'
               AND o.delhivery_waybill IS NULL
               AND NOT (o.store_code IS NOT NULL AND NOT (o.store_code = ANY($1::text[])) AND o.store_accepted_at IS NULL)
             ORDER BY o.created_at DESC LIMIT 100`, [autoPosStores]),
    // Paid, not cancelled, relayed by us, and the kitchen never got the ticket.
    getAll(`SELECT o.id, o.order_number, o.total_amount, o.created_at,
                   p.last_error, COALESCE(p.attempts, 0) AS attempts
              FROM orders o LEFT JOIN petpooja_orders p ON p.order_id = o.id
             WHERE o.payment_status = 'PAID' AND o.order_status <> 'CANCELLED'
               AND (p.relay_ok IS NULL OR p.relay_ok = FALSE)
               AND o.store_code = ANY($1::text[])
             ORDER BY o.created_at DESC LIMIT 100`, [autoPosStores]),
    // Cancelled on our side but a downstream leg refused — POS ticket or rider still live.
    getAll(`SELECT DISTINCT o.id, o.order_number, t.status, t.remarks, t.created_at
              FROM orders o JOIN order_tracking t ON t.order_id = o.id
             WHERE t.status IN ('POS_CANCEL_FAILED','SHIPMENT_CANCEL_FAILED')
             ORDER BY t.created_at DESC LIMIT 100`),
    // Money reversed or contested after the fact.
    getAll(`SELECT DISTINCT o.id, o.order_number, t.status, t.remarks, t.created_at
              FROM orders o JOIN order_tracking t ON t.order_id = o.id
             WHERE t.status IN ('DISPUTE_OPENED','REFUNDED','REFUND_FAILED','FULFILLED_THEN_REFUNDED')
             ORDER BY t.created_at DESC LIMIT 100`),
    // Billed by a store on its own terminal, but no bill number typed back. Money Razorpay settled
    // with no POS bill to reconcile it against — the manual flow's one failure mode.
    getAll(`SELECT o.id, o.order_number, o.total_amount, o.created_at, o.store_code,
                   o.store_accepted_at, o.store_ready_at
              FROM orders o
             WHERE o.payment_status = 'PAID' AND o.order_status <> 'CANCELLED'
               AND o.store_code IS NOT NULL AND NOT (o.store_code = ANY($1::text[]))
               AND (o.store_pos_bill_no IS NULL OR o.store_pos_bill_no = '')
             ORDER BY o.created_at DESC LIMIT 100`, [autoPosStores]),
  ]);
  res.json({
    paidNoShipment: noShipment,
    paidNoPosTicket: noRelay,
    cancelStuckDownstream: cancelStuck,
    moneyReversed: disputes,
    posManualUnbilled: manualUnbilled,
    total: noShipment.length + noRelay.length + cancelStuck.length + disputes.length + manualUnbilled.length,
  });
});

/* ---------- Stores (staff portal) ---------- */

/*
 * Every outlet, its staff logins and what it is currently holding.
 *
 * `onStartingPassword` is the closest thing to an honest answer to "what is their password". A hash
 * cannot be read back, so instead we report whether the account has ever been used or had its
 * password changed. If neither has happened, the starting password still works and the UI can print
 * it; once either has, it cannot, and the UI says so rather than showing a stale one.
 */
router.get('/stores', async (_req, res) => {
  const [staff, counts, products] = await Promise.all([
    getAll('SELECT * FROM store_users ORDER BY store_code, username'),
    getAll(`SELECT store_code,
                   COUNT(*) FILTER (WHERE payment_status = 'PAID' AND order_status <> 'CANCELLED') AS paid,
                   COUNT(*) FILTER (WHERE payment_status = 'PAID' AND order_status <> 'CANCELLED' AND store_accepted_at IS NULL) AS unaccepted,
                   COUNT(*) FILTER (WHERE payment_status = 'PAID' AND order_status <> 'CANCELLED' AND (store_pos_bill_no IS NULL OR store_pos_bill_no = '')) AS unbilled
              FROM orders WHERE created_at >= $1 GROUP BY store_code`,
      [new Date(Date.now() - 30 * 864e5).toISOString()]),
    // For "does this store even carry it" — an intracity-disabled or city-restricted product
    // (Red Velvet: Bengaluru only) is a flat no at some stores regardless of storewide availability.
    getAll(`SELECT id, name, intracity_available, restrict_cities FROM products
             WHERE is_available = TRUE AND (intracity_available = FALSE OR restrict_cities IS NOT NULL)`),
  ]);
  const countBy = new Map(counts.map((c) => [c.store_code, c]));
  res.json({
    // Begur is AUTO — we relay it ourselves and it has no accept/bill step, so there is nothing for
    // a staff portal to do there. It never appears here; a login for it can't be created either
    // (see POST /stores/:code/staff below).
    stores: ADC_STORES.filter((s) => s.posMode === 'MANUAL').map((s) => {
      const c = countBy.get(s.code) || {};
      return {
        code: s.code, name: s.name, city: s.city, state: s.state, pincode: s.pincode,
        address: s.address_line_1, phone: s.contact, posMode: s.posMode,
        pickupName: s.pickupName,
        portalPath: `/store/${s.code}`,
        last30Days: { paid: Number(c.paid || 0), unaccepted: Number(c.unaccepted || 0), unbilled: Number(c.unbilled || 0) },
        // Kept in sync with exactly the rule the store's own /menu view and the checkout guard use
        // (storeProductAvailable in stores.js) — nothing here is computed a second, different way.
        doesNotCarry: products.filter((p) => !storeProductAvailable(s.code, p)).map((p) => p.name),
        staff: staff.filter((u) => u.store_code === s.code).map((u) => ({
          id: u.id, username: u.username, name: u.name, isActive: !!u.is_active,
          lastLoginAt: u.last_login_at, passwordSetAt: u.password_set_at,
          onStartingPassword: !u.last_login_at && !u.password_set_at,
          startingPassword: (!u.last_login_at && !u.password_set_at) ? defaultPasswordFor(s.code) : null,
        })),
      };
    }),
    // Accounts pointing at a store code that no longer exists in stores.js. They cannot sign in
    // (requireStoreUser refuses them), so surfacing them is the only way they get cleaned up.
    orphanedStaff: staff.filter((u) => !ADC_STORES.some((s) => s.code === u.store_code))
      .map((u) => ({ id: u.id, username: u.username, storeCode: u.store_code })),
  });
});

/*
 * Every store, online or off — including Begur (AUTO), which the staff-portal /stores endpoint
 * above deliberately excludes. Distinct concept: this is "is it currently taking new orders", not
 * "does it have a staff portal". No row in store_status means active — see isStoreActive in
 * stores.js, which orders.js and delivery.js's checkout quote both already consult.
 */
router.get('/store-status', async (_req, res) => {
  const rows = await getAll('SELECT store_code, is_active FROM store_status');
  const byCode = new Map(rows.map((r) => [r.store_code, !!r.is_active]));
  res.json({
    stores: ADC_STORES.map((s) => ({
      code: s.code, name: s.name, city: s.city, posMode: s.posMode,
      isActive: byCode.has(s.code) ? byCode.get(s.code) : true,
    })),
  });
});

router.patch('/store-status/:code/toggle', async (req, res) => {
  const code = String(req.params.code).trim().toLowerCase();
  const store = ADC_STORES.find((s) => s.code === code);
  if (!store) throw new ApiError('No such store');
  const existing = await getOne('SELECT is_active FROM store_status WHERE store_code = $1', [code]);
  const next = existing ? !existing.is_active : false; // no row yet = currently active, so toggling means turning it off
  await query(
    `INSERT INTO store_status (store_code, is_active, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (store_code) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at`,
    [code, next, nowIso()]
  );
  res.json({ ok: true, code, isActive: next });
});

/*
 * Per-store product availability — a manual override generalizing the intracity_available/
 * restrict_cities rule (which only understands "restricted to city X") to any product/store an
 * admin wants to flip directly, e.g. "Jayanagar is out of Red Velvet today". Returns EVERY
 * available product for the given store with its resolved availability and whether that's an
 * explicit override or the automatic rule, so the admin UI can show one flat on/off list per store.
 */
router.get('/store-products/:code', async (req, res) => {
  const code = String(req.params.code).trim().toLowerCase();
  const store = ADC_STORES.find((s) => s.code === code);
  if (!store) throw new ApiError('No such store');
  const [products, overrides] = await Promise.all([
    getAll('SELECT id, name, intracity_available, restrict_cities FROM products WHERE is_available = TRUE ORDER BY name'),
    getAll('SELECT product_id, is_available FROM store_product_overrides WHERE store_code = $1', [code]),
  ]);
  const overrideBy = new Map(overrides.map((o) => [o.product_id, o.is_available]));
  res.json({
    products: products.map((p) => {
      const override = overrideBy.has(p.id) ? overrideBy.get(p.id) : null;
      return {
        id: p.id, name: p.name,
        available: resolveProductAvailability(code, p, override),
        isOverride: override != null,
        automaticallyAvailable: storeProductAvailable(code, p),
      };
    }),
  });
});

// body: { available: true | false | null } — null clears the override, reverting to the
// automatic intracity_available/restrict_cities rule (or plain availability) for this store/product.
router.put('/store-products/:code/:productId', async (req, res) => {
  const code = String(req.params.code).trim().toLowerCase();
  const store = ADC_STORES.find((s) => s.code === code);
  if (!store) throw new ApiError('No such store');
  const productId = Number(req.params.productId);
  const available = req.body?.available;
  if (available === null) {
    await query('DELETE FROM store_product_overrides WHERE store_code = $1 AND product_id = $2', [code, productId]);
  } else {
    await query(
      `INSERT INTO store_product_overrides (store_code, product_id, is_available, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (store_code, product_id) DO UPDATE SET is_available = EXCLUDED.is_available, updated_at = EXCLUDED.updated_at`,
      [code, productId, !!available, nowIso()]
    );
  }
  res.json({ ok: true });
});

router.post('/stores/:code/staff', async (req, res) => {
  const store = ADC_STORES.find((s) => s.code === String(req.params.code).toLowerCase());
  if (!store) throw new ApiError('No such store');
  if (store.posMode !== 'MANUAL') throw new ApiError('This store is automatic — it has no staff portal to log in to');
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new ApiError('Username: 3–40 characters, letters/numbers/._- only');
  if (password.length < 8) throw new ApiError('Choose a password of at least 8 characters');
  const ts = nowIso();
  const row = await getOne(
    `INSERT INTO store_users (store_code, username, password_hash, name, password_set_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5,$5) RETURNING id, username`,
    [store.code, username, await hashPassword(password), String(req.body?.name || '').trim() || null, ts]
  );
  res.json({ ok: true, id: row.id, username: row.username });
});

// Set a staff password to something the admin types. There is no "email them a reset link" here —
// these accounts have no mailbox; the admin hands the password over in person.
router.post('/stores/staff/:id/password', async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) throw new ApiError('Choose a password of at least 8 characters');
  const user = await getOne('SELECT id FROM store_users WHERE id = $1', [req.params.id]);
  if (!user) throw new ApiError('No such staff account');
  const ts = nowIso();
  await query('UPDATE store_users SET password_hash = $1, password_set_at = $2, updated_at = $2 WHERE id = $3',
    [await hashPassword(password), ts, user.id]);
  res.json({ ok: true });
});

router.patch('/stores/staff/:id/toggle', async (req, res) => {
  const row = await getOne('UPDATE store_users SET is_active = NOT is_active, updated_at = $1 WHERE id = $2 RETURNING id, is_active',
    [nowIso(), req.params.id]);
  if (!row) throw new ApiError('No such staff account');
  res.json({ ok: true, isActive: !!row.is_active });
});

router.delete('/stores/staff/:id', async (req, res) => {
  await query('DELETE FROM store_users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------- Coupons ---------- */
router.get('/coupons', async (_req, res) => {
  const rows = await getAll('SELECT * FROM coupons ORDER BY id');
  // Attach live redemption counts so the UI can show Active / Expired / Limit-reached at a glance.
  const withUsage = await Promise.all(rows.map(async (c) => {
    const { n } = await getOne('SELECT COUNT(*) AS n FROM coupon_usage WHERE coupon_id = $1', [c.id]);
    return { ...serializeCoupon(c), timesUsed: Number(n) };
  }));
  res.json(withUsage);
});

router.post('/coupons', async (req, res) => {
  const b = req.body || {};
  const row = await getOne(
    `INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active, spin_weight, spin_label, terms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [String(b.code || '').toUpperCase(), b.discountType, b.discountValue,
     b.minimumOrderAmount ?? null, b.maximumDiscount ?? null, b.expiryDate ?? null,
     b.usageLimit ?? null, b.isActive !== false,
     b.spinWeight ?? null, b.spinLabel ?? null, b.terms ?? null]
  );
  res.json(serializeCoupon(row));
});

// Full edit — used by the Spin Wheel Offers panel to adjust odds/terms/limits on an existing
// reward (creating a fresh row each time would break the /order?coupon= links already handed
// out and orphan its usage history).
router.put('/coupons/:id', async (req, res) => {
  const b = req.body || {};
  const row = await getOne(
    `UPDATE coupons SET code=$1, discount_type=$2, discount_value=$3, minimum_order_amount=$4,
       maximum_discount=$5, expiry_date=$6, usage_limit=$7, is_active=$8, spin_weight=$9, spin_label=$10, terms=$11
     WHERE id=$12 RETURNING *`,
    [String(b.code || '').toUpperCase(), b.discountType, b.discountValue,
     b.minimumOrderAmount ?? null, b.maximumDiscount ?? null, b.expiryDate ?? null,
     b.usageLimit ?? null, b.isActive !== false,
     b.spinWeight ?? null, b.spinLabel ?? null, b.terms ?? null, req.params.id]
  );
  if (!row) throw new ApiError('Coupon not found', 404);
  res.json(serializeCoupon(row));
});

router.patch('/coupons/:id/toggle', async (req, res) => {
  const coupon = await getOne('SELECT * FROM coupons WHERE id = $1', [req.params.id]);
  if (!coupon) throw new ApiError('Coupon not found');
  const row = await getOne('UPDATE coupons SET is_active = $1 WHERE id = $2 RETURNING *', [!coupon.is_active, coupon.id]);
  res.json(serializeCoupon(row));
});

router.delete('/coupons/:id', async (req, res) => {
  const coupon = await getOne('SELECT * FROM coupons WHERE id = $1', [req.params.id]);
  if (!coupon) throw new ApiError('Coupon not found', 404);
  await query('DELETE FROM coupon_usage WHERE coupon_id = $1', [coupon.id]);
  await query('DELETE FROM spin_claims WHERE coupon_id = $1', [coupon.id]);
  await query('DELETE FROM coupons WHERE id = $1', [coupon.id]);
  res.json({ ok: true });
});

// The wheel is one spin per device/account for good (see coupons.js POST /spin) — this is the
// only way to open a fresh round for everyone at once, short of a redeploy. Deliberately only
// touches spin_draws (who has already spun): already-issued coupons in spin_claims /
// spin_email_claims are real discount codes someone may still redeem, so they're left alone.
router.post('/coupons/reset-spins', async (_req, res) => {
  const result = await query('DELETE FROM spin_draws');
  res.json({ ok: true, cleared: result.rowCount });
});

/* ---------- Users ---------- */
router.get('/users', async (_req, res) => {
  // Customers only — admin accounts are separated out and never listed here.
  const rows = await getAll("SELECT * FROM users WHERE role <> 'ADMIN' ORDER BY id DESC");
  const withCounts = await Promise.all(rows.map(async (u) => {
    const { c } = await getOne('SELECT COUNT(*) AS c FROM orders WHERE user_id = $1', [u.id]);
    // Their saved delivery addresses (default first) so the Customers tab can show where they order from.
    const addrs = await getAll('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC', [u.id]);
    return { ...serializeUser(u), orderCount: Number(c), addresses: addrs.map(serializeAddress) };
  }));
  res.json(withCounts);
});

/* ---------- Contact messages ---------- */
router.get('/contact', async (_req, res) => {
  const rows = await getAll('SELECT * FROM contact_messages ORDER BY id DESC');
  res.json(rows.map(m => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, handled: !!m.handled, createdAt: m.created_at })));
});

router.patch('/contact/:id/handled', async (req, res) => {
  const row = await getOne('UPDATE contact_messages SET handled = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
  if (!row) throw new ApiError('Message not found');
  res.json({ id: row.id, handled: !!row.handled });
});

/* ---------- Site settings (homepage promo popup target + header banner offer) ---------- */
router.get('/settings', async (_req, res) => {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'promo_product_id'");
  const offer = await getOne("SELECT value FROM site_settings WHERE key = 'header_offer'");
  const stall = await getOne("SELECT value FROM site_settings WHERE key = 'stall_info'");
  const outstationFee = await getOne("SELECT value FROM site_settings WHERE key = 'delivery_fee_outstation'");
  res.json({
    promoProductId: row?.value ? Number(row.value) : null, headerOffer: offer?.value || null, stallInfo: stall?.value || null,
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

/* ---------- Dashboard ---------- */
router.get('/dashboard', async (_req, res) => {
  const orders = await getAll('SELECT total_amount, order_status, payment_status, created_at FROM orders');
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const paidRevenue = orders.filter(o => o.payment_status === 'PAID').reduce((s, o) => s + Number(o.total_amount), 0);

  const { c: totalProducts } = await getOne('SELECT COUNT(*) AS c FROM products');
  const { c: totalUsers } = await getOne("SELECT COUNT(*) AS c FROM users WHERE role = 'CUSTOMER'");
  const { c: totalAdmins } = await getOne("SELECT COUNT(*) AS c FROM users WHERE role = 'ADMIN'");
  const { c: lowStock } = await getOne('SELECT COUNT(*) AS c FROM products WHERE stock_quantity <= 10');
  let newMessages = 0;
  try { const r = await getOne('SELECT COUNT(*) AS c FROM contact_messages WHERE handled = FALSE'); newMessages = Number(r.c); } catch {}

  // Orders grouped by status (e.g. PLACED / PREPARING / DELIVERED …)
  const ordersByStatus = {};
  for (const o of orders) ordersByStatus[o.order_status] = (ordersByStatus[o.order_status] || 0) + 1;

  // Top products by quantity sold
  const topRows = await getAll(
    `SELECT product_name, SUM(quantity) AS qty, SUM(total_price) AS revenue
       FROM order_items GROUP BY product_name ORDER BY qty DESC LIMIT 5`
  );
  const topProducts = topRows.map(r => ({ name: r.product_name, qty: Number(r.qty), revenue: Number(r.revenue) }));

  res.json({
    totalOrders, totalRevenue, paidRevenue,
    totalProducts: Number(totalProducts),
    totalUsers: Number(totalUsers), totalAdmins: Number(totalAdmins),
    lowStock: Number(lowStock), newMessages,
    ordersByStatus, topProducts,
  });
});

/* ---------- Analytics (charts) ---------- */
// All order-based metrics are scoped to [from, to] (inclusive). created_at is ISO text, so we
// compare on its date prefix (LEFT 10). Defaults to the last 30 days when no range is given.
router.get('/analytics', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const def = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  let from = okDate(req.query.from) ? req.query.from : def;
  let to = okDate(req.query.to) ? req.query.to : today;
  if (from > to) [from, to] = [to, from];
  const p = [from, to];

  const salesByDay = (await getAll(
    `SELECT LEFT(created_at,10) AS day, COUNT(*) AS orders,
            COALESCE(SUM(total_amount),0) AS revenue,
            COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_amount ELSE 0 END),0) AS paid
       FROM orders WHERE LEFT(created_at,10) BETWEEN $1 AND $2 GROUP BY day ORDER BY day`, p
  )).map(r => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue), paid: Number(r.paid) }));

  // INITCAP(LOWER(city)) merges case variants of legacy rows ("bengaluru"/"BENGALURU" -> "Bengaluru").
  const ordersByArea = (await getAll(
    `SELECT COALESCE(INITCAP(LOWER(NULLIF(a.city,''))),'Unknown') AS city, COUNT(o.id) AS orders,
            COALESCE(SUM(o.total_amount),0) AS revenue
       FROM orders o LEFT JOIN addresses a ON a.id = o.address_id
      WHERE LEFT(o.created_at,10) BETWEEN $1 AND $2
      GROUP BY 1 ORDER BY orders DESC LIMIT 8`, p
  )).map(r => ({ city: r.city, orders: Number(r.orders), revenue: Number(r.revenue) }));

  // Distinct customers who ordered in this period, by their delivery city.
  const usersByCity = (await getAll(
    `SELECT COALESCE(INITCAP(LOWER(NULLIF(a.city,''))),'Unknown') AS city, COUNT(DISTINCT o.user_id) AS users
       FROM orders o JOIN addresses a ON a.id = o.address_id
      WHERE LEFT(o.created_at,10) BETWEEN $1 AND $2
      GROUP BY 1 ORDER BY users DESC LIMIT 8`, p
  )).map(r => ({ city: r.city, users: Number(r.users) }));

  const paymentBreakdown = (await getAll(
    `SELECT payment_status AS status, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS amount
       FROM orders WHERE LEFT(created_at,10) BETWEEN $1 AND $2 GROUP BY payment_status`, p
  )).map(r => ({ status: r.status, count: Number(r.count), amount: Number(r.amount) }));

  const shipmentByStatus = (await getAll(
    `SELECT COALESCE(NULLIF(shipment_status,''),'NOT_CREATED') AS status, COUNT(*) AS count
       FROM orders WHERE LEFT(created_at,10) BETWEEN $1 AND $2 GROUP BY 1 ORDER BY count DESC`, p
  )).map(r => ({ status: r.status, count: Number(r.count) }));

  const topProducts = (await getAll(
    `SELECT oi.product_name AS name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.total_price),0) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE LEFT(o.created_at,10) BETWEEN $1 AND $2
      GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 8`, p
  )).map(r => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));

  res.json({ from, to, salesByDay, ordersByArea, usersByCity, paymentBreakdown, shipmentByStatus, topProducts });
});

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
  const byNick = new Map(pickups.map((p) => [p.nickname.toLowerCase(), p]));
  const stores = ADC_STORES.map((s) => {
    const nick = String(s.pickupName || '').trim().toLowerCase();
    const p = nick ? byNick.get(nick) : null;
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
  const result = await getShippingCost({ originPin, destPin, weight: Number(weight), cod: Number(cod), mode });
  res.json(result);
});

/* ======================================================================
   Delivery — Shipment actions per order
   ====================================================================== */

// POST /api/admin/orders/:id/shipment — create shipment on Delhivery for this order
router.post('/orders/:id/shipment', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);

  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.delhivery_waybill) throw new ApiError('Shipment already created for this order', 409);
  // Booking a courier costs real money out of the Delhivery wallet the moment the shipment is
  // created, so it must not be possible to do it for an order nobody has paid for. `force` covers
  // the genuine case of a payment reconciled outside Razorpay.
  if (order.payment_status !== 'PAID' && String(req.body?.force) !== 'true') {
    throw new ApiError(`Order is not paid (payment_status=${order.payment_status}) — booking a courier would spend from the Delhivery wallet for an unpaid order. Send force:true to override.`, 409);
  }
  if (order.order_status === 'CANCELLED' && String(req.body?.force) !== 'true') {
    throw new ApiError('Order is cancelled — send force:true to book a courier anyway.', 409);
  }

  const address = order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null;
  if (!address) throw new ApiError('Order has no delivery address', 400);

  const wh = await getOne('SELECT * FROM warehouses WHERE is_default = TRUE AND is_active = TRUE LIMIT 1');
  if (!wh) throw new ApiError('No active default warehouse configured — create one in Delivery > Warehouses', 400);

  const waybillRes = await fetchWaybill(1);
  if (!waybillRes.ok || !waybillRes.waybills?.length) {
    console.log(`[ADMIN-SHIPMENT] create FAILED | order=${order.order_number} | waybill_fetch=FAILED | reason=${waybillRes.reason}`);
    throw new ApiError(`Could not fetch waybill from Delhivery: ${waybillRes.reason}`, 502);
  }
  const waybill = String(waybillRes.waybills[0]);
  console.log(`[ADMIN-SHIPMENT] create | order=${order.order_number} | wh=${wh.pickup_location} | dest=${address.pincode} | weight=${req.body?.weight || 0.5} | waybill=${waybill}`);

  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
  const productsDesc = items.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'Cookies';

  const shipmentData = {
    waybill,
    name: address.full_name,
    add: [address.address_line1, address.address_line2].filter(Boolean).join(', '),
    pin: address.pincode,
    city: address.city,
    state: address.state || '',
    country: 'India',
    phone: address.phone,
    order: order.order_number,
    payment_mode: 'Pre-paid',
    return_pin: wh.return_pincode || wh.pincode,
    return_city: wh.city || '',
    return_state: wh.state || '',
    return_country: 'India',
    return_add: [wh.address_line1, wh.address_line2].filter(Boolean).join(', ') || wh.city || '',
    return_name: wh.name,
    return_phone: wh.phone || '',
    products_desc: productsDesc,
    hsn_code: '19053100',
    cod_amount: 0,
    order_date: order.created_at ? order.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    total_amount: String(order.total_amount),
    seller_add: [wh.address_line1, wh.city].filter(Boolean).join(', '),
    seller_name: wh.registered_name || wh.name,
    seller_inv: order.order_number,
    quantity: String(items.reduce((s, i) => s + i.quantity, 0) || 1),
    shipment_type: 0,
    origin_scan: 1,
    weight: String(req.body?.weight || 0.5),
    shipping_mode: 'Express',
    address_type: 'home',
    seller_gst_tin: '',
  };

  const result = await createShipment(shipmentData, wh.pickup_location);
  if (!result.ok) {
    console.log(`[ADMIN-SHIPMENT] create FAILED | order=${order.order_number} | reason=${result.reason} | detail=${JSON.stringify(result.detail || '').slice(0, 300)}`);
    return res.status(502).json({ error: result.reason, detail: result.detail });
  }

  await query(
    `UPDATE orders SET delhivery_waybill=$1, carrier='DELHIVERY', shipment_status='CREATED', tracking_url=$2, label_generated=TRUE, updated_at=$3 WHERE id=$4`,
    [result.waybill, `https://www.delhivery.com/track/package/${result.waybill}`, nowIso(), order.id]
  );
  console.log(`[ADMIN-SHIPMENT] create OK | order=${order.order_number} | waybill=${result.waybill} | label=ready`);
  const updated = await getOne('SELECT * FROM orders WHERE id = $1', [order.id]);
  const serialized = serializeOrder(updated, items, address);
  res.json({ ...serialized, waybill: result.waybill });
});

// DELETE /api/admin/orders/:id/shipment — cancel the shipment WITH WHOEVER BOOKED IT.
// This used to always call Delhivery, so cancelling an intracity order sent a Shiprocket AWB to
// Delhivery's edit endpoint, which rejected it while the rider was still on the way.
/*
 * Has a rider actually been allocated to this order?
 *
 * For Shiprocket the AWB is the tell, and it is a reliable one: assignment is asynchronous and the
 * AWB only appears once a real rider has been found. Confirmed live on 2026-08-07 — a create +
 * assign + cancel cycle that was cancelled during "Searching For Rider" never produced an AWB and
 * never charged the wallet. So AWB present = rider allocated = money already spent = someone is on
 * their way to the store, which is a materially different thing to cancel than a pending search.
 *
 * The status text is checked too, for orders whose AWB arrived by webhook before we stored it.
 */
function riderDispatched(order) {
  if (order.carrier !== 'SHIPROCKET') return false;
  if (order.delhivery_waybill) return true;
  return /RIDER ASSIGNED|PICKED ?UP|IN TRANSIT|OUT FOR DELIVERY|REACHED/i.test(String(order.shipment_status || ''));
}

router.delete('/orders/:id/shipment', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill && !order.carrier_order_id) throw new ApiError('No shipment exists for this order', 400);

  const dispatched = riderDispatched(order);
  const ref = order.delhivery_waybill || order.carrier_order_id;
  console.log(`[ADMIN-SHIPMENT] cancel | order=${order.order_number} | carrier=${order.carrier || 'DELHIVERY'} | ref=${ref}`);

  let result;
  if (order.carrier === 'SHIPROCKET') {
    if (!order.carrier_order_id) {
      throw new ApiError('This Shiprocket booking predates us storing their order id — cancel it in the Shiprocket panel.', 409);
    }
    result = await cancelShiprocketOrder(order.carrier_order_id);
  } else {
    if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
    result = await cancelShipment(order.delhivery_waybill);
  }

  if (!result.ok) {
    console.log(`[ADMIN-SHIPMENT] cancel FAILED | ref=${ref} | reason=${JSON.stringify(result.reason)}`);
    const carrier = order.carrier || 'DELHIVERY';
    const raw = typeof result.reason === 'string' ? result.reason : JSON.stringify(result.reason ?? '');
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, 'SHIPMENT_CANCEL_FAILED', `⚠ ${carrier} refused to cancel ${ref}: ${raw.slice(0, 300)}`, nowIso()]).catch(() => {});
    // A human sentence, not a reason code — this is read by whoever now has to go and cancel it by
    // hand, and "the rider is still coming" is the part that matters.
    const panel = carrier === 'SHIPROCKET' ? 'Shiprocket' : 'Delhivery';
    const message = dispatched
      ? `A rider has already been dispatched for this order, and ${carrier} refused to call them off: ${raw.slice(0, 240)}. The rider is still on their way to the store. Phone the store and the rider to stop the handover, then cancel it in the ${panel} dashboard. The delivery charge has already been taken and will not come back on its own.`
      : `${carrier} refused to cancel ${ref}: ${raw.slice(0, 300)}. The booking is still LIVE — a rider may still collect this order. Cancel it directly in the ${panel} dashboard.`;
    return res.status(502).json({ ok: false, error: message, message, carrier, dispatched, reason: result.reason, detail: result.detail });
  }

  await query(`UPDATE orders SET shipment_status='CANCELLED', updated_at=$1 WHERE id=$2`, [nowIso(), order.id]);
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'SHIPMENT_CANCELLED', `${order.carrier || 'DELHIVERY'} booking ${ref} cancelled${dispatched ? ' (rider had already been dispatched)' : ''}`, nowIso()]).catch(() => {});
  /*
   * Shiprocket accepts the cancel but leaves `status` reading NEW — their own panel shows the same,
   * and only the activity log records "Order Canceled" (verified live 2026-08-07). So a 200 is the
   * best confirmation their API offers, and we do not try to re-read the status to "verify": doing
   * so would report every successful cancellation as a failure.
   */
  const message = dispatched
    ? `Booking ${ref} cancelled and the rider called off. Please confirm with the store that nobody collects it — the delivery charge was already taken, so check whether it is refunded to your wallet.`
    : `Booking ${ref} cancelled with ${order.carrier || 'the carrier'}. No rider had been allocated yet, so nothing was charged. The customer's payment is NOT refunded by this.`;
  res.json({ ok: true, waybill: order.delhivery_waybill, carrier: order.carrier || 'DELHIVERY', dispatched, message });
});

/*
 * POST /api/admin/orders/:id/rebook — retry the AUTOMATIC carrier booking.
 *
 * Distinct from POST /orders/:id/shipment, which only ever books Delhivery from the default
 * warehouse. This re-runs the real routing (intracity → nearest serviceable store on Shiprocket,
 * otherwise Delhivery), so an order whose booking failed at payment time is retried exactly as it
 * would have been booked then — no manual carrier choice, and no wrong-carrier bookings.
 */
/*
 * Turn autoCreateShipment's internal reason code into something an operator can act on, and pick a
 * status that reflects WHOSE problem it is: 409 when the order itself cannot be shipped (nothing to
 * retry until the data is fixed), 502 when the carrier refused or was unreachable (retrying may
 * work). Returning a bare reason code was useless — the frontend reads `message`/`error`, so a
 * failure surfaced in the UI as an unexplained "HTTP 502".
 */
function shipmentFailureResponse(reason) {
  const r = String(reason || '');
  if (r === 'no_address') return { status: 409, message: 'This order has no delivery address, so there is nowhere to ship it. Orders created directly for testing (and any placed without an address) can never be booked — this is not a carrier problem.' };
  if (r === 'order_not_found') return { status: 404, message: 'Order not found.' };
  if (r === 'not_configured') return { status: 503, message: 'No courier is configured on this environment, so nothing can be booked here.' };
  if (r === 'no_warehouse') return { status: 409, message: 'No active default warehouse — set one under Delivery → Warehouses before booking Delhivery.' };
  if (r.startsWith('waybill_fetch:')) return { status: 502, message: `Delhivery would not issue a waybill (${r.slice(14)}). This is usually a wallet balance or account issue on their side.` };
  return { status: 502, message: `The carrier refused the booking: ${r}` };
}

router.post('/orders/:id/rebook', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.delhivery_waybill) throw new ApiError('This order already has a shipment — cancel it first.', 409);
  if (order.payment_status !== 'PAID') throw new ApiError(`Order is not paid (payment_status=${order.payment_status}).`, 409);
  if (order.order_status === 'CANCELLED') throw new ApiError('Order is cancelled.', 409);

  const r = await autoCreateShipment(order.id);
  if (!r.ok) {
    const { status, message } = shipmentFailureResponse(r.reason);
    return res.status(status).json({ ok: false, reason: r.reason, error: message, message });
  }
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'SHIPMENT_CREATED', `${r.carrier || 'Carrier'} waybill ${r.waybill} (re-booked by admin)`, nowIso()]).catch(() => {});
  res.json(r);
});

// GET /api/admin/orders/:id/track — pull fresh tracking from whichever carrier created the shipment.
router.get('/orders/:id/track', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill) return res.json({ ok: false, reason: 'no_shipment' });

  // Shiprocket (intracity) — normalize into the same { ok, carrier, status, scans } shape.
  // Without this branch an intracity AWB was sent to Delhivery's tracker, which of course
  // knows nothing about it, so the admin saw "not found" for a parcel that was moving fine.
  if (order.carrier === 'SHIPROCKET') {
    const sid = order.delhivery_shipment_id;
    if (!sid) return res.json({ ok: false, carrier: 'SHIPROCKET', reason: 'no_shipment_id' });
    const result = await trackShiprocket(sid);
    if (result.ok && result.status) {
      await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3', [result.status, nowIso(), order.id]);
    }
    const scans = (result.activities || []).map((a) => ({ time: a.date || a.time, event: a.activity || a.status }));
    return res.json({ ok: result.ok, carrier: 'SHIPROCKET', status: result.status || null, awb: result.awb || order.delhivery_waybill, scans });
  }

  // Delhivery (outstation)
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const result = await trackShipment(order.delhivery_waybill);
  if (result.ok && result.data) {
    const pkg = Array.isArray(result.data?.ShipmentData) ? result.data.ShipmentData[0]?.Shipment : null;
    // Same Status + Instructions join as the customer-facing route (routes/orders.js) — keeps
    // shipment_status consistently formatted regardless of which route last updated it.
    const latestStatus = [pkg?.Status?.Status, pkg?.Status?.Instructions].filter(Boolean).join(' — ') || null;
    if (latestStatus) {
      await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3',
        [latestStatus, nowIso(), order.id]);
    }
  }
  res.json({ ...result, carrier: 'DELHIVERY' });
});

// Recursively find the first http(s) URL anywhere in a Delhivery response (the document API's
// shape varies by doc type), so the UI can open it directly.
function firstUrl(v) {
  if (!v) return null;
  if (typeof v === 'string') return /^https?:\/\//i.test(v.trim()) ? v.trim() : null;
  if (Array.isArray(v)) { for (const x of v) { const u = firstUrl(x); if (u) return u; } return null; }
  if (typeof v === 'object') { for (const x of Object.values(v)) { const u = firstUrl(x); if (u) return u; } return null; }
  return null;
}

// GET /api/admin/orders/:id/document?type=EPOD — fetch a B2C document (proof of delivery,
// signature, return-QC image) for a Delhivery order. Only after the shipment exists.
router.get('/orders/:id/document', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found', 404);
  if (!order.delhivery_waybill) return res.json({ ok: false, reason: 'no_shipment' });
  if (order.carrier !== 'DELHIVERY') return res.json({ ok: false, reason: 'not_delhivery' });
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);

  const docType = String(req.query.type || '').toUpperCase();
  if (!DELHIVERY_DOC_TYPES.includes(docType)) {
    throw new ApiError(`Invalid document type. Allowed: ${DELHIVERY_DOC_TYPES.join(', ')}`, 400);
  }

  const result = await fetchDocument({ docType, waybill: order.delhivery_waybill });
  if (!result.ok) return res.status(502).json({ ok: false, reason: result.reason, detail: result.detail });
  res.json({ ok: true, docType, waybill: order.delhivery_waybill, url: firstUrl(result.data), data: result.data });
});

// GET /api/admin/delivery/label?waybills=X,Y — proxy the Delhivery shipping label PDF.
// packing_slip returns EITHER raw PDF bytes OR JSON with a pre-signed pdf_download_link;
// we stream the PDF through our server either way so the browser just downloads it.
router.get('/delivery/label', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const { waybills } = req.query;
  if (!waybills) throw new ApiError('waybills param required', 400);

  const { url, headers } = shippingLabelUrl(waybills);
  const sendPdf = (buf, via) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label-${waybills}.pdf"`);
    console.log(`[ADMIN-LABEL] wbns=${waybills} | ✓ ${via} | ${buf.byteLength}b`);
    res.send(Buffer.from(buf));
  };

  try {
    const upstream = await fetch(url, { headers });
    const ct = upstream.headers.get('Content-Type') || '';

    if (ct.includes('application/pdf')) {
      return sendPdf(await upstream.arrayBuffer(), 'direct pdf');
    }

    // JSON response: pull the pre-signed PDF link and stream that.
    const data = await upstream.json().catch(() => null);
    const pkg = Array.isArray(data?.packages) ? data.packages[0] : null;
    const pdfUrl = pkg?.pdf_download_link || pkg?.pdf_download_url || data?.pdf_download_link || null;
    if (!pdfUrl) {
      console.log(`[ADMIN-LABEL] wbns=${waybills} | ✗ no_pdf_link | ${JSON.stringify(data || {}).slice(0, 200)}`);
      return res.status(502).json({ error: 'no_pdf_link', detail: data });
    }
    const pdfRes = await fetch(pdfUrl);
    return sendPdf(await pdfRes.arrayBuffer(), 'via link');
  } catch (e) {
    console.log(`[ADMIN-LABEL] wbns=${waybills} | ✗ ${e.message}`);
    throw new ApiError('Could not fetch label from Delhivery', 502);
  }
});

// POST /api/admin/delivery/pickup-request
router.post('/delivery/pickup-request', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delhivery not configured', 503);
  const { pickupDate, pickupTime, packageCount } = req.body || {};
  if (!pickupDate || !pickupTime) throw new ApiError('pickupDate and pickupTime are required', 400);

  const wh = await getOne('SELECT * FROM warehouses WHERE is_default = TRUE AND is_active = TRUE LIMIT 1');
  if (!wh) throw new ApiError('No active default warehouse configured', 400);

  const result = await createPickupRequest({
    pickupDate, pickupTime, pickupLocation: wh.pickup_location, packageCount: Number(packageCount || 1),
  });

  /*
   * Delhivery's rejections are terse and name no cause, so translate the two that actually happen.
   * A wallet under ₹500 is the common one — it applies to Prepaid and COD alike (confirmed live) —
   * and the other is a slot already open for this warehouse today, since only one pickup request
   * per location per day is allowed until the existing one is closed.
   */
  if (!result.ok) {
    const raw = JSON.stringify(result.reason ?? result.detail ?? '').toLowerCase();
    let hint = null;
    if (/balance|wallet|insufficient|recharge|fund/.test(raw)) {
      hint = 'Your Delhivery wallet is below the ₹500 minimum needed to book a pickup. Top it up in the Delhivery panel and try again. (Prepaid and COD both require this.)';
    } else if (/already|exist|duplicate|open|pending/.test(raw)) {
      hint = `A pickup request is already open for ${wh.pickup_location} today. Delhivery allows only one per warehouse per day — the existing one must be closed before another can be raised. Check it in their panel.`;
    }
    const message = hint || `Delhivery refused the pickup request: ${JSON.stringify(result.reason ?? '').slice(0, 300)}`;
    return res.status(502).json({ ...result, error: message, message, warehouse: wh.pickup_location });
  }
  res.json({ ...result, warehouse: wh.pickup_location });
});

export default router;
