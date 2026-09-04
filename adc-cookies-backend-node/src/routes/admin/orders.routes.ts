import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../../db/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { serializeOrder, PAYMENT_SELECT } from '../../serializers/index.js';
import { cancelShipment } from '../../services/delhivery.client.js';
import { cancelShiprocketOrder } from '../../services/shiprocket.client.js';
import { cancelOrder as petpoojaCancelOrder } from '../../services/petpooja.client.js';
import { notifyOrderMilestone } from '../../services/orderProgress.service.js';

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
  const [items, payments, addresses, warnings, posRows] = await Promise.all([
    orderIds.length ? getAll('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orderIds]) : [],
    orderIds.length ? getAll('SELECT DISTINCT ON (order_id) order_id, provider, transaction_id, status, paid_at, amount, amount_refunded FROM payments WHERE order_id = ANY($1) ORDER BY order_id, id DESC', [orderIds]) : [],
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
  const payByOrder = new Map(payments.map((p): [any, any] => [p.order_id, p]));
  const addrById = new Map(addresses.map((a): [any, any] => [a.id, a]));
  const duplicateChargeOrderIds = new Set(warnings.map((w) => w.order_id));
  const posByOrder = new Map(posRows.map((p): [any, any] => [p.order_id, p]));
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
    } catch (err: any) {
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
  } catch (err: any) {
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

  /* An admin moving an order by hand owes the customer the same email a carrier scan would have
     sent — a store that delivers a parcel itself, or a status corrected after the fact, is still
     the moment the customer wants to hear about. The status word we store is already the milestone
     vocabulary, so it needs no translation, and notifyOrderMilestone ignores anything that is not
     one of the three and refuses to repeat one already sent. CANCELLED never mails from here: it
     has its own email with the refund line, sent from the cancel/refund route. */
  await notifyOrderMilestone(order, status);
  const updated = await getOne('SELECT * FROM orders WHERE id = $1', [order.id]);
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id]);
  const address = updated!.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [updated!.address_id]) : null;
  // Surface anything the downstream cancel could NOT do, so the admin is told to finish it by hand
  // instead of assuming a green tick meant the rider was called off.
  const failures = await getAll(
    `SELECT status, remarks FROM order_tracking
      WHERE order_id = $1 AND status IN ('POS_CANCEL_FAILED','SHIPMENT_CANCEL_FAILED') AND created_at >= $2`,
    [order.id, ts]).catch(() => []);
  res.json({ ...serializeOrder(updated, items, address), cancelWarnings: failures.map((f) => f.remarks) });
});

export default router;
