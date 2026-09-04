import { getOne, query, nowIso } from '../db/index.js';
import { shiprocketStatusToOrderStatus } from './shiprocket.client.js';
import { sendOrderMilestoneEmail } from './mailer.client.js';

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

/* ------------------------------------------------------------------ */
/* Delivery-progress emails                                            */
/* ------------------------------------------------------------------ */

/*
 * THE ORDER OF THIS ARRAY IS THE RULE, not decoration.
 *
 * Three emails after the confirmation, and each one only if nothing further along has already gone
 * out. Carriers do not report monotonic progress: a parcel scanned "Out for delivery" that fails an
 * attempt goes back to "In Transit" the same evening, and Delhivery re-reports facility hops for
 * days. Without the ordering the customer gets "on its way" AFTER "arriving today", which reads as
 * the parcel going backwards, and on a re-attempt they would get "arriving today" twice.
 */
const MAIL_MILESTONES = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/*
 * Which of the three, if any, a carrier status means.
 *
 * Finer than shiprocketStatusToOrderStatus, which lumps picked-up, in-transit and out-for-delivery
 * into one OUT_FOR_DELIVERY bucket — fine for an order status, useless here, where "it has left
 * us" and "it arrives today" are the two different emails.
 *
 * The precedence is the same as that function's and matters for the same reason: RTO DELIVERED and
 * UNDELIVERED both contain the word DELIVERED and mean the customer did NOT get it. A cancellation
 * has its own email (sendOrderCancelledEmail) and a failed attempt has none — the courier simply
 * tries again, and mailing about it would alarm somebody about a parcel that is still coming.
 *
 * MANIFESTED is deliberately absent. Delhivery report it seconds after we book, while the box is
 * still on our counter, so treating it as "shipped" would promise a parcel had left when it had not.
 */
function mailMilestoneFor(carrierStatus) {
  const s = String(carrierStatus || '').toUpperCase();
  if (/RTO|CANCELL?ED|RETURN(ED)?/.test(s)) return null;
  if (/UN ?DELIVERED|NOT DELIVERED/.test(s)) return null;
  if (/DELIVERED/.test(s)) return 'DELIVERED';
  if (/OUT[ -]?FOR[ -]?DELIVERY/.test(s)) return 'OUT_FOR_DELIVERY';
  if (/IN ?TRANSIT|PICKED ?UP|DISPATCH|SHIPPED|BAGGED/.test(s)) return 'SHIPPED';
  return null;
}

/*
 * Tell the customer where their parcel is, at most once per milestone, ever.
 *
 * Called wherever a carrier status arrives — both poller branches and the hyperlocal webhook —
 * for the same reason applyCarrierTerminalStatus is: the rule for what a customer gets told should
 * not depend on which route happened to learn it.
 *
 * Never throws. A mail problem must not fail a sweep or a webhook; the worst outcome allowed here
 * is that one email is missed.
 */
export async function notifyOrderMilestone(order, carrierStatus) {
  try {
    const milestone = mailMilestoneFor(carrierStatus);
    if (!milestone) return null;

    /* Read the customer BEFORE claiming. A phone-OTP account can have no email at all — 127 of
       them do — and claiming a milestone we cannot send would silently retire it, so if that
       customer later added an address they would never receive the mail they were owed. */
    const c = await getOne(
      `SELECT o.order_number, o.tracking_url, u.email, u.name
         FROM orders o JOIN users u ON u.id = o.user_id
        WHERE o.id = $1`,
      [order.id],
    );
    if (!c?.email) return null;

    /*
     * Claim and gate in ONE statement, which is what makes this safe.
     *
     * The primary key stops two sweeps racing on the same milestone: both pass the NOT EXISTS, both
     * insert, one hits ON CONFLICT and returns nothing, so exactly one sends. The NOT EXISTS is the
     * ordering rule — it also refuses a milestone when a LATER one has already gone out.
     */
    const ahead = MAIL_MILESTONES.slice(MAIL_MILESTONES.indexOf(milestone));
    const claimed = await getOne(
      `INSERT INTO order_mail_log (order_id, milestone, sent_at)
       SELECT $1, $2, $3
        WHERE NOT EXISTS (SELECT 1 FROM order_mail_log
                           WHERE order_id = $1 AND milestone = ANY($4::text[]))
       ON CONFLICT (order_id, milestone) DO NOTHING
       RETURNING milestone`,
      [order.id, milestone, nowIso(), ahead],
    );
    if (!claimed) return null;

    try {
      await sendOrderMilestoneEmail({
        to: c.email,
        customerName: c.name,
        orderNumber: c.order_number,
        milestone,
        trackingUrl: c.tracking_url,
      });
      console.log(`[MAIL] ${c.order_number} | ${milestone} sent to ${String(c.email).replace(/(.).*(@.*)/, '$1***$2')}`);
      return milestone;
    } catch (e) {
      /* Hand the claim back. Sending is the only part that talks to a third party, so it is the
         only part likely to fail transiently, and a five-minute-later retry costs nothing. */
      await query('DELETE FROM order_mail_log WHERE order_id = $1 AND milestone = $2',
        [order.id, milestone]).catch(() => {});
      console.log(`[MAIL] ${c.order_number} | ${milestone} FAILED, will retry | ${(e as any)?.message || e}`);
      return null;
    }
  } catch (e: any) {
    console.log(`[MAIL] order=${order?.order_number || order?.id} | milestone check failed | ${e?.message || e}`);
    return null;
  }
}

