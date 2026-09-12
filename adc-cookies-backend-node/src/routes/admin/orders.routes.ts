import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../../db/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { serializeOrder, PAYMENT_SELECT } from '../../serializers/index.js';
import { ORDER_STATUSES } from '../../config/delivery.js';
import { applyOrderStatus } from '../../services/orderStatus.service.js';
import { storeByCode } from '../../services/store.service.js';

const router = Router();

/* ---------- Orders ---------- */
router.get('/orders', async (req, res) => {
  const { search, status } = req.query;
  let sql = 'SELECT o.* FROM orders o';
  const params: any[] = [];
  const where: any[] = [];
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
  const [items, payments, addresses, warnings, posRows, noteRows] = await Promise.all([
    orderIds.length ? getAll('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orderIds]) : [],
    orderIds.length ? getAll('SELECT DISTINCT ON (order_id) order_id, provider, transaction_id, status, paid_at, amount, amount_refunded FROM payments WHERE order_id = ANY($1) ORDER BY order_id, id DESC', [orderIds]) : [],
    addrIds.length ? getAll('SELECT * FROM addresses WHERE id = ANY($1)', [addrIds]) : [],
    orderIds.length ? getAll("SELECT DISTINCT order_id FROM order_tracking WHERE order_id = ANY($1) AND status = 'DUPLICATE_CHARGE_WARNING'", [orderIds]) : [],
    // One extra set-based query, not one per order — same reason as the note above.
    orderIds.length ? getAll('SELECT order_id, relay_ok, petpooja_order_id, attempts, last_error FROM petpooja_orders WHERE order_id = ANY($1)', [orderIds]) : [],
    /*
     * The most recent thing anybody SAID about each order, for the board to show instead of a
     * courier's stale status. DISTINCT ON keeps it one query for the page rather than one per row.
     *
     * Restricted to rows carrying an order status, so the POS and shipment bookkeeping written to
     * the same table (— SHIPMENT_CANCELLED, POS_MANUAL —) cannot win over the sentence a person
     * typed when they marked the order delivered.
     */
    orderIds.length ? getAll(
      `SELECT DISTINCT ON (order_id) order_id, remarks, status
         FROM order_tracking
        WHERE order_id = ANY($1)
          AND remarks IS NOT NULL AND btrim(remarks) <> ''
          AND status = ANY($2)
        ORDER BY order_id, created_at DESC, id DESC`,
      [orderIds, ORDER_STATUSES]) : [],
  ]);
  const itemsByOrder = new Map();
  for (const it of items) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  }
  const payByOrder = new Map(payments.map((p): [any, any] => [p.order_id, p]));
  const addrById = new Map(addresses.map((a): [any, any] => [a.id, a]));
  const duplicateChargeOrderIds = new Set(warnings.map((w) => w.order_id));
  const posByOrder = new Map(posRows.map((p): [any, any] => [p.order_id, p]));
  const noteByOrder = new Map(noteRows.map((n): [any, any] => [n.order_id, n.remarks]));
  const serialized = rows.map((o) =>
    serializeOrder(o, itemsByOrder.get(o.id) || [], o.address_id ? addrById.get(o.address_id) || null : null, payByOrder.get(o.id) || null,
      duplicateChargeOrderIds.has(o.id) ? ['DUPLICATE_CHARGE'] : [], posByOrder.get(o.id) || null, noteByOrder.get(o.id) ?? null)
  );
  res.json(serialized);
});

/*
 * Only the orders that have landed since the caller last looked.
 *
 * The dashboard polls this so it can raise a browser notification the moment an order arrives.
 * Deliberately NOT the full /orders list: that one carries items, addresses, payments and POS state
 * for every order the shop has ever taken, and pulling all of it twice a minute to discover that
 * nothing has changed is the sort of thing that is free at thirty orders and ruinous at thirty
 * thousand. This returns five columns and, most of the time, no rows at all.
 *
 * MUST stay above /orders/:id — Express matches in order, and "new" reaching that handler would be
 * passed to Postgres as an integer id.
 *
 * A first call sends no `since` and gets back only where "now" is, with no orders. A dashboard
 * opened on a morning's queue must not fire ten notifications for orders that arrived hours ago.
 */
router.get('/orders/new', async (req, res) => {
  const since = Number(req.query.since);
  const rows = Number.isFinite(since) && since > 0
    ? await getAll(
        `SELECT id, order_number, total_amount, store_code, created_at
           FROM orders WHERE id > $1 ORDER BY id DESC LIMIT 20`, [since])
    : [];
  /* MAX(id), not the newest row we just read — with no `since` there are no rows, and after a burst
     of more than twenty there would be orders above the ones returned. Either way the caller must
     come back asking for what it has not seen, not for what it was handed. */
  const { id: latestId } = (await getOne('SELECT COALESCE(MAX(id), 0) AS id FROM orders'))!;
  res.json({
    latestId: Number(latestId),
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      totalAmount: Number(o.total_amount),
      /* "Besant Nagar", not "besant" and not "A Dough Cookie, Besant Nagar" — a notification body
         is one short line and the shop's own name in it is the half that carries nothing. */
      store: o.store_code ? (storeByCode(o.store_code)?.name || o.store_code).replace(/^A Dough Cookie,\s*/, '') : null,
      createdAt: o.created_at,
    })),
  });
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null;
  const payment = await getOne(PAYMENT_SELECT, [order.id]);
  const hasDuplicateCharge = await getOne("SELECT 1 FROM order_tracking WHERE order_id = $1 AND status = 'DUPLICATE_CHARGE_WARNING' LIMIT 1", [order.id]);
  const pos = await getOne('SELECT relay_ok, petpooja_order_id, attempts, last_error FROM petpooja_orders WHERE order_id = $1', [order.id]);
  const note = await getOne(
    `SELECT remarks FROM order_tracking
      WHERE order_id = $1 AND remarks IS NOT NULL AND btrim(remarks) <> '' AND status = ANY($2)
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [order.id, ORDER_STATUSES]).catch(() => null);
  res.json(serializeOrder(order, items, address, payment, hasDuplicateCharge ? ['DUPLICATE_CHARGE'] : [], pos, note?.remarks ?? null));
});

router.patch('/orders/:id/status', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const { status, remarks } = req.body || {};
  if (!ORDER_STATUSES.includes(status)) throw new ApiError('Unknown status.');

  /* The work itself lives in services/orderStatus.service.ts, shared with the store portal. It
     updates the row, writes the timeline entry, cancels the POS ticket and courier booking on a
     cancellation, and sends the customer the milestone email. Two callers, one implementation —
     the alternative was a copy that would eventually disagree about the downstream cancel. */
  const { cancelWarnings } = await applyOrderStatus({ order, status, remarks, by: 'ADC admin' });

  const updated = await getOne('SELECT * FROM orders WHERE id = $1', [order.id]);
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = updated!.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [updated!.address_id]) : null;
  res.json({ ...serializeOrder(updated, items, address), cancelWarnings });
});

export default router;
