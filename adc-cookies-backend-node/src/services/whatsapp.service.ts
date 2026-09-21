import { getOne, getAll, query, nowIso } from '../db/index.js';
import { sendTemplate, whatsappConfigured, waNumber, log, type TemplateSendResult } from './whatsapp.client.js';
import { ORDER_CONFIRMATION, type WaTemplate, type OrderConfirmationData } from './whatsapp.templates.js';

/*
 * WhatsApp, the database half: who is sent which template, and a record of every send.
 *
 * Every message goes out through sendWhatsApp() — the order confirmation today, sign-in messages
 * and the monthly offer later — so every one of them lands in whatsapp_messages with Meta's message
 * id. That id is what the delivery webhook reports against (routes/webhooks/whatsapp.routes.ts),
 * and it is the only way to know a message reached a phone: the send call's 200 means Meta
 * accepted it, nothing more.
 *
 * Dormant until configured, like the client: with no phone number id or token nothing is sent and
 * nothing is recorded. Staging has neither.
 */

interface SendTo {
  to: string;
  orderId?: number | null;
  userId?: number | null;
  /** What the log line says this message is about, e.g. the order number. */
  label?: string;
}

/** Send one template and record it. Never throws. */
export async function sendWhatsApp<D>(template: WaTemplate<D>, data: D, dest: SendTo): Promise<TemplateSendResult> {
  if (!whatsappConfigured()) return { ok: false, reason: 'not_configured' };

  let content: ReturnType<WaTemplate<D>['render']>;
  try {
    content = template.render(data);
  } catch (err: any) {
    log('send', `${template.name} | ${dest.label ?? '-'} | ✗ render failed: ${err?.message || err}`);
    return { ok: false, reason: 'render_failed' };
  }

  const r = await sendTemplate(dest.to, { name: template.name, language: template.language, ...content });
  const phone = waNumber(dest.to);
  log('send', `${template.name} | ${dest.label ?? '-'} | to=…${phone.slice(-4)} | ${r.ok ? `✓ ${r.messageId}` : `✗ ${r.reason}`}`);

  const ts = nowIso();
  await query(
    `INSERT INTO whatsapp_messages (order_id, user_id, phone, template, kind, message_id, status, last_error, payload, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
    [dest.orderId ?? null, dest.userId ?? null, phone, template.name, template.kind,
      r.ok ? r.messageId : null, r.ok ? 'accepted' : 'failed', r.ok ? null : r.reason.slice(0, 500),
      JSON.stringify(content), ts],
  ).catch((err) => log('send', `${template.name} | ${dest.label ?? '-'} | ✗ not recorded: ${err.message}`));

  return r;
}

/* ---------------------------------------------------------------- order_confirmation ---------- */

/*
 * Who an order's confirmation goes to, and what it says. Kept apart from the send, so a real order
 * can be checked against the template without messaging its customer.
 *
 * It goes to the ACCOUNT's number, not the delivery address's: on a gift order the address belongs
 * to the recipient, who should not be sent a receipt with the prices on it. users.phone is stored as
 * 91XXXXXXXXXX. An account without one — rare, sign-in asks everyone for a number — is skipped.
 */
export async function orderConfirmationFor(orderId: number) {
  const o = await getOne(
    `SELECT o.order_number, o.user_id, o.coupon_code, o.discount_amount, o.tax_amount, o.delivery_fee, o.total_amount,
            u.name AS user_name, u.phone AS user_phone
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1`, [orderId]);
  if (!o) return null;
  const items = await getAll(
    'SELECT product_name, quantity, total_price FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]);

  const data: OrderConfirmationData = {
    customerName: o.user_name,
    orderNumber: o.order_number,
    items: items.map((i) => ({ name: i.product_name, qty: Number(i.quantity) || 1, total: Number(i.total_price) || 0 })),
    couponCode: o.coupon_code,
    discount: Number(o.discount_amount) || 0,
    tax: Number(o.tax_amount) || 0,
    deliveryFee: Number(o.delivery_fee) || 0,
    total: Number(o.total_amount) || 0,
  };
  return { to: (o.user_phone as string | null) || null, userId: o.user_id as number, orderNumber: o.order_number as string, data };
}

/*
 * The customer's confirmation, sent from finalizePaidOrder. Fire-and-forget, and never throws: the
 * money is already taken, so nothing here may surface as a failed payment.
 *
 * finalizePaidOrder only reaches this once per order, but a confirmation is checked for anyway —
 * anything that calls this later (a resend button, a reconcile job) must not text a customer twice.
 * A FAILED earlier attempt does not count, so a retry can put it right.
 */
export async function sendOrderConfirmationWhatsApp(orderId: number): Promise<void> {
  try {
    if (!whatsappConfigured()) return;
    const sent = await getOne(
      `SELECT 1 FROM whatsapp_messages WHERE order_id = $1 AND template = $2 AND status <> 'failed' LIMIT 1`,
      [orderId, ORDER_CONFIRMATION.name]);
    if (sent) return;

    const c = await orderConfirmationFor(orderId);
    if (!c) return;
    if (!c.to) {
      log('send', `${ORDER_CONFIRMATION.name} | ${c.orderNumber} | skip — no phone on the account`);
      return;
    }
    await sendWhatsApp(ORDER_CONFIRMATION, c.data, { to: c.to, orderId, userId: c.userId, label: c.orderNumber });
  } catch (err: any) {
    log('send', `${ORDER_CONFIRMATION.name} | order id ${orderId} | ✗ ${err?.message || err}`);
  }
}
