import { getOne, query, nowIso } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';
import { createRefund, fetchOrderPayments, fetchPayment } from './razorpay.client.js';
import { cancelShiprocketOrder } from './shiprocket.client.js';
import { cancelShipment, delhiveryConfigured } from './delhivery.client.js';
import { cancelOrder as petpoojaCancelOrder } from './petpooja.client.js';
import { sendOtp, validateOtp, messageCentralConfigured } from './messageCentral.client.js';
import { sendOrderCancelledEmail, sendRefundIssuedEmail } from './mailer.client.js';

/*
 * Why money is going back. The admin picks one; the customer is told the matching sentence.
 *
 * Only ORDER_CANCELLED stops the order. Every other reason is money back on an order that carries
 * on (or already arrived): a damaged box, a missing cookie, a late rider. Those are usually part of
 * the payment, so they take an amount; a cancellation always refunds whatever is left.
 */
export const REFUND_REASONS = {
  ORDER_CANCELLED: { label: 'Order cancelled', cancels: true, customerLine: 'We had to cancel your order.' },
  DAMAGED: { label: 'Damaged product', cancels: false, customerLine: 'Part of your order reached you damaged.' },
  MISSING_ITEM: { label: 'Missing item', cancels: false, customerLine: 'Something was missing from your order.' },
  WRONG_ITEM: { label: 'Wrong item sent', cancels: false, customerLine: 'We sent you the wrong item.' },
  LATE_DELIVERY: { label: 'Late delivery', cancels: false, customerLine: 'Your order reached you later than it should have.' },
  OTHER: { label: 'Something else', cancels: false, customerLine: '' },
} as const;
export type RefundReasonCode = keyof typeof REFUND_REASONS;

// Payment rows that may still have money on them to send back. A failed refund moved nothing, so
// it can be tried again; Razorpay's own figures (refundState) decide how much is actually left.
const REFUNDABLE_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUND_FAILED'];

/*
 * Cancel an order and refund it, behind a one-time code.
 *
 * This is the only code in the system that moves money OUT, and it does so irreversibly: a Razorpay
 * refund cannot be recalled. Two doors lead here and both need a code:
 *
 *   - the admin dashboard, where the code goes to the admin's own phone (the one that signed in);
 *   - the store portal, where the code goes to the COMPANY number. A counter cannot approve its own
 *     refund: staff ring the office, the office reads them the code, and that call is the approval.
 *
 * Neither door lets the request choose the phone. The challenge is bound to one caller AND one
 * order, so a code issued to cancel a ₹60 order cannot be replayed against a ₹6,000 one, and it is
 * consumed the moment it succeeds.
 */

/* Challenges live in memory deliberately: they last five minutes, they must not survive a restart,
   and a refund authorisation is not something to leave lying in a table. A restart simply means
   asking for a fresh code. Keyed by caller+order so two callers, or two orders, never collide. */
const challenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

/*
 * Orders with a cancellation already running.
 *
 * Two requests carrying the same valid code can both pass the challenge check before either
 * finishes — the code check awaits an HTTP call to Message Central, and everything after it moves
 * money. Node runs one turn at a time, so claiming the order SYNCHRONOUSLY, with no await between
 * the has() and the add(), makes the second request lose cleanly rather than issue a second refund
 * against the same payment.
 */
const inFlight = new Set();

const keyFor = (callerKey, orderId) => `${callerKey}:${orderId}`;

function sweep() {
  const now = Date.now();
  for (const [k, v] of challenges) if (v.expiresAt <= now) challenges.delete(k);
}

/** Loads the order and refuses the ones a refund must never touch. `where` narrows it (a store's own orders). */
export async function loadCancellable(orderId, where?: { storeCode: string }) {
  const order = where
    ? await getOne('SELECT * FROM orders WHERE id = $1 AND store_code = $2', [orderId, where.storeCode])
    : await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.order_status === 'CANCELLED') throw new ApiError('This order is already cancelled.', 409);
  if (order.order_status === 'DELIVERED') throw new ApiError('This order was delivered — refunding it is a goodwill decision, not a cancellation. Do it in the Razorpay dashboard so it is recorded as such.', 409);
  return order;
}

