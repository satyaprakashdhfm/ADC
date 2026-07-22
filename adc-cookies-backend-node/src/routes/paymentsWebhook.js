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

  // Always 200 once received & verified, so Razorpay stops retrying.
  res.json({ ok: true });
}
