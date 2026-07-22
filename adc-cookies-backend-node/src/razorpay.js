/*
 * Razorpay client — single place for the two server-side operations we need:
 *   1. create an Order (so Checkout can collect payment), and
 *   2. verify the payment signature returned by Checkout (proof the payment is genuine).
 *
 * Zero dependencies: the REST API + Node's crypto are enough. Auth is HTTP Basic
 * (key_id:key_secret). The KEY ID is safe to expose to the browser; the SECRET is not.
 *
 *   RAZORPAY_API_KEY     key id   (rzp_test_… or rzp_live_…)
 *   RAZORPAY_API_SECRET  key secret — backend only, never sent to the client
 *   RAZORPAY_WEBHOOK_SECRET  (optional) for the payment.captured webhook backstop
 */
import crypto from 'node:crypto';
import { logApiCall } from './apiLogger.js';

const KEY_ID = process.env.RAZORPAY_API_KEY || '';
const KEY_SECRET = process.env.RAZORPAY_API_SECRET || '';
const BASE = 'https://api.razorpay.com/v1';

export const razorpayConfigured = () => !!(KEY_ID && KEY_SECRET);
export const razorpayKeyId = () => KEY_ID;

console.log(`[RAZORPAY] config | key=${KEY_ID ? KEY_ID.slice(0, 12) + '…' : 'MISSING'} | mode=${KEY_ID.startsWith('rzp_live') ? 'LIVE' : 'TEST'}`);

const authHeader = () => 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

// Create a Razorpay order. amountPaise must be an integer in paise (₹249 → 24900).
export async function createRazorpayOrder({ amountPaise, receipt, notes } = {}) {
  const requestBody = { amount: amountPaise, currency: 'INR', receipt, notes, payment_capture: 1 };
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const data = await res.json().catch(() => null);
    const durationMs = Date.now() - t0;
    if (!res.ok) {
      console.log(`[RAZORPAY] order-create | ✗ status=${res.status} | ${JSON.stringify(data).slice(0, 200)}`);
      logApiCall({ service: 'razorpay', method: 'POST', endpoint: '/v1/orders', request: requestBody, response: data, status: res.status, ok: false, durationMs });
      return { ok: false, reason: data?.error?.description || `api_error_${res.status}` };
    }
    console.log(`[RAZORPAY] order-create | ✓ ${data.id} | amount=${data.amount} ${data.currency}`);
    logApiCall({ service: 'razorpay', method: 'POST', endpoint: '/v1/orders', request: requestBody, response: data, status: res.status, ok: true, durationMs });
    return { ok: true, order: data };
  } catch (err) {
    console.log(`[RAZORPAY] order-create | ✗ network_error: ${err.message}`);
    logApiCall({ service: 'razorpay', method: 'POST', endpoint: '/v1/orders', request: requestBody, ok: false, durationMs: Date.now() - t0, error: err.message });
    return { ok: false, reason: 'network_error' };
  }
}

// Verify the Checkout signature: HMAC_SHA256(order_id|payment_id, secret) === signature.
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const ok = !!(KEY_SECRET && orderId && paymentId && signature) &&
    safeEqual(crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex'), signature);
  logApiCall({ service: 'razorpay', method: 'LOCAL', endpoint: 'verifyPaymentSignature', request: { orderId, paymentId }, ok, status: ok ? 200 : 400 });
  return ok;
}

// Verify a webhook payload (X-Razorpay-Signature) against the RAW request body.
export function verifyWebhookSignature(rawBody, signature, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  const ok = !!(secret && signature) &&
    safeEqual(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), signature);
  logApiCall({ service: 'razorpay', method: 'WEBHOOK', endpoint: '/webhooks/razorpay', request: { bodyBytes: rawBody?.length }, ok, status: ok ? 200 : 400 });
  return ok;
}
