import { getOne, getAll, query, nowIso } from '../../db/index.js';
import { waNumber } from '../whatsapp.client.js';

/*
 * The conversation manager: one row per customer WhatsApp number (wa_conversations), and every
 * message in it (wa_chat_messages).
 *
 * WhatsApp support, end to end:
 *
 *   webhook ─> inbound.service ─> conversation.service ─> bot.service (Doughie + botTools)
 *                                                      └─> a person, in the store portal or admin
 *                                   outbound.service ─> whatsapp.client ─> Meta
 *
 * Nothing in here talks to Meta. It is the record of who said what, which ticket it is about, who
 * is answering (the bot or a person), and whether Meta's 24-hour window is still open.
 */

export type Sender = 'customer' | 'bot' | 'store' | 'admin' | 'system';

export type Conversation = {
  id: number;
  phone: string;
  user_id: number | null;
  profile_name: string | null;
  ticket_id: number | null;
  store_code: string | null;
  mode: 'BOT' | 'HUMAN';
  status: 'OPEN' | 'CLOSED';
  needs_human: boolean;
  needs_human_reason: string | null;
  taken_by: string | null;
  last_customer_at: string | null;
  last_message_at: string | null;
  unread_staff: number;
};

/*
 * Meta allows a free-form message for 24 hours after the customer's last one. Five minutes are kept
 * back so a reply typed at 23h58m is not refused on arrival.
 */
const WINDOW_MS = 24 * 3600_000 - 5 * 60_000;
export const windowOpen = (c: Pick<Conversation, 'last_customer_at'>) =>
  !!c.last_customer_at && Date.now() - new Date(c.last_customer_at).getTime() < WINDOW_MS;

export async function getConversation(id: number): Promise<Conversation | null> {
  return getOne<Conversation>('SELECT * FROM wa_conversations WHERE id = $1', [id]);
}

/*
 * The conversation for a number, made on first contact. The account is found by the number: users
 * .phone is stored as 91XXXXXXXXXX, the same shape Meta reports the sender in. A number with no
 * account still gets a conversation; the bot then has no account tools (see bot.service).
 */
export async function conversationForPhone(rawPhone: string, profileName?: string | null): Promise<Conversation> {
  const phone = waNumber(rawPhone);
  const user = await getOne<{ id: number }>('SELECT id FROM users WHERE phone = $1', [phone]);
  const ts = nowIso();
  const row = await getOne<Conversation>(
    `INSERT INTO wa_conversations (phone, user_id, profile_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (phone) DO UPDATE
       SET user_id = COALESCE(EXCLUDED.user_id, wa_conversations.user_id),
           profile_name = COALESCE(EXCLUDED.profile_name, wa_conversations.profile_name),
           updated_at = $4
     RETURNING *`,
    [phone, user?.id ?? null, profileName || null, ts]);
  return row!;
}

/*
 * Point the conversation at a ticket, and at the store that ticket belongs to. The store is what
 * decides which portal shows the chat; a ticket with no order leaves it NULL, which is admin only.
 */
export async function attachTicket(conversationId: number, ticketId: number) {
  const t = await getOne<{ store_code: string | null }>('SELECT store_code FROM support_tickets WHERE id = $1', [ticketId]);
  await query(
    `UPDATE wa_conversations SET ticket_id = $1, store_code = $2, status = 'OPEN', updated_at = $3 WHERE id = $4`,
    [ticketId, t?.store_code ?? null, nowIso(), conversationId]);
}

/* The ticket a conversation is about when nothing has pointed it at one yet: the customer's latest
   open one. Only ever their own. */
export async function latestOpenTicket(userId: number | null) {
  if (!userId) return null;
  return getOne<{ id: number }>(
    `SELECT id FROM support_tickets WHERE user_id = $1 AND status IN ('OPEN','IN_PROGRESS') ORDER BY updated_at DESC LIMIT 1`,
    [userId]);
}

export interface NewMessage {
  conversationId: number;
  direction: 'in' | 'out';
  sender: Sender;
  senderName?: string | null;
  body?: string | null;
  mediaType?: string | null;
  mediaId?: string | null;
  waMessageId?: string | null;
  status?: string;
  error?: string | null;
  at?: string;
}

/*
 * Record one message and move the conversation along with it.
 *
 * Returns null when the message is already recorded: Meta's id is unique here, and the insert that
 * hits it is the one place that makes a redelivered webhook harmless.
 */
export async function recordMessage(m: NewMessage): Promise<number | null> {
  const ts = m.at || nowIso();
  const conv = await getOne<{ ticket_id: number | null }>('SELECT ticket_id FROM wa_conversations WHERE id = $1', [m.conversationId]);
  const row = await getOne<{ id: number }>(
    `INSERT INTO wa_chat_messages (conversation_id, ticket_id, wa_message_id, direction, sender, sender_name, body,
                                   media_type, media_id, status, error, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
     ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [m.conversationId, conv?.ticket_id ?? null, m.waMessageId || null, m.direction, m.sender, m.senderName || null,
      m.body ? String(m.body).slice(0, 4096) : null, m.mediaType || null, m.mediaId || null,
      m.status || (m.direction === 'in' ? 'received' : 'sent'), m.error || null, ts]);
  if (!row) return null;

  const preview = (m.body || (m.mediaType ? `[${m.mediaType}]` : '')).replace(/\s+/g, ' ').slice(0, 120);
  if (m.sender === 'customer') {
    await query(
      `UPDATE wa_conversations
          SET last_customer_at = $1, last_message_at = $1, last_preview = $2, unread_staff = unread_staff + 1,
              status = 'OPEN', updated_at = $1
        WHERE id = $3`, [ts, preview, m.conversationId]);
  } else {
    await query('UPDATE wa_conversations SET last_message_at = $1, last_preview = $2, updated_at = $1 WHERE id = $3',
      [ts, preview, m.conversationId]);
  }
  return row.id;
}

/** Meta's delivery receipts, for support messages. Forward only, as for templates. */
export async function applyDeliveryStatus(waMessageId: string, status: string, error: string | null) {
  await query(
    `UPDATE wa_chat_messages
        SET status = $1::text, error = COALESCE($2, error), updated_at = $3
      WHERE wa_message_id = $4
        AND ($1::text = 'failed'
             OR COALESCE(array_position(ARRAY['sent','delivered','read'], $1::text), 0)
              > COALESCE(array_position(ARRAY['sent','delivered','read'], status), 0))`,
    [status, error, nowIso(), waMessageId]).catch(() => {});
}

/*
 * Hand the conversation to a person. The bot stops answering until someone hands it back, so the
 * customer is never talking to both at once.
 */
export async function handToHuman(conversationId: number, reason: string) {
  await query(
    `UPDATE wa_conversations SET mode = 'HUMAN', needs_human = true, needs_human_reason = $1, status = 'OPEN', updated_at = $2
      WHERE id = $3`, [String(reason || '').slice(0, 300), nowIso(), conversationId]);
  console.log(`[SUPPORT] conversation ${conversationId} | handed to a person | ${reason}`);
}

/** The last messages of a conversation, oldest first, for the bot to read. */
export async function recentMessages(conversationId: number, limit = 24) {
  const rows = await getAll<{ sender: Sender; sender_name: string | null; body: string | null; media_type: string | null; status: string; created_at: string }>(
    `SELECT sender, sender_name, body, media_type, status, created_at FROM wa_chat_messages
      WHERE conversation_id = $1 AND status <> 'held' ORDER BY id DESC LIMIT $2`, [conversationId, limit]);
  return rows.reverse();
}
