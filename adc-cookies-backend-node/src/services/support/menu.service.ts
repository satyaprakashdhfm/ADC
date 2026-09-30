import { getOne } from '../../db/index.js';
import { recordMessage, type Conversation } from './conversation.service.js';
import { sendToCustomer, sendInteractiveToCustomer } from './outbound.service.js';

/*
 * The WhatsApp menu: what someone gets when they say hello, instead of the assistant guessing what
 * a bare "hi" wants.
 *
 *   hello (or the website's WhatsApp button)  ─> a list: new order, raise a ticket, corporate,
 *                                                 franchise, ask something else, and "continue
 *                                                 ticket N" first when they have one open
 *   franchise / corporate buttons on the site ─> straight to that answer, no menu in the way
 *   anything else                             ─> the assistant, exactly as before
 *
 * Every message here is a reply to what the customer just sent, so Meta's 24-hour window is open and
 * none of it needs a template. The row ids below come back to us when a row is tapped.
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

type Route = 'menu' | 'order' | 'corporate' | 'franchise' | null;

/** What a typed message should get from the menu, or null for the assistant. */
export function routeFor(text: string): Route {
  const t = normalise(text);
  if (!t) return null;
  if (FROM_SITE.test(t)) {
    if (/franchise/.test(t)) return 'franchise';
    if (/corporate|bulk|hamper|quote/.test(t)) return 'corporate';
    return 'menu';
  }
  return GREETING.test(t) ? 'menu' : null;
}

async function openTicket(conv: Conversation) {
  if (!conv.ticket_id || !conv.user_id) return null;
  return getOne<{ id: number; subject: string; status: string }>(
    `SELECT id, subject, status FROM support_tickets WHERE id = $1 AND user_id = $2 AND status IN ('OPEN','IN_PROGRESS')`,
    [conv.ticket_id, conv.user_id]);
}

async function firstName(conv: Conversation) {
  const u = conv.user_id ? await getOne<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [conv.user_id]) : null;
  return (u?.name || conv.profile_name || '').trim().split(/\s+/)[0] || '';
}

/* WhatsApp's limits: 24 characters for a row title, 72 for its description. */
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function sendMenu(conv: Conversation) {
  const [name, ticket] = await Promise.all([firstName(conv), openTicket(conv)]);
  const rows = [
    ...(ticket ? [{ id: ID.CONTINUE, title: cut(`📌 Ticket ${ticket.id}`, 24), description: cut(`Carry on with: ${ticket.subject}`, 72) }] : []),
    { id: ID.ORDER, title: '🍪 New order', description: 'Order fresh cookies on our website' },
    { id: ID.TICKET, title: '🎫 Raise a ticket', description: 'Something wrong with an order? Tell us here' },
    { id: ID.CORPORATE, title: '🏢 Corporate order', description: 'Bulk orders and gift hampers for your team' },
    { id: ID.FRANCHISE, title: '🤝 Franchise', description: 'Open an A Dough Cookie store in your city' },
    { id: ID.ASK, title: '💬 Ask something else', description: 'Chat with Doughie, our assistant' },
  ];
  const greeting = `Hi${name ? ` ${name}` : ''}, thanks for messaging A Dough Cookie. What can we help with?`;
  const body = ticket
    ? `${greeting}\n\nYou have ticket ${ticket.id} open with us. Pick it to carry on where we left off.`
    : greeting;
  return sendInteractiveToCustomer(conv, {
    type: 'list',
    body: { text: body },
    action: { button: 'Choose an option', sections: [{ title: 'How can we help', rows }] },
  }, `Menu sent: ${rows.map((r) => r.title).join(' · ')}`);
}

/* One picture, a line of text and one button that opens the website. */
function linkCard(conv: Conversation, { image, text, button, url, summary }: { image: string; text: string; button: string; url: string; summary: string }) {
  return sendInteractiveToCustomer(conv, {
    type: 'cta_url',
    header: { type: 'image', image: { link: `${SITE}${image}` } },
    body: { text },
    action: { name: 'cta_url', parameters: { display_text: button, url } },
  }, summary);
}

