import { getAll, query } from '../db/index.js';
import { whatsappConfigured, listTemplates, log } from '../services/whatsapp.client.js';
import { sendWhatsApp } from '../services/whatsapp.service.js';
import { CART_REMINDER, CHECKOUT_REMINDER } from '../services/whatsapp.templates.js';
import { lineName, type SavedLines } from '../services/savedCart.service.js';
import { createLinkForOrder, withdrawLink, refreshOpenLinks, LINK_TTL_MIN } from '../services/paymentLink.service.js';
import { razorpayConfigured } from '../services/razorpay.client.js';

/*
 * WhatsApp nudges for signed-in customers who did not finish, on a timer.
 *
 *   checkout_reminder  pressed Pay, order closed unpaid. ONE message, 30 minutes after the order,
 *                      carrying a payment link for that same order that expires LINK_TTL_MIN
 *                      minutes later. After that the order stays cancelled and nothing more is
 *                      sent about it.
 *   cart_reminder      items in the saved basket, never taken to payment. At most TWO messages:
 *                      after the basket has sat a day, and again a day after that. Then silence.
 *                      A basket that changes is a new basket and starts again.
 *
 * The two are timed so differently on purpose. A failed payment is a moment: the customer wanted
 * the cookies now and hit a snag, and a nudge half an hour later catches them still wanting them.
 * A basket can sit for days by design, so it is left alone for a day before anyone mentions it.
 *
 * Each is OFF until its own switch is set on the backend (WHATSAPP_CART_REMINDER=on,
 * WHATSAPP_CHECKOUT_REMINDER=on), and even then sends nothing until Meta lists that template as
 * APPROVED, so a switch set early waits for the approval rather than burning a reminder on a
 * rejected send.
 *
 * Both are marketing to Meta, which caps how many one person receives, and a shop that nags gets
 * blocked, which lowers the number's quality rating for every message after. So, as well as the
 * above:
 *   - never to someone who has checked out since (that order has its own messages)
 *   - no basket reminder within a day of a payment reminder, or of a paid order
 *   - never overnight in India; a basket reminder due at night waits for the morning, and a
 *     payment reminder that would land more than 3 hours late is not sent at all
 *   - only to the account's own number, never a delivery address's (a gift recipient did not
 *     choose these cookies)
 */

const isOn = (v: string | undefined) => /^(on|true|1|yes)$/i.test((v || '').trim());
const CART_ON = isOn(process.env.WHATSAPP_CART_REMINDER);
const CHECKOUT_ON = isOn(process.env.WHATSAPP_CHECKOUT_REMINDER);

const SWEEP_MS = Number(process.env.WHATSAPP_REMINDER_SWEEP_MS || 5 * 60_000);
/* The payment sweep closes an unpaid order at 20 minutes; by 30 it is certainly closed, and a
   customer who retried straight away has finished on a second order. */
const CHECKOUT_AFTER_MIN = Number(process.env.WHATSAPP_CHECKOUT_AFTER_MIN || 30);
const CHECKOUT_MAX_AGE_MIN = 180;
const CHECKOUT_GAP_H = 12;          // one payment reminder per person per 12 hours
const CART_FIRST_AFTER_H = 24;      // first basket reminder once the basket has sat a day
const CART_FIRST_UNTIL_H = 72;      // a basket older than this unmentioned is left alone
const CART_SECOND_AFTER_H = 24;     // the second, a day after the first
const CART_MAX_REMINDERS = 2;
const QUIET_AFTER_OTHER_H = 24;     // no basket reminder within a day of a payment reminder or order
const BATCH = 20;
/* India time. 9 pm to 9 am is left alone. */
const QUIET_FROM_HOUR = 21;
const QUIET_UNTIL_HOUR = 9;

