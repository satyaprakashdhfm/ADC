import { verifyWebhookSignature } from '../razorpay.js';
import { getOne } from '../db.js';
import { finalizePaidOrder } from './orders.js';

/*
 * Razorpay webhook — the reliable backstop for payment confirmation.
 *
 * The Checkout `handler` confirms most payments, but it won't fire if the customer closes
 * the tab right after paying. This webhook (fired server-to-server by Razorpay) catches
 * those: it marks the order PAID and creates the Delhivery shipment regardless.
 *
 * Mounted in server.js with a RAW body parser BEFORE express.json so we can verify the
 * X-Razorpay-Signature (HMAC of the exact bytes) with RAZORPAY_WEBHOOK_SECRET.
 * Configure the webhook in the Razorpay dashboard for events: payment.captured, order.paid.
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

  if ((type === 'payment.captured' || type === 'order.paid') && rzpOrderId) {
    const order = await getOne('SELECT id, order_number FROM orders WHERE razorpay_order_id = $1', [rzpOrderId]);
    if (order) {
      const r = await finalizePaidOrder(order.id, paymentId);
      console.log(`[PAYMENT] webhook | order=${order.order_number} | ${r.alreadyPaid ? 'already_paid (handler beat us)' : 'marked PAID + shipment'}`);
    } else {
      console.log(`[PAYMENT] webhook | no local order matches rzpOrder=${rzpOrderId}`);
    }
  }

  // Always 200 once received & verified, so Razorpay stops retrying.
  res.json({ ok: true });
}
