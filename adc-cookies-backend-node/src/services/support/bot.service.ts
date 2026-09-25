import { ToolLoopAgent, isStepCount } from 'ai';
import { getOne } from '../../db/index.js';
import { log } from '../whatsapp.client.js';
import { chatConfigured, chatModel, sharedRules } from '../chat.service.js';
import { buildTools } from '../chatTools.service.js';
import { buildTicketTool, type TicketTurn } from '../ticket.service.js';
import { buildSupportTools } from './botTools.service.js';
import { getConversation, recentMessages, handToHuman, attachTicket, type Conversation } from './conversation.service.js';
import { sendToCustomer } from './outbound.service.js';

/*
 * Doughie on WhatsApp.
 *
 * The same assistant as the website: the same rules (chat.service sharedRules), the same read-only
 * order tools, the same ticket tool. What WhatsApp adds is in WHATSAPP_RULES and botTools: reading
 * and adding to the customer's own tickets, and handing the chat to a person.
 *
 * It only ever answers the customer's own messages, so it is always inside Meta's 24-hour window.
 * Once a conversation is HUMAN it says nothing at all until a person hands it back.
 */

const WHATSAPP_RULES = `
YOU ARE ON WHATSAPP, replying from A Dough Cookie's business number.
- Write like a WhatsApp message: short and friendly, usually one to three short lines, never more
  than six. No headings, no tables, no markdown links. For emphasis use *single asterisks*. One
  emoji at most.
- The customer is already talking to us on WhatsApp. Never tell them they will get a WhatsApp
  message; this is it.
- A message starting with "[ADC team" was written by a person on our team. Never contradict it, and
  never repeat a promise from it as if it were yours.
- You cannot see photos, voice notes, videos or files. Say the team can see it. If it is about a
  damaged, wrong or missing item, add a line to their ticket that they sent one, then hand over.

TICKETS:
- One problem, one ticket. If they already have an open ticket about this problem, add anything new
  to it with addToMyTicket and never raise a second one. raiseSupportTicket also joins an open
  ticket about the same order automatically; when its result says alreadyOpen, give them that
  ticket number and say it was added to their existing ticket.
- Raise a new ticket only for a different problem, and ask only for what is missing (which order,
  what happened). Always tell them the ticket number.
- Never state a ticket's status other than what getMyTickets or the context below says. OPEN means
  the team has it and has not finished; IN_PROGRESS means someone is working on it; RESOLVED means
  the team marked it done.

HANDING OVER — use handOverToPerson when:
- they ask for a person, a call, or a manager;
- you cannot answer from your tools and rules (never guess to fill the gap);
- it needs a decision: a refund, a replacement, compensation, an exception;
- they are upset, or it is the second time they have asked for the same thing.
Make sure a ticket exists for the problem first, then hand over, then say a person from the team
will reply here as soon as they can. Never promise a time.
`.trim();

function whoRule(c: Conversation, name: string | null) {
  return c.user_id
    ? `This WhatsApp number belongs to the ADC account of ${name || 'this customer'}. You can look up THEIR `
      + `orders and tickets and nobody else's.`
    : `This WhatsApp number is not linked to any ADC account, so you cannot see any order or ticket. `
      + `Answer questions about our cookies, delivery areas and policies. For an order, ask them to write `
      + `from the phone number on their ADC account, or hand over to a person if they need help now.`;
}

async function ticketContext(c: Conversation): Promise<string> {
  if (!c.ticket_id || !c.user_id) return 'There is no ticket linked to this chat yet.';
  const t = await getOne(
    `SELECT t.id, t.subject, t.status, t.category, t.created_at, o.order_number
       FROM support_tickets t LEFT JOIN orders o ON o.id = t.order_id
      WHERE t.id = $1 AND t.user_id = $2`, [c.ticket_id, c.user_id]);
  if (!t) return 'There is no ticket linked to this chat yet.';
  return `This chat is currently about ticket ${t.id}: "${t.subject}" (status ${t.status}, category ${t.category}`
    + `${t.order_number ? `, order ${t.order_number}` : ''}, raised ${new Date(t.created_at).toDateString()}).`;
}

/* Markdown the model may still produce, turned into what WhatsApp shows properly. */
export function whatsappText(text: string): string {
  return String(text || '')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '_$1_')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1: $2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* The conversation as model turns. Staff and system lines are the assistant's side, labelled, so
   the model knows who said them. Consecutive turns from the same side are joined. */