function quietHours(now = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/*
 * Whether Meta has approved a template, asked at most every half hour. A template that is not
 * approved is simply not sent: the reminder stays due and goes out once it is.
 */
const APPROVAL_TTL_MS = 30 * 60_000;
let approval: { at: number; approved: Set<string> } | null = null;

async function approvedTemplates(): Promise<Set<string>> {
  if (approval && Date.now() - approval.at < APPROVAL_TTL_MS) return approval.approved;
  const r: any = await listTemplates();
  if (!r.ok) {
    log('remind', `could not read template approvals (${r.reason}) — nothing sent this sweep`);
    return new Set();
  }
  const approved = new Set<string>(
    (r.templates as any[]).filter((t) => t.status === 'APPROVED').map((t) => `${t.name}|${t.language}`));
  approval = { at: Date.now(), approved };
  return approved;
}

const isApproved = (set: Set<string>, t: { name: string; language: string }) => set.has(`${t.name}|${t.language}`);

/* ------------------------------------------------------------------ who is due ---------------- */

/*
 * Unpaid orders due their one payment reminder. payment_status CANCELLED is only ever written for
 * a checkout that was never paid (the popup closed, or the payment sweep found nothing at
 * Razorpay); an order cancelled after payment keeps its paid status and is a refund, not this.
 *
 * Only the customer's LATEST order: a second attempt, paid or not, supersedes the first, which is
 * how the customer on 7 Sept who paid on a second order seven minutes later is left alone. Only
 * orders whose payment window actually opened (a Razorpay order exists): one that never got that
 * far was a basket, not a payment, and is the basket reminder's. And only while the basket is still
 * saved: someone who emptied it afterwards has given their answer.
 */
export async function checkoutReminderCandidates(limit = BATCH) {
  return getAll(
    `SELECT o.id, o.order_number, o.user_id, o.total_amount, u.name AS user_name, u.phone AS user_phone
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN saved_carts c ON c.user_id = o.user_id AND c.item_count > 0
      WHERE o.payment_status = 'CANCELLED'
        AND o.razorpay_order_id IS NOT NULL
        AND o.created_at < now() - make_interval(mins => $1::int)
        AND o.created_at > now() - make_interval(mins => $2::int)
        AND COALESCE(u.phone, '') <> ''
        AND COALESCE(u.role, '') <> 'ADMIN'
        AND NOT EXISTS (SELECT 1 FROM orders n WHERE n.user_id = o.user_id
                          AND (n.created_at > o.created_at OR (n.created_at = o.created_at AND n.id > o.id)))
        AND NOT EXISTS (SELECT 1 FROM payment_links l WHERE l.order_id = o.id)
        AND NOT EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.order_id = o.id AND m.template = $3)
        AND NOT EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.user_id = o.user_id AND m.template = $3
                          AND m.status <> 'failed' AND m.created_at > now() - make_interval(hours => $4::int))
      ORDER BY o.created_at ASC
      LIMIT $5`,
    [CHECKOUT_AFTER_MIN, CHECKOUT_MAX_AGE_MIN, CHECKOUT_REMINDER.name, CHECKOUT_GAP_H, limit],
  );
}

/*
 * Saved baskets due a reminder: the first once a basket has sat a day, the second a day after the
 * first, and never a third. Skipped when any order was started after the basket last changed, since
 * that checkout is the payment reminder's (or the confirmation's) to speak for.
 */
export async function cartReminderCandidates(limit = BATCH) {
  return getAll(
    `SELECT c.user_id, c.lines, c.updated_at, c.reminder_count, u.name AS user_name, u.phone AS user_phone
       FROM saved_carts c
       JOIN users u ON u.id = c.user_id
      WHERE c.item_count > 0
        AND (
              (c.reminder_count = 0
                 AND c.updated_at < now() - make_interval(hours => $1::int)
                 AND c.updated_at > now() - make_interval(hours => $2::int))
           OR (c.reminder_count BETWEEN 1 AND $3::int - 1
                 AND c.reminded_at < now() - make_interval(hours => $4::int))
            )
        AND COALESCE(u.phone, '') <> ''
        AND COALESCE(u.role, '') <> 'ADMIN'
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = c.user_id AND o.created_at >= c.updated_at)
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = c.user_id AND o.payment_status = 'PAID'
                          AND o.created_at > now() - make_interval(hours => $5::int))
        AND NOT EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.user_id = c.user_id AND m.template = $6
                          AND m.status <> 'failed' AND m.created_at > now() - make_interval(hours => $5::int))
      ORDER BY c.updated_at ASC
      LIMIT $7`,
    [CART_FIRST_AFTER_H, CART_FIRST_UNTIL_H, CART_MAX_REMINDERS, CART_SECOND_AFTER_H,
      QUIET_AFTER_OTHER_H, CHECKOUT_REMINDER.name, limit],
  );
}

/** A saved basket's lines as the names and quantities a reminder lists. */
export function cartItems(lines: SavedLines) {
  return Object.values(lines || {})
    .map((l) => ({ name: lineName(l.name), qty: Number(l.qty) || 1 }))
    .filter((i) => i.name);
}

/* ------------------------------------------------------------------ sending ------------------- */

/*
 * The link is made first and recorded, then the message goes out carrying its token. A message
 * Meta refuses takes its link down with it, so there is never an open link nobody was told about.
 */
async function remindCheckout(o) {
  const items = await getAll(
    'SELECT product_name, quantity FROM order_items WHERE order_id = $1 ORDER BY id', [o.id]);
  if (!items.length) return;
  const link = await createLinkForOrder(o.id);
  if (!link) return;
  const r = await sendWhatsApp(CHECKOUT_REMINDER, {
    customerName: o.user_name,
    items: items.map((i) => ({ name: lineName(i.product_name), qty: Number(i.quantity) || 1 })),
    total: Number(o.total_amount) || 0,
    token: link.token,
  }, { to: o.user_phone, orderId: o.id, userId: o.user_id, label: o.order_number });
  if (!r.ok) await withdrawLink(link.token);
}

async function remindCart(c) {
  const items = cartItems(c.lines);
  /*
   * Counted BEFORE sending and whatever the outcome, and only if the basket is still the one we
   * read: a send Meta rejects must not be retried every few minutes, and a basket the customer
   * changed in the meantime is a new basket, with its own two reminders.
   */
  const { rowCount } = await query(
    `UPDATE saved_carts SET reminder_count = reminder_count + 1, reminded_at = now()
      WHERE user_id = $1 AND updated_at = $2 AND reminder_count = $3`,
    [c.user_id, c.updated_at, c.reminder_count]);
  if (!rowCount || !items.length) return;
  await sendWhatsApp(CART_REMINDER, { customerName: c.user_name, items },
    { to: c.user_phone, userId: c.user_id, label: `basket of user ${c.user_id} (#${Number(c.reminder_count) + 1})` });
}

async function sweep() {
  try {
    /* Settling links is never held for the night: a payment made at 9.05 pm is an order. */
    if (razorpayConfigured()) await refreshOpenLinks();

    if (!whatsappConfigured() || quietHours()) return;
    const approved = await approvedTemplates();

    /* Payments first. A customer due both nudges gets this one, the more specific, and the basket
       reminder then keeps away for a day. */
    if (CHECKOUT_ON && razorpayConfigured() && isApproved(approved, CHECKOUT_REMINDER)) {
      for (const o of await checkoutReminderCandidates()) {
        await remindCheckout(o).catch((e) => log('remind', `${o.order_number} | ✗ ${e?.message || e}`));
      }
    }
    if (CART_ON && isApproved(approved, CART_REMINDER)) {
      for (const c of await cartReminderCandidates()) {
        await remindCart(c).catch((e) => log('remind', `basket of user ${c.user_id} | ✗ ${e?.message || e}`));
      }
    }
  } catch (e: any) {
    log('remind', `sweep failed: ${e?.message || e}`);
  }
}

export function startWhatsAppReminders() {
  if (!CART_ON && !CHECKOUT_ON) {
    log('remind', 'off (set WHATSAPP_CART_REMINDER / WHATSAPP_CHECKOUT_REMINDER to on)');
    return;
  }
  if (!whatsappConfigured()) { log('remind', 'off — WhatsApp is not configured'); return; }
  log('remind', `on | checkout=${CHECKOUT_ON ? `on, ${CHECKOUT_AFTER_MIN} min after the order, link open ${LINK_TTL_MIN} min` : 'off'} | cart=${CART_ON ? `on, after ${CART_FIRST_AFTER_H} h and again ${CART_SECOND_AFTER_H} h later` : 'off'} | every ${Math.round(SWEEP_MS / 60_000)} min`);
  // After the payment sweep's first run (40 s), so an order it is about to close is closed first.
  setTimeout(() => void sweep(), 90_000).unref?.();
  setInterval(() => void sweep(), SWEEP_MS).unref?.();
}
