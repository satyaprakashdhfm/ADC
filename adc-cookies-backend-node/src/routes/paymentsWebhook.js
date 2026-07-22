import { verifyWebhookSignature } from '../razorpay.js';
import { getOne, query, nowIso } from '../db.js';
import { finalizePaidOrder } from './orders.js';
import { logApiCall } from '../apiLogger.js';

/*
 * Razorpay webhook — the reliable backstop for payment confirmation, and the only place we
 * ever learn about a FAILED payment attempt (the client-side `payment.failed` handler in
 * OrderingApp.tsx only bounces the shopper back to checkout with a message — it never tells
 * our backend anything, so without this webhook a failed attempt is completely invisible to us).
 *
 * The Checkout `handler` confirms most successful payments, but it won't fire if the customer
 * closes the tab right after paying. This webhook (fired server-to-server by Razorpay) catches
 * those: it marks the order PAID and creates the Delhivery shipment regardless.
 *
 * Mounted in server.js with a RAW body parser BEFORE express.json so we can verify the
 * X-Razorpay-Signature (HMAC of the exact bytes) with RAZORPAY_WEBHOOK_SECRET.
 * Configure the webhook in the Razorpay dashboard for events: payment.captured, order.paid,
 * payment.failed.
 */
export async function paymentWebhook(req, res) {
  const sig = req.headers['x-razorpay-signature'];
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

  if (!verifyWebhookSignature(raw, sig)) {
    console.log('[PAYMENT] webhook | ✗ bad_signature (or RAZORPAY_WEBHOOK_SECRET not set)');
    return res.status(400).json({ error: 'invalid signature' });
  }

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'bad json' }); }

  const type = event?.event;
  const paymentEntity = event?.payload?.payment?.entity;
  const rzpOrderId = paymentEntity?.order_id || event?.payload?.order?.entity?.id;
  const paymentId = paymentEntity?.id || null;
  console.log(`[PAYMENT] webhook | ${type} | rzpOrder=${rzpOrderId || 'none'} | payment=${paymentId || 'none'}`);
  logApiCall({ service: 'razorpay', method: 'WEBHOOK', endpoint: `/webhooks/razorpay (${type})`, request: { rzpOrderId, paymentId }, response: paymentEntity, ok: true, status: 200 });

  if ((type === 'payment.captured' || type === 'order.paid') && rzpOrderId) {
    const order = await getOne('SELECT id, order_number FROM orders WHERE razorpay_order_id = $1', [rzpOrderId]);
    if (order) {
      const r = await finalizePaidOrder(order.id, paymentId);
      console.log(`[PAYMENT] webhook | order=${order.order_number} | ${r.alreadyPaid ? 'already_paid (handler beat us)' : 'marked PAID + shipment'}`);
    } else {
      console.log(`[PAYMENT] webhook | no local order matches rzpOrder=${rzpOrderId}`);
    }
  }

  // A failed attempt never marks the order PAID (so the shopper can retry with a fresh Razorpay
  // order), but it's otherwise invisible to us without this — record it on the order's timeline
  // so admin can see WHY (bank decline, gateway timeout, etc.) instead of just "still pending".
  if (type === 'payment.failed' && rzpOrderId) {
    const order = await getOne('SELECT id, order_number, payment_status FROM orders WHERE razorpay_order_id = $1', [rzpOrderId]);
    if (order && order.payment_status !== 'PAID') {
      const code = paymentEntity?.error_code || 'UNKNOWN';
      const reason = paymentEntity?.error_reason || '';
      const description = paymentEntity?.error_description || 'Payment failed.';
      const source = paymentEntity?.error_source || '';
      const step = paymentEntity?.error_step || '';
      const remarks = `${description} (code=${code}${reason ? `, reason=${reason}` : ''}${source ? `, source=${source}` : ''}${step ? `, step=${step}` : ''}, payment=${paymentId || 'none'})`;
      await query(
        'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
        [order.id, 'PAYMENT_FAILED', remarks, nowIso()]
      );
      console.log(`[PAYMENT] webhook | order=${order.order_number} | ✗ payment_failed | ${remarks}`);
    } else if (order) {
      console.log(`[PAYMENT] webhook | order=${order.order_number} | payment.failed received but order already PAID — ignored`);
    } else {
      console.log(`[PAYMENT] webhook | payment.failed | no local order matches rzpOrder=${rzpOrderId}`);
    }
  }

  // Refunds — issued either via our own admin action or directly in the Razorpay dashboard.
  // Either way, THIS webhook is the only authoritative confirmation a refund actually completed
  // (refunds process async on Razorpay's side, so a refund-create API call succeeding doesn't
  // mean the money has moved yet). We key off payment_id since the refund entity doesn't carry
  // our order id directly.
  if (type === 'refund.created' || type === 'refund.processed' || type === 'refund.failed') {
    const refundEntity = event?.payload?.refund?.entity;
    const rzpPaymentId = refundEntity?.payment_id;
    if (rzpPaymentId) {
      const payment = await getOne('SELECT id, order_id FROM payments WHERE transaction_id = $1', [rzpPaymentId]);
      if (payment) {
        const STATUS_MAP = { 'refund.created': 'REFUND_INITIATED', 'refund.processed': 'REFUNDED', 'refund.failed': 'REFUND_FAILED' };
        const newStatus = STATUS_MAP[type];
        await query('UPDATE payments SET status = $1 WHERE id = $2', [newStatus, payment.id]);
        const amount = refundEntity?.amount != null ? (refundEntity.amount / 100).toFixed(2) : '?';
        await query(
          'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
          [payment.order_id, newStatus, `Refund ${refundEntity?.id || ''} — ₹${amount} — ${type}`, nowIso()]
        );
        console.log(`[PAYMENT] webhook | ${type} | order_id=${payment.order_id} | refund=${refundEntity?.id} | ₹${amount}`);
      } else {
        console.log(`[PAYMENT] webhook | ${type} | no local payment matches rzpPayment=${rzpPaymentId}`);
      }
    }
  }

  // Chargeback / dispute — rare, but money-at-risk, so it must never be silently invisible.
  if (type === 'payment.dispute.created') {
    const disputeEntity = event?.payload?.dispute?.entity;
    const rzpPaymentId = disputeEntity?.payment_id;
    if (rzpPaymentId) {
      const payment = await getOne('SELECT id, order_id FROM payments WHERE transaction_id = $1', [rzpPaymentId]);
      if (payment) {
        const amount = disputeEntity?.amount != null ? (disputeEntity.amount / 100).toFixed(2) : '?';
        const respondBy = disputeEntity?.respond_by ? new Date(disputeEntity.respond_by * 1000).toISOString() : 'ASAP';
        await query(
          'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
          [payment.order_id, 'DISPUTE_OPENED', `⚠ Chargeback/dispute opened — ₹${amount} — reason=${disputeEntity?.reason_code || 'unknown'} — respond by ${respondBy}`, nowIso()]
        );
        console.log(`[PAYMENT] webhook | ⚠ DISPUTE opened | order_id=${payment.order_id} | payment=${rzpPaymentId}`);
      } else {
        console.log(`[PAYMENT] webhook | payment.dispute.created | no local payment matches rzpPayment=${rzpPaymentId}`);
      }
    }
  }

  // Always 200 once received & verified, so Razorpay stops retrying.
  res.json({ ok: true });
}