function toTurns(rows: Awaited<ReturnType<typeof recentMessages>>) {
  const turns: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const r of rows) {
    const media = r.media_type ? `[sent a ${r.media_type}]` : '';
    let text = [media, r.body || ''].filter(Boolean).join(' ').trim();
    if (!text) continue;
    const role = r.sender === 'customer' ? 'user' : 'assistant';
    if (r.sender === 'store' || r.sender === 'admin') text = `[ADC team${r.sender_name ? `, ${r.sender_name}` : ''}]: ${text}`;
    if (r.sender === 'system') text = `[note: ${text}]`;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n${text}`;
    else turns.push({ role, content: text });
  }
  return turns;
}

/* A runaway conversation (a loop, an abusive sender) goes to a person rather than costing forever. */
const MAX_BOT_REPLIES_PER_DAY = 40;

async function runBot(conversationId: number) {
  const conv = await getConversation(conversationId);
  if (!conv || conv.mode === 'HUMAN') return;

  const busy = await getOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM wa_chat_messages WHERE conversation_id = $1 AND sender = 'bot' AND created_at > now() - interval '1 day'`,
    [conv.id]);
  if ((busy?.n ?? 0) >= MAX_BOT_REPLIES_PER_DAY) {
    await handToHuman(conv.id, 'Long conversation, the bot has stepped back');
    await sendToCustomer(conv, 'I have passed this chat to our team. A person will reply here as soon as they can.', 'bot', 'Doughie');
    return;
  }

  const turns = toTurns(await recentMessages(conv.id));
  /* Only answer when the customer spoke last: a person may have replied in the meantime. */
  if (!turns.length || turns[turns.length - 1]!.role !== 'user') return;

  const user = conv.user_id ? await getOne<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [conv.user_id]) : null;
  const instructions = [
    'You are Doughie, the support assistant for A Dough Cookie (ADC), an eggless cookie bakery in Bengaluru. '
      + 'Warm, brief and concrete. Never invent an order status, a ticket status, a date or a price: read it '
      + 'with a tool or say you do not know.',
    whoRule(conv, user?.name ?? conv.profile_name),
    await ticketContext(conv),
    WHATSAPP_RULES,
    ...sharedRules(),
  ].join('\n\n');

  const transcript: TicketTurn[] = turns.slice(-8).map((t) => ({ role: t.role, text: t.content.slice(0, 1000) }));
  const common = { model: chatModel(), instructions, stopWhen: isStepCount(6) };
  const agent = conv.user_id
    ? new ToolLoopAgent({
        ...common,
        tools: {
          ...buildTools({ userId: conv.user_id }),
          ...buildTicketTool(conv.user_id, transcript, 'WHATSAPP', (ticketId) => attachTicket(conv.id, ticketId)),
          ...buildSupportTools({ userId: conv.user_id, conversationId: conv.id }),
        },
      })
    : new ToolLoopAgent({
        ...common,
        tools: { ...buildTools({ userId: null }), ...buildSupportTools({ userId: null, conversationId: conv.id }) },
      });

  const result = await agent.generate({ messages: turns });
  const text = whatsappText(result.text);
  const fresh = (await getConversation(conv.id)) || conv;
  await sendToCustomer(fresh, text || 'Sorry, I could not get that just now. Could you say it another way?', 'bot', 'Doughie');
}

/*
 * One reply per burst. People send three short messages in a row; answering each one separately
 * reads like a machine talking over them. The reply waits until the customer has been quiet for a
 * moment, and a conversation is only ever being answered once at a time.
 */
const QUIET_MS = 2500;
const timers = new Map<number, NodeJS.Timeout>();
const running = new Set<number>();
const again = new Set<number>();

export function scheduleBotReply(conversationId: number) {
  if (!chatConfigured()) return;
  clearTimeout(timers.get(conversationId));
  timers.set(conversationId, setTimeout(() => void run(conversationId), QUIET_MS));
}

async function run(conversationId: number) {
  timers.delete(conversationId);
  if (running.has(conversationId)) { again.add(conversationId); return; }
  running.add(conversationId);
  try {
    await runBot(conversationId);
  } catch (err: any) {
    log('support', `conv ${conversationId} | ✗ bot failed: ${err?.message || err}`);
    const conv = await getConversation(conversationId).catch(() => null);
    if (conv && conv.mode === 'BOT') {
      await handToHuman(conv.id, 'The bot could not answer');
      await sendToCustomer(conv, 'Sorry, I could not get that just now. I have passed your message to our team and a person will reply here.', 'bot', 'Doughie').catch(() => {});
    }
  } finally {
    running.delete(conversationId);
    if (again.delete(conversationId)) scheduleBotReply(conversationId);
  }
}