/*
 * Sends the code to `phone` (a normalizePhone() result) and remembers the challenge.
 *
 * `intent` is what the code will authorise, fixed at the moment it is sent. For a refund that
 * includes the amount, so a code sent to approve ₹50 back cannot be spent on ₹5,000: whoever reads
 * the code out over the phone is approving the figure that was on the screen when it was asked for.
 */
export type CodeIntent =
  | { kind: 'cancel' }
  | { kind: 'refund'; amountPaise: number; reasonCode: RefundReasonCode; note: string };

export async function issueCancelCode({ callerKey, order, phone, intent = { kind: 'cancel' } }: {
  callerKey: string; order: any; phone: any; intent?: CodeIntent;
}) {
  if (!messageCentralConfigured()) throw new ApiError('SMS is not configured on this environment, so refunds cannot be authorised here.', 503);
  const r = await sendOtp(phone.national);
  if (!r.ok) throw new ApiError(r.message || 'Could not send the verification code.', 502);
  sweep();
  challenges.set(keyFor(callerKey, order.id), {
    verificationId: r.verificationId,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    attempts: 0,
    intent,
  });
  return { sent: true, phoneHint: `••••••${phone.national.slice(-4)}`, expiresInSeconds: CHALLENGE_TTL_MS / 1000 };
}

/*
 * Checks the code, and runs `work` only if it is right, for this order and this kind of request.
 *
 * The order is claimed before the first await. Everything past this point spends money, and this is
 * the last moment at which two requests are still guaranteed not to be interleaved.
 */
async function withCode<T>({ callerKey, order, code, kind, by, logTag }, work: (intent: CodeIntent) => Promise<T>): Promise<T> {
  if (!code) throw new ApiError('Enter the verification code.');
  const key = keyFor(callerKey, order.id);
  const challenge = challenges.get(key);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    challenges.delete(key);
    throw new ApiError('That code has expired. Request a new one.', 401);
  }
  if (challenge.intent?.kind !== kind) throw new ApiError('That code was sent for a different action. Request a new one.', 409);
  if (challenge.attempts >= MAX_ATTEMPTS) {
    challenges.delete(key);
    throw new ApiError('Too many wrong codes. Request a new one.', 429);
  }
  if (inFlight.has(order.id)) throw new ApiError('A refund on this order is already running. Give it a moment.', 409);
  inFlight.add(order.id);
  try {
    challenge.attempts += 1;
    const v = await validateOtp(challenge.verificationId, code);
    if (!v.ok) throw new ApiError(v.message || 'That code is not right.', 401);
    // Consumed. A correct code authorises exactly one action on exactly this order.
    challenges.delete(key);
    console.log(`[${logTag}] authorised ${kind} | order=${order.order_number} | by=${by}`);
    return await work(challenge.intent);
  } finally {
    inFlight.delete(order.id);
  }
}

/*
 * Checks the code, then cancels and refunds.
 *
 * Order of operations is deliberate. The carrier and the POS are cancelled BEFORE the money moves,
 * because a refunded order with a rider still coming is worse than a cancelled booking on an order
 * still holding its payment: the first loses the cookies and the money, the second is recoverable
 * by pressing this again.
 */
export async function cancelWithCode({ callerKey, order, code, reason, by, logTag }) {
  if (!reason) throw new ApiError('Give the customer a reason — it is shown to them and recorded on the order.');
  if (reason.length > 300) throw new ApiError('Keep the reason under 300 characters.');
  return withCode({ callerKey, order, code, kind: 'cancel', by, logTag },
    () => performCancellation({ order, reason, by, logTag }));
}

/*
 * Checks the code, then refunds the amount it was sent for. The order itself is left alone.
 *
 * This is the damaged box, the missing cookie, the rider who took three hours. It is also how a
 * paid order that was cancelled WITHOUT a refund (a store cancel from before stores needed a code)
 * gets its money back, under the ORDER_CANCELLED reason.
 */
export async function refundWithCode({ callerKey, order, code, by, logTag }) {
  return withCode({ callerKey, order, code, kind: 'refund', by, logTag }, (intent) => {
    if (intent.kind !== 'refund') throw new ApiError('That code was sent for a different action.', 409);
    return performRefund({ order, amountPaise: intent.amountPaise, reasonCode: intent.reasonCode, note: intent.note, by, logTag });
  });
}

