import { getAll, query } from '../db/index.js';
import { whatsappConfigured, listTemplates, log } from '../services/whatsapp.client.js';
import { sendWhatsApp } from '../services/whatsapp.service.js';
import { CART_REMINDER, CHECKOUT_REMINDER } from '../services/whatsapp.templates.js';
import { lineName, type SavedLines } from '../services/savedCart.service.js';

/*
 * WhatsApp nudges for signed-in customers who did not finish, on a timer.
 *
 *   cart_reminder      items in the saved basket, never taken to payment
 *   checkout_reminder  pressed Pay, and the order was closed unpaid
 *
 * Each is OFF until its own switch is set on the backend (WHATSAPP_CART_REMINDER=on,
 * WHATSAPP_CHECKOUT_REMINDER=on), and even then sends nothing until Meta lists that template as
 * APPROVED. Switching one on early is therefore safe: it waits for the approval rather than
 * burning each customer's one reminder on a rejected send.
 *
 * Both are marketing to Meta, which caps how many one person receives, and a shop that nags gets
 * blocked, which lowers the number's quality rating for every message after. So the rules are
 * deliberately stingy:
 *
 *   - one reminder per basket, and one per unpaid order
 *   - at most one reminder of either kind per person every COOLDOWN_H hours
 *   - never to someone who has checked out since (the order has its own messages)
 *   - never overnight in India; a reminder due at night waits until morning
 *   - never after MAX_AGE_H: a day-old nudge reads as a stranger's message
 *   - only to the account's own number, never a delivery address's (a gift recipient did not
 *     choose these cookies)
 */

const isOn = (v: string | undefined) => /^(on|true|1|yes)$/i.test((v || '').trim());
const CART_ON = isOn(process.env.WHATSAPP_CART_REMINDER);
const CHECKOUT_ON = isOn(process.env.WHATSAPP_CHECKOUT_REMINDER);

const SWEEP_MS = Number(process.env.WHATSAPP_REMINDER_SWEEP_MS || 10 * 60_000);
/* How long a basket sits untouched before it counts as left behind. */
const CART_IDLE_MIN = Number(process.env.WHATSAPP_CART_IDLE_MIN || 60);
/* After this the payment sweep has certainly closed the order (it acts at 20 minutes), and a
   customer retrying straight away has had time to finish on a second order. */
const CHECKOUT_AFTER_MIN = Number(process.env.WHATSAPP_CHECKOUT_AFTER_MIN || 45);
const MAX_AGE_H = 24;
const COOLDOWN_H = 72;
/* Someone who bought from us today is not nagged about a basket. */
const RECENT_PAID_H = 24;
const BATCH = 20;
/* India time. 9 pm to 9 am is left alone. */
const QUIET_FROM_HOUR = 21;
const QUIET_UNTIL_HOUR = 9;

const REMINDERS = [CART_REMINDER.name, CHECKOUT_REMINDER.name];

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
 * Unpaid orders worth a nudge. payment_status CANCELLED is only ever written for a checkout that
 * was never paid (the popup closed, or the payment sweep found nothing at Razorpay); an order
 * cancelled after payment keeps its paid status and is a refund, not a reminder.
 *
 * Only the customer's LATEST order: a second attempt, paid or not, supersedes the first, which is
 * how the customer on 7 Sept who paid on a second order seven minutes later is left alone. And
 * only while their basket is still saved, since the message says it is; someone who emptied it
 * after the payment failed has told us their answer.
 */
export async function checkoutReminderCandidates(limit = BATCH) {
  return getAll(
    `SELECT o.id, o.order_number, o.user_id, o.total_amount, u.name AS user_name, u.phone AS user_phone
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN saved_carts c ON c.user_id = o.user_id AND c.item_count > 0
      WHERE o.payment_status = 'CANCELLED'
        AND o.created_at < now() - make_interval(mins => $1::int)
        AND o.created_at > now() - make_interval(hours => $2::int)
        AND COALESCE(u.phone, '') <> ''
        AND COALESCE(u.role, '') <> 'ADMIN'
        AND NOT EXISTS (SELECT 1 FROM orders n WHERE n.user_id = o.user_id
                          AND (n.created_at > o.created_at OR (n.created_at = o.created_at AND n.id > o.id)))
        AND NOT EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.order_id = o.id AND m.template = $3)
        AND NOT EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.user_id = o.user_id AND m.template = ANY($4)
                          AND m.status <> 'failed' AND m.created_at > now() - make_interval(hours => $5::int))
      ORDER BY o.created_at ASC
      LIMIT $6`,
    [CHECKOUT_AFTER_MIN, MAX_AGE_H, CHECKOUT_REMINDER.name, REMINDERS, COOLDOWN_H, limit],
  );
}

