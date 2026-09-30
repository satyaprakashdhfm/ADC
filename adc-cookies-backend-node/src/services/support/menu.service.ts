import { getOne } from '../../db/index.js';
import { recordMessage, type Conversation } from './conversation.service.js';
import { sendToCustomer, sendInteractiveToCustomer } from './outbound.service.js';

/*
 * The WhatsApp menu: what someone gets when they say hello, instead of the assistant guessing what
 * a bare "hi" wants.
 *
 *   hello (or the website's WhatsApp button)  ─> a list: new order, raise a ticket, corporate,
 *                                                 franchise, ask something else, and "ticket N"
 *                                                 first when they have one open
 *   the franchise / corporate buttons on the
 *   site, or a short "can I do a corporate
 *   order?"                                   ─> straight to that card, which asks what the team
 *                                                 needs; the assistant collects the answers
 *   anything else                             ─> the assistant, exactly as before
 *
 * Every message here is a reply to what the customer just sent, so Meta's 24-hour window is open and
 * none of it needs a template. The row ids below come back to us when a row is tapped.
 *
 * The customer-facing lines were written through the humanizer: short, plain, no dashes.
 */

const SITE = 'https://www.adoughcookie.com';
const utm = (campaign: string) => `utm_source=whatsapp&utm_medium=chat&utm_campaign=${campaign}`;

const ID = {
  CONTINUE: 'MENU_CONTINUE',
  ORDER: 'MENU_ORDER',
  TICKET: 'MENU_TICKET',
  CORPORATE: 'MENU_CORPORATE',
  FRANCHISE: 'MENU_FRANCHISE',
  ASK: 'MENU_ASK',
} as const;

const normalise = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* Every WhatsApp button on the website starts its message with this, so we know where it came from. */
const FROM_SITE = /^hi a dough cookie\b/;

/* A hello and nothing else. "Hi, where is my order" is a question and goes to the assistant. */
const GREETING = /^(hi+|hey+|hello+|helo|hai|hlo|namaste|namaskara|vanakkam|good (morning|afternoon|evening)|menu|start|options?|help)( (there|team|adc|a dough cookie|doughie|sir|madam))?$/;

const FRANCHISE = /\bfranchis/;
const CORPORATE = /\b(corporate|bulk|hampers?)\b/;
/* Words that mean something already went wrong. "My corporate order is late" is a problem to sort
   out, not a new enquiry, so it goes to the assistant. */
const PROBLEM = /\b(late|where|status|track|refund|cancel|damaged|broken|missing|wrong|not delivered|not received|complain|issue|problem)\b|\badc\d/;

type Route = 'menu' | 'corporate' | 'franchise' | null;

/** What a typed message should get from the menu, or null for the assistant. */
export function routeFor(text: string): Route {
  const t = normalise(text);
  if (!t) return null;
  if (FROM_SITE.test(t)) {
    if (FRANCHISE.test(t)) return 'franchise';
    if (CORPORATE.test(t) || /\bquote\b/.test(t)) return 'corporate';
    return 'menu';
  }
  if (GREETING.test(t)) return 'menu';
  /* "Can I do a corporate order?" or "franchise details please": the same card as the menu row,
     which asks for exactly what the team needs. Only for short messages about starting something. */
  if (!PROBLEM.test(t) && t.split(' ').length <= 25) {
    if (FRANCHISE.test(t)) return 'franchise';
    if (CORPORATE.test(t)) return 'corporate';
  }
  return null;
}

async function openTicket(conv: Conversation) {
  if (!conv.ticket_id || !conv.user_id) return null;
  return getOne<{ id: number; subject: string; status: string }>(
    `SELECT id, subject, status FROM support_tickets WHERE id = $1 AND user_id = $2 AND status IN ('OPEN','IN_PROGRESS')`,
    [conv.ticket_id, conv.user_id]);
}

/*
 * The name to greet with: the first name on their ADC account, and nothing otherwise. A WhatsApp
 * profile name is whatever the person typed into WhatsApp (a business name, an emoji, a nickname),
 * so a number with no account gets "Hi there" rather than a guess.
 */
export function greetingName(accountName: string | null | undefined): string {
  const first = String(accountName || '').trim().split(/\s+/)[0] || '';
  if (!/^[\p{L}.'-]{2,20}$/u.test(first)) return '';
  return first[0]!.toUpperCase() + first.slice(1);
}

async function firstName(conv: Conversation) {
  if (!conv.user_id) return '';
  const u = await getOne<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [conv.user_id]);
  return greetingName(u?.name);
}

/* WhatsApp's limits: 24 characters for a row title, 72 for its description. */
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The menu as Meta's interactive object. Pure, so a test send can use exactly what customers get. */
export function menuMessage(name: string, ticket: { id: number; subject: string } | null) {
  const rows = [
    ...(ticket ? [{ id: ID.CONTINUE, title: cut(`📌 Ticket ${ticket.id}`, 24), description: cut(ticket.subject, 72) }] : []),
    { id: ID.ORDER, title: '🍪 New order', description: 'Order fresh cookies on our website' },
    { id: ID.TICKET, title: '🎫 Raise a ticket', description: 'Something wrong with an order? Tell us here' },
    { id: ID.CORPORATE, title: '🏢 Corporate order', description: 'Bulk orders and gift hampers for your team' },
    { id: ID.FRANCHISE, title: '🤝 Franchise', description: 'Open an A Dough Cookie store in your city' },
    { id: ID.ASK, title: '💬 Ask something else', description: 'Chat with Doughie, our assistant' },
  ];
  const greeting = `Hi ${name || 'there'}, thanks for messaging A Dough Cookie. What can we help with?`;
  const body = ticket ? `${greeting}\n\nYour ticket ${ticket.id} is still open. Tap it below to continue.` : greeting;
  return {
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: 'Choose an option', sections: [{ title: 'How can we help', rows }] },
    },
    summary: `Menu sent: ${rows.map((r) => r.title).join(' · ')}`,
  };
}