/** Checks a refund request before a code is sent for it. Returns the intent the code will carry. */
export function refundIntent({ reasonCode, amount, note }): CodeIntent {
  const reason = REFUND_REASONS[reasonCode as RefundReasonCode];
  if (!reason) throw new ApiError('Pick a reason for the refund.');
  const text = String(note || '').trim();
  if (text.length > 300) throw new ApiError('Keep the note under 300 characters.');
  if (!reason.customerLine && !text) throw new ApiError('Write a line for the customer. With "something else" it is the only reason they see.');
  const amountPaise = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) throw new ApiError('Enter an amount of at least ₹1.');
  return { kind: 'refund', amountPaise, reasonCode: reasonCode as RefundReasonCode, note: text };
}

/*
 * What Razorpay holds for this order: paid, already refunded, and what is left. In paise, straight
 * from Razorpay, because our own amount_refunded only moves when a webhook lands and a second
 * refund decided on a stale figure is the one mistake here that costs real money.
 */
export async function refundState(order) {
  const paymentId = await resolvePaymentId(order);
  if (!paymentId) return { paymentId: null, paidPaise: 0, refundedPaise: 0, refundablePaise: 0 };
  const r = await fetchPayment(paymentId);
  if (!r.ok) throw new ApiError(`Could not read the payment from Razorpay: ${r.reason}`, 502);
  const p = r.payment;
  const paidPaise = p.status === 'captured' || p.status === 'refunded' ? Number(p.amount) || 0 : 0;
  const refundedPaise = Number(p.amount_refunded) || 0;
  return { paymentId, paidPaise, refundedPaise, refundablePaise: Math.max(0, paidPaise - refundedPaise) };
}

/** Loads an order for a refund-only request. Any status: a delivered order is exactly where most of these happen. */
export async function loadRefundable(orderId) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.payment_status !== 'PAID') throw new ApiError('Nothing was paid on this order, so there is nothing to refund.', 409);
  return order;
}

/*
 * Claims the payment row for one refund, in the database rather than in this process.
 *
 * The in-process guard stops two requests on one server; it cannot stop two servers. Whoever flips
 * the row to REFUNDING is the only caller that reaches Razorpay. The previous status comes back so a
 * failed refund can hand the row back exactly as it was.
 */
async function claimPayment(orderId): Promise<{ id: number; prev: string } | null> {
  const r = await query(
    `UPDATE payments p SET status = 'REFUNDING'
       FROM (SELECT id, status AS prev FROM payments
              WHERE order_id = $1 AND status = ANY($2) ORDER BY id DESC LIMIT 1 FOR UPDATE) s
      WHERE p.id = s.id
      RETURNING p.id, s.prev`,
    [orderId, REFUNDABLE_STATUSES]
  );
  return (r.rows?.[0] as { id: number; prev: string } | undefined) || null;
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Refund part (or all) of a payment without touching the order. */
async function performRefund({ order, amountPaise, reasonCode, note, by, logTag }) {
  const reason = REFUND_REASONS[reasonCode as RefundReasonCode];
  if (!reason) throw new ApiError('Pick a reason for the refund.');

  const state = await refundState(order);
  if (!state.paymentId) throw new ApiError('No Razorpay payment found on this order. Refund it by hand in their dashboard.', 409);
  if (amountPaise > state.refundablePaise) {
    throw new ApiError(`Only ${rupees(state.refundablePaise)} is left to refund on this order.`, 409);
  }

  const claim = await claimPayment(order.id);
  if (!claim) throw new ApiError('A refund on this order is already running, or it is fully refunded.', 409);

  const r = await createRefund(state.paymentId, {
    amountPaise,
    notes: { order: order.order_number, reason: reasonCode, ...(note ? { note: note.slice(0, 200) } : {}) },
  });
  if (!r.ok) {
    // Hand the claim back so a retry is possible. The money never moved.
    await query("UPDATE payments SET status = $1 WHERE id = $2 AND status = 'REFUNDING'", [claim.prev, claim.id]).catch(() => {});
    throw new ApiError(`Razorpay refused the refund: ${String(r.reason).slice(0, 200)}`, 502);
  }

  const refund = r.refund;
  const full = state.refundedPaise + amountPaise >= state.paidPaise;
  await query('UPDATE payments SET status = $1 WHERE id = $2', [full ? 'REFUNDED' : 'PARTIALLY_REFUNDED', claim.id]).catch(() => {});

  const ts = nowIso();
  const remark = [`${full ? 'Full' : 'Partial'} refund of ${rupees(amountPaise)} by ${by}`, reason.label, note].filter(Boolean).join(' — ');
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'REFUND_ISSUED', `${remark} (${refund?.id || 'accepted'})`, ts]).catch(() => {});
  console.log(`[${logTag}] refund | order=${order.order_number} | ${rupees(amountPaise)} | ${reasonCode} | refund=${refund?.id}`);

  const customer = await getOne('SELECT email FROM users WHERE id = $1', [order.user_id]).catch(() => null);
  if (customer?.email) {
    sendRefundIssuedEmail({
      to: customer.email,
      orderNumber: order.order_number,
      amount: rupees(amountPaise),
      paid: rupees(state.paidPaise),
      full,
      refundId: refund?.id || '',
      customerLine: reason.customerLine,
      note,
    }).catch((e) => console.log(`[${logTag}] refund email failed | order=${order.order_number} | ${e?.message || e}`));
  }

  return {
    ok: true, cancelled: false, refunded: true, refundId: refund?.id || null,
    notes: [`Refunded ${rupees(amountPaise)} to the customer's ${full ? 'account — the payment is now fully refunded' : 'account'}. Razorpay settles it in 5-7 working days.`],
  };
}

