import { getOne, getAll, query, nowIso } from '../db/index.js';
import { cancelShipment } from './delhivery.client.js';
import { cancelShiprocketOrder } from './shiprocket.client.js';
import { cancelOrder as petpoojaCancelOrder } from './petpooja.client.js';
import { notifyOrderMilestone } from './orderProgress.service.js';

/*
 * Moving an order to a new status, wherever the instruction came from.
 *
 * This lived inside the admin route until store staff needed the same power. Copying it would have
 * been quicker and would have gone wrong the first time one copy learned something the other did
 * not — the downstream cancel, in particular, is the difference between an order being cancelled
 * and an order being cancelled everywhere it exists. One implementation, two callers.
 *
 * Store staff reach this because the shop genuinely delivers its own orders: when Shiprocket finds
 * no rider, or the booking is cancelled, a manager takes it out personally. Until now the status
 * stayed where the carrier left it and the customer rang the shop to ask. A counter can now say
 * what actually happened.
 *
 * DELIVERED set from here is what "delivered by us" means. Nothing extra is stored to mark it: the
 * order reaches DELIVERED with no carrier delivery behind it, which is exactly the condition
 * deliveredByUs() in config/delivery.ts already tests, so admin, store and the customer's page all
 * describe it the same way without a second flag to keep in step.
 */

/*
 * Cancel an order everywhere it exists downstream — the POS ticket AND the courier booking.
 *
 * Cancelling only on our side used to leave both live: the kitchen kept baking and the rider still
 * turned up for a parcel nobody was going to pay for. Each leg is independent and each records its
 * own outcome on the order timeline, so a partial cancellation is visible rather than assumed.
 *
 * Never throws — a downstream refusal must not stop us cancelling on our own side.
 */
export async function cancelDownstream(order, reason) {
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

export interface StatusChange {
  order: any;
  status: string;
  /** Shown to the customer on the milestone email, and kept on the timeline. */
  remarks?: string | null;
  /** Who did it, for the timeline only — "ADC admin", or "Jayanagar counter (raj)". */
  by?: string;
}

/**
 * Apply a status, notify the customer, and cancel downstream if this is a cancellation.
 *
 * Returns the warnings from a downstream cancel that could not be completed, so the caller can tell
 * whoever pressed the button that a leg still needs doing by hand — a green tick that quietly meant
 * "the rider was not actually called off" is worse than an error.
 */
export async function applyOrderStatus({ order, status, remarks, by }: StatusChange) {
  const ts = nowIso();
  const note = typeof remarks === 'string' ? remarks.trim() : '';

  await query('UPDATE orders SET order_status=$1, updated_at=$2 WHERE id=$3', [status, ts, order.id]);
  await query(
    'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, status, [note, by ? `— ${by}` : ''].filter(Boolean).join(' ') || null, ts],
  );

  /* Cancel downstream too, or the kitchen keeps a live ticket and the rider still collects a parcel
     for an order that no longer exists. Awaited rather than fire-and-forget so the response reflects
     what actually happened. cancelDownstream never throws, so a carrier outage cannot fail our own
     cancellation. */
  if (status === 'CANCELLED' && order.order_status !== 'CANCELLED') {
    await cancelDownstream(order, note || `Cancelled by ${by || 'ADC'}`);
  }

  /* Moving an order by hand owes the customer the same email a carrier scan would have sent — a
     store that delivers a parcel itself is still the moment the customer wants to hear about, and
     is the entire reason a counter can set this. The status word we store is already the milestone
     vocabulary, so it needs no translation; notifyOrderMilestone ignores anything that is not one
     of the three and refuses to repeat one already sent, so a manual mark cannot double-mail.
     CANCELLED never mails from here: it has its own email with the refund line. */
  await notifyOrderMilestone(order, status, note);

  /* Anything the downstream cancel could NOT do, so the caller is told to finish it by hand instead
     of reading a success as "the rider was called off". */
  const failures = await getAll(
    `SELECT remarks FROM order_tracking
      WHERE order_id = $1 AND status IN ('POS_CANCEL_FAILED','SHIPMENT_CANCEL_FAILED') AND created_at >= $2`,
    [order.id, ts],
  ).catch(() => []);

  return { at: ts, cancelWarnings: failures.map((r) => r.remarks).filter(Boolean) as string[] };
}