/*
 * Saved baskets left alone. Skipped when any order was started after the basket last changed:
 * that checkout is the checkout reminder's (or the confirmation's) to speak for, and the basket
 * reminder would be the same nudge twice.
 */
export async function cartReminderCandidates(limit = BATCH) {
  return getAll(
    `SELECT c.user_id, c.lines, c.updated_at, u.name AS user_name, u.phone AS user_phone
       FROM saved_carts c
       JOIN users u ON u.id = c.user_id
      WHERE c.reminded_at IS NULL
        AND c.item_count > 0
        AND c.updated_at < now() - make_interval(mins => $1::int)
        AND c.updated_at > now() - make_interval(hours => $2::int)
        AND COALESCE(u.phone, '') <> ''
        AND COALESCE(u.role, '') <> 'ADMIN'
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = c.user_id AND o.created_at >= c.updated_at)
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = c.user_id AND o.payment_status = 'PAID'
                          AND o.created_at > now() - make_interval(hours => $3::int))
        AND NOT EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.user_id = c.user_id AND m.template = ANY($4)
                          AND m.status <> 'failed' AND m.created_at > now() - make_interval(hours => $5::int))
      ORDER BY c.updated_at ASC
      LIMIT $6`,
    [CART_IDLE_MIN, MAX_AGE_H, RECENT_PAID_H, REMINDERS, COOLDOWN_H, limit],
  );
}

/** A saved basket's lines as the names and quantities a reminder lists. */
export function cartItems(lines: SavedLines) {
  return Object.values(lines || {})
    .map((l) => ({ name: lineName(l.name), qty: Number(l.qty) || 1 }))
    .filter((i) => i.name);
}

/* ------------------------------------------------------------------ sending ------------------- */

async function remindCheckout(o) {
  const items = await getAll(
    'SELECT product_name, quantity FROM order_items WHERE order_id = $1 ORDER BY id', [o.id]);
  if (!items.length) return;
  await sendWhatsApp(CHECKOUT_REMINDER, {
    customerName: o.user_name,
    items: items.map((i) => ({ name: lineName(i.product_name), qty: Number(i.quantity) || 1 })),
    total: Number(o.total_amount) || 0,
  }, { to: o.user_phone, orderId: o.id, userId: o.user_id, label: o.order_number });
}

async function remindCart(c) {
  const items = cartItems(c.lines);
  /*
   * Marked BEFORE sending and whatever the outcome, and only if the basket is still the one we
   * read: a send Meta rejects must not be retried every ten minutes, and a basket the customer
   * changed in the meantime is a new basket that has not been reminded about.
   */
  const { rowCount } = await query(
    'UPDATE saved_carts SET reminded_at = now() WHERE user_id = $1 AND updated_at = $2 AND reminded_at IS NULL',
    [c.user_id, c.updated_at]);
  if (!rowCount || !items.length) return;
  await sendWhatsApp(CART_REMINDER, { customerName: c.user_name, items },
    { to: c.user_phone, userId: c.user_id, label: `basket of user ${c.user_id}` });
}

async function sweep() {
  try {
    if (!whatsappConfigured() || quietHours()) return;
    const approved = await approvedTemplates();

    /* Checkouts first. A customer due both nudges gets this one, the more specific, and the
       cooldown then keeps the basket reminder from following it. */
    if (CHECKOUT_ON && isApproved(approved, CHECKOUT_REMINDER)) {
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
  log('remind', `on | cart=${CART_ON ? 'on' : 'off'} after ${CART_IDLE_MIN} min | checkout=${CHECKOUT_ON ? 'on' : 'off'} after ${CHECKOUT_AFTER_MIN} min | every ${Math.round(SWEEP_MS / 60_000)} min`);
  // After the payment sweep's first run (40 s), so an order it is about to close is closed first.
  setTimeout(() => void sweep(), 90_000).unref?.();
  setInterval(() => void sweep(), SWEEP_MS).unref?.();
}