async function sendMenu(conv: Conversation) {
  const [name, ticket] = await Promise.all([firstName(conv), openTicket(conv)]);
  const m = menuMessage(name, ticket);
  return sendInteractiveToCustomer(conv, m.interactive, m.summary);
}

type Card = { image: string; text: string; button: string; url: string; summary: string };

/** A card (one picture, a message, one website button) as Meta's interactive object. */
export function cardMessage({ image, text, button, url }: Card) {
  return {
    type: 'cta_url',
    header: { type: 'image', image: { link: `${SITE}${image}` } },
    body: { text },
    action: { name: 'cta_url', parameters: { display_text: button, url } },
  };
}

function linkCard(conv: Conversation, card: Card) {
  return sendInteractiveToCustomer(conv, cardMessage(card), card.summary);
}

export const CARDS: Record<'order' | 'corporate' | 'franchise', Card> = {
  order: {
    image: '/assets/whatsapp/order-logo.jpg',
    text: 'Our full menu is on the website. Order there for same-day delivery in Bengaluru and Chennai, or shipping anywhere in India.',
    button: 'Order now', url: `${SITE}/order?${utm('menu_order')}`,
    summary: 'Sent the "Order now" link',
  },
  corporate: {
    image: '/assets/corporate-gifting.jpg',
    text: 'Yes, we do corporate and bulk orders, gift hampers too. For a quote, reply with:\n\n'
      + '1. How many cookies or boxes\n2. The date you need them by\n3. The delivery city\n\n'
      + 'You can also send the details on our corporate page.',
    button: 'Get a quote', url: `${SITE}/corporate?${utm('menu_corporate')}`,
    summary: 'Sent the corporate order card (asks for quantity, date, delivery city)',
  },
  franchise: {
    image: '/assets/gallery/ADC3.jpeg',
    text: 'Want to open an A Dough Cookie store in your city? Reply with the city and your budget, and our franchise team will call you. '
      + 'You can also read how it works and enquire on our website.',
    button: 'Franchise details', url: `${SITE}/franchise?${utm('menu_franchise')}`,
    summary: 'Sent the franchise card (asks for city, budget)',
  },
};

const orderCard = (conv: Conversation) => linkCard(conv, CARDS.order);

/* A line in the thread the assistant reads as "[note: …]", so it knows what the customer picked. */
const note = (conv: Conversation, body: string) =>
  recordMessage({ conversationId: conv.id, direction: 'out', sender: 'system', body });

/* The two cards that ask questions leave a note, so the assistant collects the answers next. */
async function corporate(conv: Conversation) {
  const r = await linkCard(conv, CARDS.corporate);
  if (r.ok) await note(conv, 'Sent the corporate order card, which asked for how many cookies or boxes, the date needed and the delivery city.');
  return r;
}

async function franchise(conv: Conversation) {
  const r = await linkCard(conv, CARDS.franchise);
  if (r.ok) await note(conv, 'Sent the franchise card, which asked for the city they want to open in and their budget.');
  return r;
}

async function onPick(conv: Conversation, id: string): Promise<boolean> {
  switch (id) {
    case ID.ORDER: await orderCard(conv); return true;
    case ID.CORPORATE: await corporate(conv); return true;
    case ID.FRANCHISE: await franchise(conv); return true;
    case ID.ASK:
      await sendToCustomer(conv, 'Go ahead, ask me anything about our cookies, delivery or your orders.', 'bot', 'Doughie');
      return true;
    case ID.TICKET:
      await note(conv, 'The customer chose "Raise a ticket" from the menu.');
      await sendToCustomer(conv, conv.user_id
        ? 'What went wrong? Tell me in one message, with the order number if you have it.'
        : "Tell me what went wrong. This number isn't linked to an A Dough Cookie account, so if you can, write from the number you order with and I can check the order too.",
        'bot', 'Doughie');
      return true;
    case ID.CONTINUE: {
      const t = await openTicket(conv);
      if (!t) {
        await sendToCustomer(conv, "That ticket is closed. If something still isn't right, tell me what happened and I'll raise a new one.", 'bot', 'Doughie');
        return true;
      }
      await note(conv, `The customer chose to continue ticket ${t.id} from the menu.`);
      const where = t.status === 'IN_PROGRESS' ? 'Someone on the team is working on it.' : 'The team has it and will get back to you.';
      await sendToCustomer(conv, `Ticket ${t.id}: ${t.subject}. ${where} Send anything you'd like to add and I'll put it on the ticket.`, 'bot', 'Doughie');
      return true;
    }
    default: return false;
  }
}

/**
 * Answers the message from the menu if it is a menu matter: a tapped row, a hello, one of the
 * website's WhatsApp buttons, or a short corporate or franchise enquiry. Returns false when the
 * assistant should answer instead.
 */
export async function handleMenu(conv: Conversation, message: { body: string | null; replyId: string | null }): Promise<boolean> {
  if (conv.mode !== 'BOT') return false;
  if (message.replyId?.startsWith('MENU_')) return onPick(conv, message.replyId);

  const route = routeFor(message.body || '');
  if (!route) return false;
  const r = route === 'franchise' ? await franchise(conv)
    : route === 'corporate' ? await corporate(conv)
    : await sendMenu(conv);
  // If Meta refused the list or card, the assistant answers instead, so the customer is never ignored.
  return r.ok;
}
