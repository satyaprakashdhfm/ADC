import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getOne, query, nowIso } from '../../db/index.js';
import { ApiError } from '../../middlewares/auth.middleware.js';
import { createRefund, fetchOrderPayments } from '../../services/razorpay.client.js';
import { cancelShiprocketOrder } from '../../services/shiprocket.client.js';
import { cancelShipment, delhiveryConfigured } from '../../services/delhivery.client.js';
import { cancelOrder as petpoojaCancelOrder } from '../../services/petpooja.service.js';
import { normalizePhone, sendOtp, validateOtp, messageCentralConfigured } from '../../services/messageCentral.client.js';
import { sendOrderCancelledEmail } from '../../services/mailer.client.js';

/*
 * Cancel an order and refund it, behind a one-time code sent to the admin's own phone.
 *
 * This is the only endpoint in the system that moves money OUT, and it does so irreversibly: a
 * Razorpay refund cannot be recalled. Admin session alone is not enough of a gate for that — a
 * borrowed laptop with an open tab would be — so the code goes to the number on the ADMIN'S OWN
 * USER ROW, never to a number supplied in the request. An attacker holding the session still
 * cannot choose where the challenge lands.
 *
 * The challenge is bound to one admin AND one order, so a code issued to cancel a ₹60 order cannot
 * be replayed against a ₹6,000 one, and it is consumed the moment it succeeds.
 */

const router = Router();

/* Challenges live in memory deliberately: they last two minutes, they must not survive a restart,
   and a refund authorisation is not something to leave lying in a table. A restart simply means
   asking for a fresh code. Keyed by admin+order so two admins, or two orders, never collide. */
const challenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

/*
 * Orders with a cancellation already running.
 *
 * Two requests carrying the same valid code can both pass the challenge check before either
 * finishes — the code check awaits an HTTP call to Message Central, and everything after it moves
 * money. Node runs one turn at a time, so claiming the order SYNCHRONOUSLY here, with no await
 * between the has() and the add(), makes the second request lose cleanly rather than issue a second
 * refund against the same payment.
 */
const inFlight = new Set();

const keyFor = (adminId, orderId) => `${adminId}:${orderId}`;

function sweep() {
  const now = Date.now();
  for (const [k, v] of challenges) if (v.expiresAt <= now) challenges.delete(k);
}

// Sending costs an SMS and a refund is a rare action — a generous limit still stops a loop.
const otpLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts', message: 'Too many verification codes requested. Try again in 15 minutes.' },
});

/*
 * The admin's own phone, taken from their admin session. Never off the request body.
 *
 * This used to read the phone off a users row matched on the token's email. It now comes from the
 * session, which is a stronger guarantee for exactly this purpose: it is the number that received
 * the OTP to open the dashboard in the first place, so the refund code goes back to the same phone
 * that authenticated.
 *
 * adminLabel is what goes in logs. The full number there is a privacy leak, not an audit trail.
 */
async function adminPhone(req) {
  const phone = normalizePhone(req.admin?.phone);
  if (!phone) throw new ApiError('Your admin session has no valid mobile number, so a refund cannot be authorised.', 409);
  return {
    adminId: phone.national,                 // stable per admin; the challenge key needs no more
    adminName: req.admin.name,
    adminLabel: '****' + phone.national.slice(-4),
    phone,
  };
}

/** Loads the order and refuses the ones a refund must never touch. */
async function loadCancellable(orderId) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) throw new ApiError('Order not found', 404);
  if (order.order_status === 'CANCELLED') throw new ApiError('This order is already cancelled.', 409);
  if (order.order_status === 'DELIVERED') throw new ApiError('This order was delivered — refunding it is a goodwill decision, not a cancellation. Do it in the Razorpay dashboard so it is recorded as such.', 409);
  return order;
}

/*
 * POST /orders/:id/cancel/request-code
 * Sends the code. Tells the caller which number it went to, masked — enough to know the right
 * phone is ringing, not enough to disclose the number to a session that did not already know it.
 */