const orderCard = (conv: Conversation) => linkCard(conv, {
  image: '/assets/hero-cookies-wide.jpg',
  text: 'Our full menu is on the website. Order there and we deliver the same day in Bengaluru and Chennai, or ship it anywhere in India.',
  button: 'Order now', url: `${SITE}/order?${utm('menu_order')}`,
  summary: 'Sent the "Order now" link',
});

const corporateCard = (conv: Conversation) => linkCard(conv, {
  image: '/assets/corporate-gifting.jpg',
  text: 'We make bulk orders and gift hampers for teams, events and festivals. Send us the details on our corporate page and we will get back to you with a quote.',
  button: 'Get a quote', url: `${SITE}/corporate?${utm('menu_corporate')}`,
  summary: 'Sent the corporate gifting link',
});

const franchiseCard = (conv: Conversation) => linkCard(conv, {
  image: '/assets/gallery/ADC3.jpeg',
  text: 'Want to open an A Dough Cookie store in your city? See how it works and send us an enquiry. Our franchise team will call you.',
  button: 'Franchise details', url: `${SITE}/franchise?${utm('menu_franchise')}`,
  summary: 'Sent the franchise link',
});

/* A line in the thread the assistant reads as "[note: …]", so it knows what the customer picked. */
const note = (conv: Conversation, body: string) =>
  recordMessage({ conversationId: conv.id, direction: 'out', sender: 'system', body });

async function onPick(conv: Conversation, id: string): Promise<boolean> {
  switch (id) {
    case ID.ORDER: await orderCard(conv); return true;
    case ID.CORPORATE: await corporateCard(conv); return true;
    case ID.FRANCHISE: await franchiseCard(conv); return true;
    case ID.ASK:
      await sendToCustomer(conv, 'Sure, go ahead. Ask me anything about our cookies, delivery or your orders.', 'bot', 'Doughie');
      return true;
    case ID.TICKET:
      await note(conv, 'The customer chose "Raise a ticket" from the menu.');
      await sendToCustomer(conv, conv.user_id
        ? 'Sure. What went wrong? Tell me in a message, and add the order number if you have it.'
        : "Sure. Tell me what went wrong. This number isn't linked to an A Dough Cookie account, so if you can, message us from the number you order with and I can look up the order too.",
        'bot', 'Doughie');
      return true;
    case ID.CONTINUE: {
      const t = await openTicket(conv);
      if (!t) {
        await sendToCustomer(conv, "That ticket is closed now. If something still isn't right, tell me what happened and I'll raise a new one.", 'bot', 'Doughie');
        return true;
      }
      await note(conv, `The customer chose to continue ticket ${t.id} from the menu.`);
      const where = t.status === 'IN_PROGRESS' ? 'Someone on the team is working on it.' : 'The team has it and will get back to you.';
      await sendToCustomer(conv, `Ticket ${t.id}: ${t.subject}. ${where} Send me anything you'd like to add and I'll put it on the ticket.`, 'bot', 'Doughie');
      return true;
    }
    default: return false;
  }
}

/**
 * Answers the message from the menu if it is a menu matter: a tapped row, a hello, or one of the
 * website's WhatsApp buttons. Returns false when the assistant should answer instead.
 */
export async function handleMenu(conv: Conversation, message: { body: string | null; replyId: string | null }): Promise<boolean> {
  if (conv.mode !== 'BOT') return false;
  if (message.replyId?.startsWith('MENU_')) return onPick(conv, message.replyId);

  const route = routeFor(message.body || '');
  if (!route) return false;
  const r = route === 'franchise' ? await franchiseCard(conv)
    : route === 'corporate' ? await corporateCard(conv)
    : route === 'order' ? await orderCard(conv)
    : await sendMenu(conv);
  // If Meta refused the list or card, the assistant answers instead, so the customer is never ignored.
  return r.ok;
}
