import { getAll, query, nowIso } from '../db/index.js';
import { fetchOrderPayments, razorpayConfigured } from '../services/razorpay.client.js';
import { finalizePaidOrder } from '../services/order.service.js';

/*
 * Ask Razorpay how every unfinished checkout actually ended, instead of waiting for a browser.
 *
 * An order row is created BEFORE Razorpay opens, at PLACED/PENDING, because Razorpay needs our
 * order number as its receipt and that row is what a payment later reconciles against. PENDING is
 * therefore meant to last minutes and always resolve. Three things could resolve it, and all three
 * depend on something outside our control:
 *
 *   the verify call   - the customer's browser, after a successful payment
 *   the webhook       - Razorpay, on payment.captured / order.paid
 *   /orders/:id/abandon - the customer's browser, and ONLY from Razorpay's ondismiss
 *
 * So an order sat at PLACED/PENDING for ever whenever none of them fired. ADC20260907110544 is the
 * worked example: the customer reached the payment step, navigated BACK to add a coupon rather than
 * closing the window, and paid on a second order seven minutes later. ondismiss never ran. The
 * payment.failed webhook did arrive and wrote its PAYMENT_FAILED note, but that handler only records
 * the attempt on the timeline - deliberately, because Razorpay sends payment.failed per ATTEMPT and
 * a customer whose card is declined may pay by UPI seconds later. A failed attempt is not a dead
 * order. Nothing ever came back afterwards to say the checkout was over.
 *
 * The consequences ran both ways, and the second is the dangerous one:
 *
 *   phantom orders - never cancelled, so never counted as dead. isDeadOrder() tests
 *                    order_status === 'CANCELLED', so a PLACED row sits in the live Orders list and
 *                    in every count, and can never reach the panel titled "Cancelled & failed
 *                    payments" - which cannot show a failed payment at all.
 *   money taken, order not - a captured payment whose verify call AND webhook both went missing
 *                    stayed PENDING for ever. Nothing shipped, no confirmation went out, and no
 *                    screen said anything was wrong.
 *
 * This makes Razorpay the authority. It is the same question the verify route asks, on a timer
 * rather than on a click.
 */

/*
 * How long a checkout is allowed to be "in progress".
 *
 * Razorpay Checkout sessions expire well inside this, and the customer above had started a second
 * order after seven minutes. Twenty is comfortably past any real attempt while still resolving an
 * order the same hour it was placed - it must not be so long that an admin sees a phantom order on
 * the board before we have made our minds up about it.
 */
const WINDOW_MIN = Number(process.env.PAYMENT_RECONCILE_WINDOW_MIN || 20);
const SWEEP_MS = Number(process.env.PAYMENT_RECONCILE_MS || 5 * 60_000);
const BATCH = Number(process.env.PAYMENT_RECONCILE_BATCH || 20);
/* Past this nobody is going to pay, and Razorpay has long since expired the order. Bounded for the
   same reason the carrier poller is: an unanswerable row must not consume a slot for ever. */
const MAX_AGE_DAYS = Number(process.env.PAYMENT_RECONCILE_MAX_AGE_DAYS || 7);

const CANCEL_REMARK = 'Payment not completed — checkout was closed before paying.';

async function dueOrders() {
  return getAll(
    `SELECT id, order_number, razorpay_order_id, total_amount, created_at
       FROM orders
      WHERE payment_status = 'PENDING'
        AND order_status NOT IN ('CANCELLED','DELIVERED')
        AND created_at < now() - make_interval(mins => $1::int)
        AND created_at > now() - make_interval(days => $2::int)
      ORDER BY created_at ASC
      LIMIT $3`,
    [WINDOW_MIN, MAX_AGE_DAYS, BATCH],
  );
}

/*
 * Close an unpaid checkout, in the words /abandon already uses.
 *
 * Same remark on purpose: the customer's tracking sheet renders these rows, and an order closed by
 * this sweep must read identically to one closed by the browser. Whether ondismiss happened to fire
 * is our implementation detail, not something to explain to them in two different sentences.
 *
 * The WHERE re-checks PENDING. Between reading the row and writing it a real payment may have
 * landed through verify or the webhook, and this must lose that race rather than cancel a paid order.
 */