router.post('/orders/:id/cancel/request-code', otpLimiter, async (req, res) => {
  if (!messageCentralConfigured()) throw new ApiError('SMS is not configured on this environment, so refunds cannot be authorised here.', 503);
  const order = await loadCancellable(req.params.id);
  const { adminId, adminLabel, phone } = await adminPhone(req);

  const r = await sendOtp(phone.national);
  if (!r.ok) throw new ApiError(r.message || 'Could not send the verification code.', 502);

  sweep();
  challenges.set(keyFor(adminId, order.id), {
    verificationId: r.verificationId,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    attempts: 0,
  });
  console.log(`[ADMIN-CANCEL] code sent | order=${order.order_number} | admin=${adminLabel}`);
  res.json({ sent: true, phoneHint: `••••••${phone.national.slice(-4)}`, expiresInSeconds: CHALLENGE_TTL_MS / 1000 });
});

/*
 * POST /orders/:id/cancel  { reason, code }
 *
 * Order of operations is deliberate. The carrier and the POS are cancelled BEFORE the money moves,
 * because a refunded order with a rider still coming is worse than a cancelled booking on an order
 * still holding its payment: the first loses the cookies and the money, the second is recoverable
 * by pressing this again.
 */
router.post('/orders/:id/cancel', async (req, res) => {
  const order = await loadCancellable(req.params.id);
  const { adminId, adminLabel, phone } = await adminPhone(req);
  const reason = String(req.body?.reason || '').trim();
  const code = String(req.body?.code || '').trim();
  if (!reason) throw new ApiError('Give the customer a reason — it is shown to them and recorded on the order.');
  if (reason.length > 300) throw new ApiError('Keep the reason under 300 characters.');
  if (!code) throw new ApiError('Enter the code sent to your phone.');

  // ---- authorise ----
  const key = keyFor(adminId, order.id);
  const challenge = challenges.get(key);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    challenges.delete(key);
    throw new ApiError('That code has expired. Request a new one.', 401);
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    challenges.delete(key);
    throw new ApiError('Too many wrong codes. Request a new one.', 429);
  }
  /* Claim the order before the first await. Everything past this point spends money, and this is
     the last moment at which two requests are still guaranteed not to be interleaved. */
  if (inFlight.has(order.id)) throw new ApiError('This order is already being cancelled — give it a moment.', 409);
  inFlight.add(order.id);
  try {
    challenge.attempts += 1;
    const v = await validateOtp(challenge.verificationId, code);
    if (!v.ok) throw new ApiError(v.message || 'That code is not right.', 401);
    // Consumed. A correct code authorises exactly one cancellation of exactly this order.
    challenges.delete(key);
    console.log(`[ADMIN-CANCEL] authorised | order=${order.order_number} | admin=${adminLabel}`);
    return await performCancellation({ res, order, reason });
  } finally {
    inFlight.delete(order.id);
  }
});

