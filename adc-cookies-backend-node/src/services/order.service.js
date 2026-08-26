import { getOne, getAll, query, nowIso } from '../db/index.js';
import { sendOrderEmails } from './mailer.client.js';
import { storeByCode } from './store.service.js';
import { bookShipmentAndRelay } from './shipment.service.js';

/*
 * What happens to an order once the money is actually in.
 *
 * Lifted out of routes/orders.js in Phase B, unchanged. Three callers need it — the verify route,
 * the Razorpay redirect callback, and the Razorpay webhook — and the webhook was importing the
 * order ROUTER to reach it.
 *
 * The atomic PAID claim inside is the load-bearing part and is commented in place: Razorpay sends
 * payment.captured and order.paid milliseconds apart, and making the TRANSITION the contended
 * thing rather than the read before it is what stops an order getting two of everything.
 *
 * Depends on shipment.service, never the other way round.
 */

// Mark a PAID order: record the payment, log tracking, and auto-create the Delhivery shipment.
// Idempotent — safe to call from BOTH the verify route and the webhook (whichever lands first).
// `paymentEntity` is Razorpay's payment object (from fetchPayment or the webhook payload) —
// optional, but when present we pull the platform fee/tax/method/instrument details out of it
// so that data isn't only visible in the Razorpay dashboard.
export async function finalizePaidOrder(orderId, razorpayPaymentId, paymentEntity) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.payment_status === 'PAID') return { ok: true, alreadyPaid: true };

  const ts = nowIso();
  const p = paymentEntity || {};
  const razorpayFee = p.fee != null ? p.fee / 100 : null;
  const razorpayTax = p.tax != null ? p.tax / 100 : null;
  const method = p.method ?? null;
  const cardNetwork = p.card?.network ?? null;
  const cardLast4 = p.card?.last4 ?? null;
  const vpa = p.vpa ?? null;
  const bank = p.bank ?? null;

  /*
   * Claim the order atomically — the row decides who won, not the read above.
   *
   * The `payment_status === 'PAID'` check at the top of this function is a cheap short-circuit, not
   * a lock: it READS the status and this UPDATE WRITES it, and Razorpay sends `payment.captured`
   * and `order.paid` milliseconds apart. Both read "not paid", both proceeded, and the order got
   * two of everything — two CONFIRMED rows, two AWAITING_STORE_ACCEPT rows, two shipment attempts.
   * Seen on a real order: the webhook logged "marked PAID + shipment" twice, one second apart.
   *
   * Making the TRANSITION the contended thing rather than the read before it means exactly one
   * caller gets a row back; everyone else stops here having changed nothing.
   */
  const claim = await query(
    `UPDATE orders SET payment_status='PAID', order_status='CONFIRMED', updated_at=$1
      WHERE id=$2 AND payment_status IS DISTINCT FROM 'PAID' RETURNING id`,
    [ts, orderId]
  );
  if (claim.rowCount === 0) {
    console.log(`[PAYMENT] finalize | order=${order.order_number} | already_paid (lost the race, nothing written)`);
    return { ok: true, alreadyPaid: true };
  }

  /* A payment can land on an order we had already given up on — a shopper who closed the window and
     paid on a second device, a webhook arriving after an abandon, a retry that raced us. Money
     arriving outranks our assumption that none would, so the order comes back. Said out loud in the
     history, because "cancelled: payment not completed" followed by "confirmed" reads like a
     contradiction otherwise, and this is the line that explains it. */
  if (order.order_status === 'CANCELLED' || order.payment_status === 'CANCELLED') {
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [orderId, 'PAYMENT_RECEIVED_AFTER_CANCEL', 'Payment arrived after this order was closed as unpaid — reinstating it.', ts]).catch(() => {});
    console.log(`[PAYMENT] finalize | order=${order.order_number} | ⚠ was CANCELLED, reinstating on a real payment`);
  }
  await query(
    `INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at, razorpay_fee, razorpay_tax, method, card_network, card_last4, vpa, bank)
     VALUES ($1,'RAZORPAY',$2,$3,'PAID',$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [orderId, razorpayPaymentId ?? null, order.total_amount, ts, ts, razorpayFee, razorpayTax, method, cardNetwork, cardLast4, vpa, bank]
  );
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [orderId, 'CONFIRMED', 'Payment received via Razorpay', ts]);

  // Record coupon redemption now (on payment) — idempotent via the per-order check, so calling
  // finalizePaidOrder from both the verify route and the webhook can't double-count a use.
  if (order.coupon_code) {
    const already = await getOne('SELECT 1 FROM coupon_usage WHERE order_id = $1', [orderId]);
    if (!already) {
      const coupon = await getOne('SELECT id FROM coupons WHERE UPPER(code) = UPPER($1)', [order.coupon_code]);
      if (coupon) await query('INSERT INTO coupon_usage (coupon_id, user_id, order_id, used_at) VALUES ($1,$2,$3,$4)', [coupon.id, order.user_id, orderId, ts]);
    }
  }

  /*
   * Booking the courier is gated on WHO fulfils the order, decided at creation (store_code, set by
   * storeForAddress — zone/proximity only, no carrier call, so it's known immediately):
   *
   *   AUTO (Begur)   — the one outlet we relay to Petpooja ourselves and the only one with no manual
   *                    accept step. Book the same-day rider right away, exactly as before.
   *   MANUAL (every  — staff key the order into their OWN Petpooja terminal and hand it to whichever
   *   other store)     rider Shiprocket sends round; nothing here calls their kitchen a customer. A
   *                    same-day order booked before a human at that shop has even seen it is a rider
   *                    promise nobody there agreed to yet. So for these we leave the shipment
   *                    unbooked — order_tracking gets a row saying so, and the customer's "what's
   *                    next" copy reads it via order.store.acceptedAt — and POST /store/orders/:id/
   *                    accept books it the moment a real person there taps Accept.
   */
  /* The confirmation, now that there is something to confirm. Fire-and-forget: the money is taken
     and the row is already PAID, so a mail failure must not surface as a failed payment. Only the
     caller that won the claim above reaches this line, so it cannot be sent twice. */
  (async () => {
    const buyer = await getOne('SELECT name, email FROM users WHERE id = $1', [order.user_id]);
    if (!buyer?.email) return;
    const [mailItems, mailAddress] = await Promise.all([
      getAll('SELECT product_name, quantity, total_price FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]),
      order.address_id ? getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null,
    ]);
    await sendOrderEmails({
      orderNumber: order.order_number,
      subtotal: Number(order.subtotal) || 0,
      discount: Number(order.discount_amount) || 0,
      deliveryFee: Number(order.delivery_fee) || 0,
      total: Number(order.total_amount) || 0,
      customerName: buyer.name, customerEmail: buyer.email,
      items: mailItems.map((i) => ({ name: i.product_name, qty: i.quantity, total: Number(i.total_price) || 0 })),
      address: mailAddress,
    });
  })().catch((err) => console.error(`[ORDER] email send failed | order=${order.order_number} | ${err?.message || err}`));

  const assignedStore = storeByCode(order.store_code);
  if (assignedStore && assignedStore.posMode === 'MANUAL') {
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [orderId, 'AWAITING_STORE_ACCEPT', `Waiting for ${assignedStore.name} to accept the order`, ts]);
  } else {
    bookShipmentAndRelay(orderId);
  }

  return { ok: true };
}
