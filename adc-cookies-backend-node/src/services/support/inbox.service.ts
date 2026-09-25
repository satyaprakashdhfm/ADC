import { getAll, getOne, query, nowIso } from '../../db/index.js';
import { downloadMedia } from '../whatsapp.client.js';
import { getConversation, windowOpen, type Conversation } from './conversation.service.js';
import { sendToCustomer } from './outbound.service.js';

/*
 * The support inbox, as the store portal and the admin dashboard both see it. One implementation,
 * two scopes:
 *
 *   store   only conversations whose ticket belongs to an order of THAT store
 *   admin   every conversation, including the ones about no order at all
 *
 * The scope is decided by the route from the signed-in credential, never from the request, and
 * every read and write below goes through it, so a store cannot open another store's chat by id.
 */
export type InboxScope = { kind: 'store'; storeCode: string } | { kind: 'admin' };
export interface Staff { sender: 'store' | 'admin'; name: string }

const scopeWhere = (scope: InboxScope, alias = 'c', param = '$1') =>
  scope.kind === 'store' ? { sql: `${alias}.store_code = ${param}`, params: [scope.storeCode] } : { sql: 'TRUE', params: [] as string[] };

async function scoped(scope: InboxScope, id: number): Promise<Conversation | null> {
  const c = await getConversation(id);
  if (!c) return null;
  if (scope.kind === 'store' && c.store_code !== scope.storeCode) return null;
  return c;
}

function shape(r: any) {
  return {
    id: r.id,
    name: r.user_name || r.profile_name || `+${r.phone}`,
    phone: `+${r.phone}`,
    linkedAccount: !!r.user_id,
    preview: r.last_preview || '',
    lastMessageAt: r.last_message_at,
    unread: Number(r.unread_staff) || 0,
    mode: r.mode as 'BOT' | 'HUMAN',
    status: r.status as 'OPEN' | 'CLOSED',
    needsHuman: !!r.needs_human,
    needsHumanReason: r.needs_human_reason || null,
    takenBy: r.taken_by || null,
    windowOpen: windowOpen(r),
    storeCode: r.store_code || null,
    ticket: r.ticket_id
      ? { id: r.ticket_id, subject: r.ticket_subject, status: r.ticket_status, orderNumber: r.order_number || null }
      : null,
  };
}

const LIST_SQL = `
  SELECT c.*, u.name AS user_name, t.subject AS ticket_subject, t.status AS ticket_status, o.order_number
    FROM wa_conversations c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN support_tickets t ON t.id = c.ticket_id
    LEFT JOIN orders o ON o.id = t.order_id`;

export async function listConversations(scope: InboxScope) {
  const w = scopeWhere(scope);
  const rows = await getAll(`${LIST_SQL} WHERE ${w.sql} AND c.last_message_at IS NOT NULL ORDER BY c.last_message_at DESC LIMIT 200`, w.params);
  return rows.map(shape);
}

/* Opening a conversation reads it: its unread count goes to zero for everyone on staff. */
export async function openConversation(scope: InboxScope, id: number) {
  const c = await scoped(scope, id);
  if (!c) return null;
  await query('UPDATE wa_conversations SET unread_staff = 0 WHERE id = $1', [id]);
  const row = await getOne(`${LIST_SQL} WHERE c.id = $1`, [id]);
  const messages = await getAll(
    `SELECT id, direction, sender, sender_name, body, media_type, media_id, status, error, created_at
       FROM (SELECT * FROM wa_chat_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 300) m ORDER BY id`, [id]);
  const notes = c.ticket_id
    ? await getAll('SELECT source, author, body, created_at FROM support_ticket_notes WHERE ticket_id = $1 ORDER BY id', [c.ticket_id])
    : [];
  return {
    conversation: shape({ ...row, unread_staff: 0 }),
    messages: messages.map((m) => ({
      id: m.id, direction: m.direction, sender: m.sender, senderName: m.sender_name, body: m.body,
      mediaType: m.media_type, mediaId: m.media_id, status: m.status, error: m.error, createdAt: m.created_at,
    })),
    ticketNotes: notes.map((n) => ({ source: n.source, author: n.author, body: n.body, createdAt: n.created_at })),
  };
}