/** Everything after the code checks out. Split so the guard above reads as one unbroken claim. */
async function performCancellation({ res, order, reason }) {

  const ts = nowIso();
  const notes = [];

  // ---- 1. carrier ----
  if (order.carrier === 'SHIPROCKET' && order.carrier_order_id) {
    const r = await cancelShiprocketOrder(order.carrier_order_id).catch((e) => ({ ok: false, reason: e?.message }));
    notes.push(r.ok ? 'Shiprocket booking cancelled.' : `⚠ Shiprocket refused to cancel: ${String(r.reason).slice(0, 160)}`);
  } else if (order.delhivery_waybill && delhiveryConfigured()) {
    const r = await cancelShipment(order.delhivery_waybill).catch((e) => ({ ok: false, reason: e?.message }));
    notes.push(r.ok ? 'Delhivery booking cancelled.' : `⚠ Delhivery refused to cancel: ${String(r.reason).slice(0, 160)}`);
  }

  // ---- 2. POS ----
  const posRow = await getOne('SELECT 1 FROM petpooja_orders WHERE order_id = $1 AND relay_ok = TRUE', [order.id]);
  if (posRow) {
    const r = await petpoojaCancelOrder(order.order_number, reason).catch((e) => ({ ok: false, reason: e?.message }));
    notes.push(r?.ok ? 'Petpooja ticket cancelled.' : '⚠ Petpooja ticket may still be open — check their dashboard.');
  }

  // ---- 3. money ----
  let refund = null;
  if (order.payment_status === 'PAID') {
    /* Ask Razorpay what it actually captured rather than trusting our own row, and let Razorpay
       compute the amount: sending an explicit figure invites an off-by-one between our rupees and
       their paise on exactly the operation where that is unforgivable. Omitting `amount` refunds
       the full captured value. */
    const paymentId = await resolvePaymentId(order);
    if (!paymentId) {
      notes.push('⚠ No Razorpay payment id on this order — refund it by hand in their dashboard.');
    } else {
      /*
       * Claim the payment row before spending, in the database rather than in this process.
       *
       * The in-process guard upstream stops two requests on one server; it cannot stop two servers,
       * and it cannot stop two admins who each hold a valid code for the same order. This UPDATE
       * can only succeed once — whoever flips PAID to REFUNDING is the only caller that reaches
       * Razorpay, and everyone else is told it is already handled.
       */
      const claim = await query(
        "UPDATE payments SET status='REFUNDING' WHERE order_id = $1 AND status = 'PAID' RETURNING id",
        [order.id]
      );
      if (claim.rowCount === 0) {
        notes.push('Already refunded (or a refund is already running) — no second refund issued.');
      } else {
        const r = await createRefund(paymentId, { notes: { order: order.order_number, reason: reason.slice(0, 200) } });
        if (r.ok) {
          refund = r.refund;
          await query("UPDATE payments SET status='REFUNDED' WHERE order_id = $1", [order.id]).catch(() => {});
          notes.push(`Refund issued to source — ${refund?.id || 'accepted'}. Razorpay settles it in 5-7 working days.`);
        } else {
          // Hand the claim back so a retry is possible — the money never moved.
          await query("UPDATE payments SET status='PAID' WHERE order_id = $1 AND status = 'REFUNDING'", [order.id]).catch(() => {});
          notes.push(`⚠ Refund FAILED: ${String(r.reason).slice(0, 200)} — issue it by hand in the Razorpay dashboard.`);
        }
      }
    }
  } else {
    notes.push('Nothing was captured for this order, so there is nothing to refund.');
  }

  // ---- 4. our own state, last: it is what every other screen reads ----
  await query("UPDATE orders SET order_status='CANCELLED', updated_at=$1 WHERE id=$2", [ts, order.id]);
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'CANCELLED', `Cancelled by admin — ${reason}`, ts]);
  if (notes.length) {
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, 'CANCEL_DETAIL', notes.join(' '), ts]).catch(() => {});
  }
  console.log(`[ADMIN-CANCEL] done | order=${order.order_number} | ${notes.join(' | ')}`);

  /* Best-effort, and last: the customer being told is important, but a mail failure must not make
     this look like the cancellation did not happen when the money has already moved. The address
     comes off the user row — the order itself does not carry one. */
  const customer = await getOne('SELECT email FROM users WHERE id = $1', [order.user_id]).catch(() => null);
  if (customer?.email) {
    sendOrderCancelledEmail({
      order: { orderNumber: order.order_number, totalAmount: order.total_amount, customerEmail: customer.email },
      reason,
      refunded: !!refund,
    }).catch((e) => console.log(`[ADMIN-CANCEL] cancel email failed | order=${order.order_number} | ${e?.message || e}`));
  }

  return res.json({ ok: true, cancelled: true, refunded: !!refund, refundId: refund?.id || null, notes });
}

/** The captured payment to refund — ours if we stored it, otherwise Razorpay's own record. */
async function resolvePaymentId(order) {
  const row = await getOne("SELECT transaction_id FROM payments WHERE order_id = $1 AND status = 'PAID' ORDER BY id DESC LIMIT 1", [order.id]);
  if (row?.transaction_id) return row.transaction_id;
  if (!order.razorpay_order_id) return null;
  const r = await fetchOrderPayments(order.razorpay_order_id).catch(() => null);
  const captured = (r?.items || []).find((p) => p.status === 'captured');
  return captured?.id || null;
}

export default router;