/** Everything after the code checks out. */
async function performCancellation({ order, reason, by, logTag }) {
  const ts = nowIso();
  const notes: any[] = [];

  /*
   * Whether each downstream cancel actually SUCCEEDED, so step 4 can record it.
   *
   * This used to be written only into a sentence in the history. Nothing updated the columns other
   * screens read, so shipment_status stayed on the carrier's last word and relay_ok stayed true —
   * and the Razorpay refund webhook, which reads exactly those, then announced the order still had
   * a live courier booking and a live POS ticket. It said so on the same order, in the same
   * timeline, seconds after this function wrote that both were cancelled.
   */
  let carrierCancelled = false;
  let posCancelled = false;

  // ---- 1. carrier ----
  if (order.carrier === 'SHIPROCKET' && order.carrier_order_id) {
    const r = await cancelShiprocketOrder(order.carrier_order_id).catch((e) => ({ ok: false, reason: e?.message }));
    carrierCancelled = !!r.ok;
    notes.push(r.ok ? 'Shiprocket booking cancelled.' : `⚠ Shiprocket refused to cancel: ${String(r.reason).slice(0, 160)}`);
  } else if (order.delhivery_waybill && delhiveryConfigured()) {
    const r = await cancelShipment(order.delhivery_waybill).catch((e) => ({ ok: false, reason: e?.message }));
    carrierCancelled = !!r.ok;
    notes.push(r.ok ? 'Delhivery booking cancelled.' : `⚠ Delhivery refused to cancel: ${String(r.reason).slice(0, 160)}`);
  }

  // ---- 2. POS ----
  const posRow = await getOne('SELECT 1 FROM petpooja_orders WHERE order_id = $1 AND relay_ok = TRUE', [order.id]);
  if (posRow) {
    const r = await petpoojaCancelOrder(order.order_number, reason).catch((e) => ({ ok: false, reason: e?.message }));
    posCancelled = !!r?.ok;
    notes.push(r?.ok ? 'Petpooja ticket cancelled.' : '⚠ Petpooja ticket may still be open — check their dashboard.');
  }

  // ---- 3. money ----
  let refund: any = null;
  if (order.payment_status === 'PAID') {
    /* Ask Razorpay what it actually captured rather than trusting our own row. With nothing
       refunded yet, `amount` is left out and Razorpay refunds the full captured value itself.
       After a partial refund, the remainder is sent explicitly, in Razorpay's own paise, because
       "the full amount" would then be more than is left and Razorpay would refuse it. */
    const state = await refundState(order).catch((e) => ({ error: e?.message || String(e) }));
    if ('error' in state) {
      notes.push(`⚠ ${state.error} — no refund issued. Refund it by hand in the Razorpay dashboard.`);
    } else if (!state.paymentId) {
      notes.push('⚠ No Razorpay payment id on this order — refund it by hand in their dashboard.');
    } else if (state.refundablePaise <= 0) {
      notes.push('Already fully refunded — no second refund issued.');
    } else {
      const claim = await claimPayment(order.id);
      if (!claim) {
        notes.push('Already refunded (or a refund is already running) — no second refund issued.');
      } else {
        const r = await createRefund(state.paymentId, {
          ...(state.refundedPaise > 0 ? { amountPaise: state.refundablePaise } : {}),
          notes: { order: order.order_number, reason: reason.slice(0, 200) },
        });
        if (r.ok) {
          refund = r.refund;
          await query("UPDATE payments SET status='REFUNDED' WHERE id = $1", [claim.id]).catch(() => {});
          notes.push(`Refund of ${rupees(state.refundablePaise)} issued to source — ${refund?.id || 'accepted'}. Razorpay settles it in 5-7 working days.`);
        } else {
          // Hand the claim back so a retry is possible — the money never moved.
          await query("UPDATE payments SET status = $1 WHERE id = $2 AND status = 'REFUNDING'", [claim.prev, claim.id]).catch(() => {});
          notes.push(`⚠ Refund FAILED: ${String(r.reason).slice(0, 200)} — issue it by hand in the Razorpay dashboard.`);
        }
      }
    }
  } else {
    notes.push('Nothing was captured for this order, so there is nothing to refund.');
  }

  // ---- 4. our own state, last: it is what every other screen reads ----
  await query("UPDATE orders SET order_status='CANCELLED', updated_at=$1 WHERE id=$2", [ts, order.id]);

  /*
   * Record the downstream outcomes in the COLUMNS, not only in the sentence above.
   *
   * Only when the cancel actually succeeded — a carrier that refused must keep its real status, or
   * this would paper over a booking that is genuinely still live, which is the one thing the
   * warning exists to catch.
   *
   * Note the carrier's own vocabulary is no use here: Delhivery reports a cancelled manifest as
   * "Not Picked", never "CANCELLED", so the only reliable record is ours.
   */
  if (carrierCancelled) {
    await query("UPDATE orders SET shipment_status='CANCELLED', updated_at=$1 WHERE id=$2", [ts, order.id])
      .catch(() => {});
  }
  if (posCancelled) {
    await query("UPDATE petpooja_orders SET petpooja_status='CANCELLED', updated_at=$1 WHERE order_id=$2", [ts, order.id])
      .catch(() => {});
  }
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'CANCELLED', `Cancelled by ${by} — ${reason}`, ts]);
  if (notes.length) {
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, 'CANCEL_DETAIL', notes.join(' '), ts]).catch(() => {});
  }
  console.log(`[${logTag}] done | order=${order.order_number} | ${notes.join(' | ')}`);

  /* Best-effort, and last: the customer being told is important, but a mail failure must not make
     this look like the cancellation did not happen when the money has already moved. The address
     comes off the user row — the order itself does not carry one. */
  const customer = await getOne('SELECT email FROM users WHERE id = $1', [order.user_id]).catch(() => null);
  if (customer?.email) {
    sendOrderCancelledEmail({
      // What actually went back this time, which is less than the total after an earlier partial refund.
      order: { orderNumber: order.order_number, totalAmount: refund?.amount != null ? refund.amount / 100 : order.total_amount, customerEmail: customer.email },
      reason,
      refunded: !!refund,
    }).catch((e) => console.log(`[${logTag}] cancel email failed | order=${order.order_number} | ${e?.message || e}`));
  }

  return { ok: true, cancelled: true, refunded: !!refund, refundId: refund?.id || null, notes };
}

/** The captured payment to refund — ours if we stored it, otherwise Razorpay's own record. */
async function resolvePaymentId(order) {
  // Any status: after a partial refund the row is no longer PAID, but it is still the same payment.
  const row = await getOne("SELECT transaction_id FROM payments WHERE order_id = $1 AND transaction_id LIKE 'pay\\_%' ORDER BY id DESC LIMIT 1", [order.id]);
  if (row?.transaction_id) return row.transaction_id;
  if (!order.razorpay_order_id) return null;
  const r = await fetchOrderPayments(order.razorpay_order_id).catch(() => null);
  const captured = (r?.items || []).find((p) => p.status === 'captured');
  return captured?.id || null;
}