/*
 * A person replies. Replying is taking over: the bot goes quiet on this conversation until someone
 * hands it back, so the customer never gets an answer from both.
 */
export async function staffReply(scope: InboxScope, id: number, text: string, who: Staff) {
  const c = await scoped(scope, id);
  if (!c) return { ok: false as const, reason: 'not_found' };
  await query(
    `UPDATE wa_conversations SET mode = 'HUMAN', taken_by = COALESCE(taken_by, $1), needs_human = false, status = 'OPEN', updated_at = $2 WHERE id = $3`,
    [who.name, nowIso(), id]);
  const fresh = (await getConversation(id))!;
  return sendToCustomer(fresh, text, who.sender, who.name);
}

export async function takeOver(scope: InboxScope, id: number, who: Staff) {
  const c = await scoped(scope, id);
  if (!c) return false;
  await query(`UPDATE wa_conversations SET mode = 'HUMAN', taken_by = $1, updated_at = $2 WHERE id = $3`, [who.name, nowIso(), id]);
  return true;
}

/* Back to the bot. It answers the customer's NEXT message, not anything already said. */
export async function handBack(scope: InboxScope, id: number) {
  const c = await scoped(scope, id);
  if (!c) return false;
  await query(`UPDATE wa_conversations SET mode = 'BOT', taken_by = NULL, needs_human = false, needs_human_reason = NULL, updated_at = $1 WHERE id = $2`, [nowIso(), id]);
  return true;
}

/*
 * Done. The conversation closes and goes back to the bot, so whatever the customer writes next is
 * answered; with resolveTicket the ticket is marked RESOLVED too. A new message reopens it.
 */
export async function closeConversation(scope: InboxScope, id: number, resolveTicket: boolean) {
  const c = await scoped(scope, id);
  if (!c) return false;
  const ts = nowIso();
  await query(
    `UPDATE wa_conversations SET status = 'CLOSED', mode = 'BOT', taken_by = NULL, needs_human = false, needs_human_reason = NULL,
            unread_staff = 0, updated_at = $1 WHERE id = $2`, [ts, id]);
  if (resolveTicket && c.ticket_id) {
    await query(`UPDATE support_tickets SET status = 'RESOLVED', updated_at = $1 WHERE id = $2`, [ts, c.ticket_id]);
  }
  return true;
}

/*
 * What the badge and the chime need, cheap enough to ask every few seconds. latestCustomerAt is the
 * newest customer message in scope: when it moves, a new message has arrived.
 */
export async function inboxSummary(scope: InboxScope) {
  const w = scopeWhere(scope);
  const r = await getOne(
    `SELECT count(*) FILTER (WHERE c.unread_staff > 0)::int AS unread_chats,
            count(*) FILTER (WHERE c.needs_human AND c.status = 'OPEN')::int AS needs_human,
            max(c.last_customer_at) AS latest_customer_at
       FROM wa_conversations c WHERE ${w.sql}`, w.params);
  return { unreadChats: r?.unread_chats ?? 0, needsHuman: r?.needs_human ?? 0, latestCustomerAt: r?.latest_customer_at ?? null };
}

/* A photo or file from a customer, only if it belongs to a conversation this scope can see. */
export async function mediaFor(scope: InboxScope, mediaId: string) {
  const w = scopeWhere(scope, 'c', '$2');
  const owned = await getOne(
    `SELECT 1 FROM wa_chat_messages m JOIN wa_conversations c ON c.id = m.conversation_id
      WHERE m.media_id = $1 AND ${w.sql} LIMIT 1`, [mediaId, ...w.params]);
  if (!owned) return null;
  return downloadMedia(mediaId);
}
