import { Router } from 'express';
import crypto from 'node:crypto';

/*
 * Standalone ₹1 live-payment harness — completely separate from the real storefront checkout
 * (razorpay.js / orders.js), which stays on TEST keys. Uses its own LIVE-only env vars so a
 * one-off live-domain test can never affect real customer checkout:
 *   RAZORPAY_LIVE_API_KEY / RAZORPAY_LIVE_API_SECRET  — live key pair, this route only
 *   SATYA_HARNESS_SECRET  — shared secret the frontend must send (x-satya-key header)
 * Not wired into the orders table — this is purely "does a live charge succeed from this
 * domain", not a real order.
 */

const router = Router();

const KEY_ID = process.env.RAZORPAY_LIVE_API_KEY || '';
const KEY_SECRET = process.env.RAZORPAY_LIVE_API_SECRET || '';
const GUARD = process.env.SATYA_HARNESS_SECRET || '';
const BASE = 'https://api.razorpay.com/v1';

console.log(`[SATYA] config | key=${KEY_ID ? KEY_ID.slice(0, 12) + '…' : 'MISSING'} | guard=${GUARD ? 'set' : 'MISSING'}`);

const authHeader = () => 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

function checkGuard(req, res) {
  if (GUARD && req.headers['x-satya-key'] !== GUARD) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

router.post('/order', async (req, res) => {
  if (!checkGuard(req, res)) return;
  if (!KEY_ID || !KEY_SECRET) return res.status(503).json({ error: 'live keys not configured' });

  const r = await fetch(`${BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 100, currency: 'INR', receipt: `satya_${Date.now()}`, payment_capture: 1 }),
  });
  const data = await r.json().catch(() => null);
  console.log(`[SATYA] order-create | ${r.ok ? '✓' : '✗'} ${JSON.stringify(data).slice(0, 200)}`);
  if (!r.ok) return res.status(502).json({ error: data?.error?.description || `api_error_${r.status}` });
  res.json({ keyId: KEY_ID, orderId: data.id, amount: data.amount });
});

router.post('/verify', async (req, res) => {
  if (!checkGuard(req, res)) return;
  const { orderId, paymentId, signature } = req.body || {};
  const ok = !!(KEY_SECRET && orderId && paymentId && signature) &&
    safeEqual(crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex'), signature);
  console.log(`[SATYA] verify | order=${orderId} payment=${paymentId} | sig=${ok ? 'valid' : 'INVALID'}`);
  if (!ok) return res.status(400).json({ ok: false, error: 'bad signature' });

  const pr = await fetch(`${BASE}/payments/${paymentId}`, { headers: { Authorization: authHeader() } });
  const pdata = await pr.json().catch(() => null);
  console.log(`[SATYA] payment-fetch | status=${pdata?.status} amount=${pdata?.amount} method=${pdata?.method}`);
  res.json({ ok: true, status: pdata?.status, amount: pdata?.amount, method: pdata?.method });
});

export default router;
