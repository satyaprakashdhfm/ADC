import type { TemplateMessage } from './whatsapp.client.js';

/*
 * The WhatsApp templates we send, one entry each.
 *
 * A template's wording lives in WhatsApp Manager, approved by Meta. What lives here is how our data
 * fills its variables. The name, language and variable names must match the approved template
 * EXACTLY: Meta checks them per message, at send time, so a mismatch is not caught by a deploy — it
 * surfaces as failed rows in whatsapp_messages.
 *
 * Adding one (a sign-in message, the monthly offer): get it approved in WhatsApp Manager, add an
 * entry below, and send it with sendWhatsApp() from whatsapp.service. Nothing else changes.
 *
 * `kind` is what the message is to the person receiving it, and it decides who may be sent one:
 *
 *   order      about an order they placed           the customer on that order
 *   account    about their account (sign-in etc.)   the account holder
 *   marketing  offers and news, sent as broadcasts  only people who agreed to receive them
 *
 * Meta treats them differently too: marketing costs more per message and is capped per person.
 */
export type WaKind = 'order' | 'account' | 'marketing';

export interface WaTemplate<D> {
  name: string;
  language: string;
  kind: WaKind;
  render: (data: D) => Pick<TemplateMessage, 'headerImage' | 'body' | 'buttonUrl'>;
}

/* Meta fetches header images itself on every send, so these must be public: the live site, never a
   preview deployment, which sits behind Vercel's login. */
const IMAGES = 'https://www.adoughcookie.com/assets/whatsapp';

/** An amount the way the site prints it: 1,130 or 283.50. The templates carry their own ₹ sign. */
function rupees(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
}

/* ---------------------------------------------------------------- order_confirmation ---------- */

export interface OrderConfirmationData {
  customerName: string | null;
  orderNumber: string;
  items: { name: string; qty: number; total: number }[];
  couponCode: string | null;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

/* Keeps the whole message under Meta's length limit however large the order. */
const ITEMS_MAX_CHARS = 600;

/*
 * The order's contents as ONE line, because a variable cannot be more: Meta rejects a line break
 * inside one (132018, tried on the live template). Bullets were tried as well and WhatsApp drew the
 * first as an indented list with the rest run on after it, so it is written like a receipt line:
 * "2 × Chocolate Chip Cookie – ₹120, 1 × Nutella Cookie Tin – ₹600, coupon SPIN5 −₹25". A dash
 * rather than brackets, because product names carry brackets of their own.
 *
 * The coupon and any tax are listed too, so that the Subtotal printed under this line — which is
 * what the items came to AFTER them — visibly adds up to the Total Paid.
 */
function itemsLine(d: OrderConfirmationData): string {
  const entries = d.items.map((i) => `${i.qty} × ${i.name} – ₹${rupees(i.total)}`);
  const adjustments: string[] = [];
  if (d.discount > 0) adjustments.push(`${d.couponCode ? `coupon ${d.couponCode}` : 'discount'} −₹${rupees(d.discount)}`);
  if (d.tax > 0) adjustments.push(`taxes ₹${rupees(d.tax)}`);

  const kept: string[] = [];
  let length = adjustments.join(', ').length + 20; // room for "+N more"
  for (const entry of entries) {
    if (length + entry.length + 2 > ITEMS_MAX_CHARS) break;
    kept.push(entry);
    length += entry.length + 2;
  }
  const more = entries.length - kept.length;
  return [...kept, ...(more ? [`+${more} more`] : []), ...adjustments].join(', ');
}

/*
 * Sent once, when an order is paid. Approved as UTILITY.
 *
 * The order number goes in plain. WhatsApp turns its long run of digits into a tappable phone
 * number whatever we do — bold was tried and changed nothing.
 */
export const ORDER_CONFIRMATION: WaTemplate<OrderConfirmationData> = {
  name: 'order_confirmation',
  language: 'en',
  kind: 'order',
  render: (d) => ({
    headerImage: `${IMAGES}/order-confirmation.jpg`,
    body: {
      customer_name: d.customerName?.trim() || 'there',
      order_id: d.orderNumber,
      order_items: itemsLine(d),
      order_subtotal: rupees(d.total - d.deliveryFee),
      order_delivery: rupees(d.deliveryFee),
      order_total: rupees(d.total),
    },
  }),
};

/* ---------------------------------------------------------------- reminders ------------------- */

/*
 * The two nudges for a customer who did not finish, sent by jobs/whatsappReminders. Both are
 * MARKETING to Meta, whatever they are submitted as: it counts "come back and buy" as promotion,
 * charges more for it, and caps how many one person is sent.
 *
 * Neither has a header.
 *
 * cart_reminder's button is a fixed link to /checkout, tagged utm_source=whatsapp so an order it
 * brings back is credited to WhatsApp. It needs no variable because the basket is saved on the
 * account (saved_carts): signing in on any device puts it back.
 *
 * checkout_reminder's button is dynamic, /pay/{{1}}, and carries a payment link's token: one tap
 * pays for the very order that was left unpaid. See services/paymentLink.service.
 */

/** The first name only: "Hi Tirthesh" reads like a person, "Hi Tirthesh Patel" like a form. */
function firstName(name: string | null): string {
  return (name || '').replace(/\s+/g, ' ').trim().split(' ')[0] || 'there';
}

/* Room for a long basket without pushing the message past Meta's length limit. */
const NAMES_MAX_CHARS = 400;

/** "2 × Chocolate Chip Cookie, 1 × Nutella Cookie Tin, +3 more". One line, as itemsLine explains. */
function namesLine(items: { name: string; qty: number }[]): string {
  const entries = items.map((i) => `${i.qty} × ${i.name.replace(/\s+/g, ' ').trim()}`);
  const kept: string[] = [];
  let length = 12; // room for "+N more"
  for (const entry of entries) {
    if (kept.length && length + entry.length + 2 > NAMES_MAX_CHARS) break;
    kept.push(entry.slice(0, NAMES_MAX_CHARS));
    length += entry.length + 2;
  }
  const more = entries.length - kept.length;
  return [...kept, ...(more ? [`+${more} more`] : [])].join(', ');
}

export interface CartReminderData {
  customerName: string | null;
  items: { name: string; qty: number }[];
}

/*
 * Items left in the basket, never taken to payment. No total: the prices in a saved basket are
 * whatever the browser last saw, and a number we cannot stand behind has no place in a message.
 */
export const CART_REMINDER: WaTemplate<CartReminderData> = {
  name: 'cart_reminder',
  language: 'en',
  kind: 'marketing',
  render: (d) => ({
    body: {
      customer_name: firstName(d.customerName),
      cart_items: namesLine(d.items),
    },
  }),
};

export interface CheckoutReminderData {
  customerName: string | null;
  items: { name: string; qty: number }[];
  total: number;
  /** The payment link's token, for the button's /pay/{{1}}. */
  token: string;
}

/*
 * Pressed Pay and did not pay, sent once with a payment link for that same order. The wording is
 * "did not go through", never "payment pending", and it does not promise that nothing was charged:
 * a UPI payment can be held by the bank for a while before it is returned. The total here is the
 * order's own, from our records, and it is exactly what the link charges.
 */
export const CHECKOUT_REMINDER: WaTemplate<CheckoutReminderData> = {
  name: 'checkout_reminder',
  language: 'en',
  kind: 'marketing',
  render: (d) => ({
    body: {
      customer_name: firstName(d.customerName),
      order_items: namesLine(d.items),
      order_total: rupees(d.total),
    },
    buttonUrl: d.token,
  }),
};