async function closeUnpaid(order, why: string) {
  const ts = nowIso();
  const { rowCount } = await query(
    `UPDATE orders SET payment_status = 'CANCELLED', order_status = 'CANCELLED', updated_at = $1
      WHERE id = $2 AND payment_status = 'PENDING'`,
    [ts, order.id],
  );
  if (!rowCount) {
    console.log(`[PAYRECON] ${order.order_number} | skipped — no longer PENDING`);
    return;
  }
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'CANCELLED', CANCEL_REMARK, ts]).catch(() => {});
  console.log(`[PAYRECON] ${order.order_number} | cancelled unpaid | ${why}`);
}

async function reconcileOne(order) {
  /*
   * No Razorpay order id means Checkout was never even opened: the basket was submitted and the
   * customer left before the payment step. There is nothing to ask about, and nothing was charged.
   */
  if (!order.razorpay_order_id) {
    await closeUnpaid(order, 'never reached Razorpay');
    return;
  }

  const r = await fetchOrderPayments(order.razorpay_order_id);
  /* Their API being unreachable is not evidence of anything. Leave the order alone and ask again on
     the next sweep — cancelling on a network error is how a paid order gets closed. */
  if (!r.ok) {
    console.log(`[PAYRECON] ${order.order_number} | could not ask Razorpay (${r.reason}) — leaving PENDING`);
    return;
  }

  /*
   * `captured` is the only status that means the money is ours. `authorized` is a hold that has not
   * been taken and expires on its own, so it is deliberately NOT treated as paid — settling it
   * would need a capture call, which is a decision for a person, not a sweep.
   */
  const captured = (r.items || []).filter((p) => p.status === 'captured');
  if (captured.length) {
    /*
     * The rescue path, and the reason this job earns its keep. A captured payment whose verify call
     * and webhook both went missing left the money taken and the order unshipped for ever.
     *
     * finalizePaidOrder is the same function verify and the webhook call, so this order gets the
     * identical treatment: the confirmation email, the coupon redemption, the courier booking and
     * the POS relay, all behind its one atomic PAID claim — which is also what stops this sweep
     * doing any of it twice if verify lands at the same moment.
     */
    const p = captured[0];
    const res = await finalizePaidOrder(order.id, p.id, p);
    console.log(`[PAYRECON] ${order.order_number} | ✓ RESCUED — captured payment ${p.id} found at Razorpay${res?.alreadyPaid ? ' (already finalised)' : ''}`);
    if (captured.length > 1) {
      await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
        [order.id, 'DUPLICATE_CHARGE_WARNING', `⚠ ${captured.length} captured payments found against this order — possible duplicate charge, review in Razorpay dashboard`, nowIso()]).catch(() => {});
    }
    return;
  }

  const failed = (r.items || []).length;
  await closeUnpaid(order, failed ? `${failed} attempt(s), none captured` : 'no payment attempted');
}

async function sweep() {
  try {
    if (!razorpayConfigured()) return;
    const orders = await dueOrders();
    if (!orders.length) return;
    // Sequential: Razorpay rate-limits, and nothing is waiting on this.
    for (const o of orders) {
      await reconcileOne(o).catch((e) => console.log(`[PAYRECON] ${o.order_number} | ✗ ${e?.message || e}`));
    }
  } catch (e: any) {
    console.log(`[PAYRECON] sweep failed: ${e?.message || e}`);
  }
}

export function startPaymentReconciler() {
  if (SWEEP_MS <= 0) { console.log('[PAYRECON] disabled (PAYMENT_RECONCILE_MS=0)'); return; }
  if (!razorpayConfigured()) { console.log('[PAYRECON] disabled — Razorpay is not configured'); return; }
  console.log(`[PAYRECON] unpaid checkouts resolved against Razorpay every ${Math.round(SWEEP_MS / 1000)}s, after ${WINDOW_MIN} min, up to ${BATCH} a sweep`);
  // Slightly after the carrier poller's first sweep, so a restart does not fire both at once.
  setTimeout(() => void sweep(), 40_000).unref?.();
  setInterval(() => void sweep(), SWEEP_MS).unref?.();
}
