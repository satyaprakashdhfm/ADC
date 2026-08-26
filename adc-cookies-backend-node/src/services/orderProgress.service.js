import { query, nowIso } from '../db/index.js';
import { shiprocketStatusToOrderStatus } from './shiprocket.client.js';

/*
 * One rule for how a carrier's own status becomes OUR order status, applied wherever we learn it.
 *
 * The Shiprocket webhook did this and nothing else did. So a cancellation reached the customer's
 * account only if the webhook happened to arrive — and when it did not, the order sat at PACKED
 * with a cancelled booking underneath it, saying nothing was wrong. Delhivery has no webhook at
 * all, so an intercity order could never reach DELIVERED on our side except by hand.
 *
 * Only the terminal states travel this way. DELIVERED and CANCELLED are unambiguous in every
 * carrier's vocabulary and are the two the customer must be told about. The in-between states
 * (in transit, out for delivery) are already visible through shipment_status, and promoting them
 * from a poll risks calling something out for delivery while it is still crossing a state line.
 */
const TERMINAL = ['DELIVERED', 'CANCELLED'];

export async function applyCarrierTerminalStatus(order, carrierStatus, source) {
  const next = shiprocketStatusToOrderStatus(carrierStatus);
  if (!next || !TERMINAL.includes(next)) return null;
  // Already terminal, or already there: nothing to say.
  if (TERMINAL.includes(order.order_status) || next === order.order_status) return null;

  const ts = nowIso();
  await query('UPDATE orders SET order_status=$1, updated_at=$2 WHERE id=$3', [next, ts, order.id]);
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, next, `${source}: ${carrierStatus}`, ts]).catch(() => {});
  console.log(`[ORDER] ${order.order_number || order.id} | ${order.order_status} → ${next} (${source}: ${carrierStatus})`);
  return next;
}

/* An intracity booking has no waybill until a rider is found, and this line is read by the customer
   on their own tracking sheet — "SHIPROCKET waybill null" was going straight to them. Say what is
   true at each stage instead of interpolating whatever the carrier has not given us yet.
   Lives here because both routes/orders.js and routes/admin/shipments.js write this event, and
   having either import the other makes a cycle. */
export const bookingNote = (carrier, waybill, suffix = '') => (waybill
  ? `${carrier || 'Courier'} booking confirmed — tracking ${waybill}${suffix}`
  : `${carrier || 'Courier'} booking confirmed — finding a delivery partner${suffix}`);
