import crypto from 'node:crypto';
import { getOne, getAll, query, nowIso } from '../db/index.js';
import { createPaymentLink, fetchPaymentLink, cancelPaymentLink, fetchPayment } from './razorpay.client.js';
import { finalizePaidOrder } from './order.service.js';
import { isStoreActive } from './store.service.js';

/*
 * The payment link behind the "pressed Pay, did not pay" WhatsApp nudge.
 *
 * The order it pays for was already closed as unpaid (by the popup's close, or by the payment
 * sweep at 20 minutes). Paying the link reopens THAT order through finalizePaidOrder, the same
 * door every other payment uses, which already knows how to bring back an order closed as unpaid.
 * No new order, no second basket.
 *
 * The life of one is short on purpose, so it ends cleanly:
 *
 *   order closed unpaid ── 30 min ──> link made, WhatsApp sent ── LINK_TTL_MIN ──> link expires
 *
 * and after that the order stays cancelled for good. A payment link charges the price, coupon and
 * store the order was made with, so it must not stay open long enough for any of those to have
 * changed underneath it.
 *
 * Three things can say a link was paid, and any one is enough:
 *   the payment_link.paid webhook       (routes/webhooks/razorpay.routes.ts)
 *   refreshOpenLinks(), asking Razorpay (jobs/whatsappReminders, every sweep)
 *   the /pay/<token> redirect, which checks before sending anyone to Razorpay
 */

const SITE = (process.env.FRONTEND_URL || 'https://www.adoughcookie.com').replace(/\/+$/, '');
/* Razorpay refuses an expiry less than 15 minutes out, so the default leaves room above that. */
export const LINK_TTL_MIN = Math.max(16, Number(process.env.PAYMENT_LINK_TTL_MIN || 20));
/* Where a tap lands once the link is no use: the checkout, with the saved basket, tagged. */
export const CHECKOUT_FALLBACK = `${SITE}/checkout?utm_source=whatsapp&utm_medium=reminder&utm_campaign=checkout_reminder`;

/** Why a link is not being made for an order right now, or null when it can be. */
async function cannotSell(order): Promise<string | null> {
  const paused = await getOne("SELECT value FROM site_settings WHERE key = 'ordering_paused'");
  if (paused?.value) return 'ordering is paused';
  if (order.store_code && !(await isStoreActive(order.store_code))) return `store ${order.store_code} is not taking orders`;
  return null;
}

/*
 * A link for an order closed unpaid, recorded before anyone is told about it. Returns the token for
 * the WhatsApp button, or null when no message should go out at all.
 *
 * A link Razorpay refuses to make is still recorded (status 'failed') and its token still
 * returned: the message is worth sending anyway, and its button then opens the checkout.
 */
export async function createLinkForOrder(orderId: number): Promise<{ token: string; linked: boolean } | null> {
  const order = await getOne(
    `SELECT o.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`, [orderId]);
  if (!order || order.payment_status !== 'CANCELLED') return null;
  const why = await cannotSell(order);
  if (why) {
    console.log(`[PAYLINK] ${order.order_number} | skip — ${why}`);
    return null;
  }

  const token = crypto.randomBytes(9).toString('base64url');
  const expiresAt = new Date(Date.now() + LINK_TTL_MIN * 60_000);
  const email = /@phone\.adccookies\.app$/i.test(order.user_email || '') ? undefined : order.user_email || undefined;
  const r = await createPaymentLink({
    amountPaise: Math.round(Number(order.total_amount) * 100),
    referenceId: order.order_number,
    description: `a dough cookie order ${order.order_number}`,
    expireBy: Math.floor(expiresAt.getTime() / 1000),
    customer: { name: order.user_name || undefined, contact: order.user_phone ? `+${String(order.user_phone).replace(/\D/g, '')}` : undefined, email },
    notes: { orderId: String(order.id), orderNumber: order.order_number, source: 'whatsapp_checkout_reminder' },
    callbackUrl: `${SITE}/account`,
  });

  const ts = nowIso();
  await query(
    `INSERT INTO payment_links (order_id, token, razorpay_link_id, short_url, amount, status, expires_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
     ON CONFLICT (order_id) DO NOTHING`,
    [order.id, token, r.ok ? r.link.id : null, r.ok ? r.link.short_url : null, order.total_amount,
      r.ok ? 'created' : 'failed', expiresAt.toISOString(), ts]);
  const row = await getOne('SELECT token FROM payment_links WHERE order_id = $1', [order.id]);
  if (row?.token !== token) return null; // another sweep got here first and has already sent it
  await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'PAYMENT_LINK_SENT', r.ok
      ? `Payment link sent on WhatsApp, open for ${LINK_TTL_MIN} minutes.`
      : `Payment link could not be made (${r.reason}); the WhatsApp reminder points to the checkout instead.`, ts]).catch(() => {});
  return { token, linked: r.ok };
}

