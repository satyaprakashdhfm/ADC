import { getAll, getOne, query, nowIso } from '../../db/index.js';
import { sendText, log } from '../whatsapp.client.js';
import { sendWhatsApp, templateApproved } from '../whatsapp.service.js';
import { SUPPORT_REPLY } from '../whatsapp.templates.js';
import { recordMessage, windowOpen, getConversation, type Conversation, type Sender } from './conversation.service.js';

/*
 * Every support message we send goes through here, whoever wrote it: the bot, a store, or admin.
 *
 * Meta's rule, which this file exists to keep: a free-form message is allowed only within 24 hours
 * of the customer's last message. Outside that window,
 *
 *   the reply is saved as 'held' (visible to staff, not yet sent),
 *   ONE support_reply template tells the customer there is a reply waiting,
 *   and when they answer it, or write anything, deliverHeld() sends everything held, in order.
 *
 * No other path sends free text to a customer, so no other path can break the rule.
 */

/* WhatsApp's limit for one text message. */
const MAX_TEXT = 4096;

export async function sendToCustomer(conv: Conversation, body: string, sender: Exclude<Sender, 'customer'>, senderName: string | null = null) {
  const text = String(body || '').trim().slice(0, MAX_TEXT);
  if (!text) return { ok: false as const, reason: 'empty' };

  if (!windowOpen(conv)) {
    await recordMessage({ conversationId: conv.id, direction: 'out', sender, senderName, body: text, status: 'held' });
    await announceHeld(conv);
    return { ok: true as const, held: true };
  }

  const r: any = await sendText(conv.phone, text);
  await recordMessage({
    conversationId: conv.id, direction: 'out', sender, senderName, body: text,
    waMessageId: r.ok ? r.messageId : null, status: r.ok ? 'sent' : 'failed', error: r.ok ? null : String(r.reason).slice(0, 300),
  });
  log('support', `conv ${conv.id} | ${sender} reply | ${r.ok ? '✓' : `✗ ${r.reason}`}`);
  return r.ok ? { ok: true as const, held: false } : { ok: false as const, reason: String(r.reason) };
}

/*
 * The "you have a reply" template, at most once per stretch of silence: if one already went out
 * since the customer last wrote, another would only nag.
 */
async function announceHeld(conv: Conversation) {
  const since = conv.last_customer_at || '1970-01-01';
  const already = await getOne(
    `SELECT 1 FROM wa_chat_messages WHERE conversation_id = $1 AND sender = 'system' AND body LIKE 'Reply notice%' AND created_at > $2 LIMIT 1`,
    [conv.id, since]);
  if (already) return;
  if (!(await templateApproved(SUPPORT_REPLY.name, SUPPORT_REPLY.language))) {
    await recordMessage({ conversationId: conv.id, direction: 'out', sender: 'system', status: 'failed',
      body: 'Reply notice not sent: the support_reply template is not approved yet. The reply goes out when the customer next writes.' });
    return;
  }
  const user = conv.user_id ? await getOne<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [conv.user_id]) : null;
  const r = await sendWhatsApp(SUPPORT_REPLY, { customerName: user?.name || conv.profile_name },
    { to: conv.phone, userId: conv.user_id, label: `conversation ${conv.id}` });
  await recordMessage({
    conversationId: conv.id, direction: 'out', sender: 'system',
    body: r.ok ? 'Reply notice sent. The reply goes out when the customer taps "Show reply" or writes back.'
      : `Reply notice could not be sent (${r.reason}). The reply goes out when the customer next writes.`,
    status: r.ok ? 'sent' : 'failed',
  });
}

/* Everything held for this conversation, sent now that the window is open again. Oldest first. */
export async function deliverHeld(conversationId: number) {
  const conv = await getConversation(conversationId);
  if (!conv || !windowOpen(conv)) return 0;
  const held = await getAll<{ id: number; body: string }>(
    `SELECT id, body FROM wa_chat_messages WHERE conversation_id = $1 AND status = 'held' ORDER BY id`, [conversationId]);
  for (const m of held) {
    const r: any = await sendText(conv.phone, m.body);
    await query('UPDATE wa_chat_messages SET status = $1, wa_message_id = $2, error = $3, updated_at = $4 WHERE id = $5',
      [r.ok ? 'sent' : 'failed', r.ok ? r.messageId : null, r.ok ? null : String(r.reason).slice(0, 300), nowIso(), m.id]);
  }
  if (held.length) log('support', `conv ${conversationId} | delivered ${held.length} held repl${held.length === 1 ? 'y' : 'ies'}`);
  return held.length;
}
