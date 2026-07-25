import { Router } from 'express';
import { razorpayConfigured, razorpayKeyId, createRazorpayOrder, verifyPaymentSignature, fetchPayment } from '../razorpay.js';

/*
 * Standalone ₹1 live-payment harness — completely separate from the real storefront checkout
 * (orders.js): not wired to the orders table, no cart/address/shipment involved. Reuses the
 * same razorpay.js client (and whatever mode it's configured for — TEST or LIVE) purely to
 * answer "does a live charge succeed from this domain" before trusting the full checkout flow.
 * Guarded by SATYA_HARNESS_SECRET (x-satya-key header) so it isn't wide open to the internet.
 */

const router = Router();
const GUARD = process.env.SATYA_HARNESS_SECRET || '';

console.log(`[SATYA] config | guard=${GUARD ? 'set' : 'MISSING'}`);

function checkGuard(req, res) {
  if (GUARD && req.headers['x-satya-key'] !== GUARD) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

router.post('/order', async (req, res) => {
  if (!checkGuard(req, res)) return;
  if (!razorpayConfigured()) return res.status(503).json({ error: 'Razorpay not configured' });

  const r = await createRazorpayOrder({ amountPaise: 100, receipt: `satya_${Date.now()}` });
  if (!r.ok) return res.status(502).json({ error: r.reason });
  res.json({ keyId: razorpayKeyId(), orderId: r.order.id, amount: r.order.amount });
});

router.post('/verify', async (req, res) => {
  if (!checkGuard(req, res)) return;
  const { orderId, paymentId, signature } = req.body || {};
  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    return res.status(400).json({ ok: false, error: 'bad signature' });
  }

  const pf = await fetchPayment(paymentId);
  if (!pf.ok) return res.status(502).json({ ok: false, error: pf.reason });
  res.json({ ok: true, status: pf.payment.status, amount: pf.payment.amount, method: pf.payment.method });
});

export default router;