/** Undo a link whose message never went out, so nobody can come across it and pay. */
export async function withdrawLink(token: string): Promise<void> {
  const link = await getOne('SELECT * FROM payment_links WHERE token = $1', [token]);
  if (!link) return;
  if (link.razorpay_link_id && link.status === 'created') await cancelPaymentLink(link.razorpay_link_id);
  await query("UPDATE payment_links SET status = 'cancelled', updated_at = $1 WHERE id = $2 AND status IN ('created','failed')", [nowIso(), link.id]);
}

/*
 * A payment made through a link, turned into a paid order. The amount is checked against the order
 * before anything else: a link is made for one amount and accept_partial is off, so a mismatch
 * means something is wrong, and that is for a person to look at rather than for us to ship.
 */
export async function settleLinkPayment(link, payment): Promise<void> {
  const order = await getOne('SELECT id, order_number, total_amount FROM orders WHERE id = $1', [link.order_id]);
  if (!order || !payment?.id) return;
  const expected = Math.round(Number(order.total_amount) * 100);
  if (Number(payment.amount) !== expected || payment.status !== 'captured') {
    console.log(`[PAYLINK] ${order.order_number} | ⚠ link payment ${payment.id} not settled: status=${payment.status} amount=${payment.amount} expected=${expected}`);
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, 'PAYMENT_LINK_MISMATCH', `⚠ Payment ${payment.id} through the WhatsApp link was ${payment.status}, ₹${Number(payment.amount) / 100}, against an order of ₹${order.total_amount}. Check it in Razorpay before shipping.`, nowIso()]).catch(() => {});
    return;
  }
  await query("UPDATE payment_links SET status = 'paid', updated_at = $1 WHERE id = $2", [nowIso(), link.id]);
  const r = await finalizePaidOrder(order.id, payment.id, payment);
  if (!r?.alreadyPaid) {
    await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, 'PAYMENT_LINK_PAID', 'Paid through the payment link sent on WhatsApp.', nowIso()]).catch(() => {});
  }
  console.log(`[PAYLINK] ${order.order_number} | ✓ paid through the link (${payment.id})${r?.alreadyPaid ? ', already finalised' : ''}`);
}

/** Ask Razorpay how one link ended, and act on it. */
export async function refreshLink(link): Promise<string> {
  if (!link.razorpay_link_id) return link.status;
  const r = await fetchPaymentLink(link.razorpay_link_id);
  if (!r.ok) return link.status;
  const status: string = r.link.status;
  if (status === 'paid') {
    const paymentId = (r.link.payments || []).find((p) => p.status === 'captured')?.payment_id || r.link.payments?.[0]?.payment_id;
    const p = paymentId ? await fetchPayment(paymentId) : null;
    if (p && (p as any).ok) await settleLinkPayment(link, (p as any).payment);
  } else if (status === 'expired' || status === 'cancelled') {
    await query('UPDATE payment_links SET status = $1, updated_at = $2 WHERE id = $3 AND status = $4',
      [status, nowIso(), link.id, 'created']);
  }
  return status;
}

/*
 * The backstop for a missed webhook: every link still open, or expired within the last hour
 * (a payment can land just before the expiry and be reported just after it), asked about.
 */
export async function refreshOpenLinks(): Promise<void> {
  const links = await getAll(
    `SELECT * FROM payment_links WHERE status = 'created' AND razorpay_link_id IS NOT NULL
        AND expires_at > now() - interval '1 hour' ORDER BY created_at LIMIT 30`);
  for (const link of links) {
    await refreshLink(link).catch((e) => console.log(`[PAYLINK] refresh ${link.razorpay_link_id} | ✗ ${e?.message || e}`));
  }
}

/*
 * The customer paid another order, so any link still open on an older one must not be paid as
 * well. Called from finalizePaidOrder. Never throws.
 */
export async function cancelOtherOpenLinks(userId: number | null | undefined, paidOrderId: number): Promise<void> {
  if (!userId) return;
  try {
    const links = await getAll(
      `SELECT l.* FROM payment_links l JOIN orders o ON o.id = l.order_id
        WHERE o.user_id = $1 AND l.order_id <> $2 AND l.status = 'created' AND l.expires_at > now()`, [userId, paidOrderId]);
    for (const l of links) await withdrawLink(l.token);
  } catch (e: any) {
    console.log(`[PAYLINK] cancel other links | user=${userId} | ✗ ${e?.message || e}`);
  }
}

/*
 * Where the WhatsApp button's /pay/<token> sends someone, decided at the moment they tap.
 * Checked against Razorpay first while the link is open, so a customer who paid a minute ago is
 * never sent back to pay again.
 */
export async function destinationFor(token: string): Promise<string> {
  const link = token ? await getOne(
    `SELECT l.*, o.payment_status FROM payment_links l JOIN orders o ON o.id = l.order_id WHERE l.token = $1`, [token]) : null;
  if (!link) return CHECKOUT_FALLBACK;
  if (link.payment_status === 'PAID' || link.status === 'paid') return `${SITE}/account`;
  if (link.status !== 'created' || !link.short_url || new Date(link.expires_at).getTime() < Date.now() + 30_000) return CHECKOUT_FALLBACK;
  const now = await refreshLink(link);
  if (now === 'paid') return `${SITE}/account`;
  return now === 'created' ? link.short_url : CHECKOUT_FALLBACK;
}
