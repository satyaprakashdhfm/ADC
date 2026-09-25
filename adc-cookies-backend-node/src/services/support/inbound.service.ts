import { markReadAndTyping, log } from '../whatsapp.client.js';
import { conversationForPhone, attachTicket, latestOpenTicket, recordMessage, getConversation } from './conversation.service.js';
import { deliverHeld } from './outbound.service.js';
import { scheduleBotReply } from './bot.service.js';

/*
 * The message service: one customer message in, recorded once, routed.
 *
 *   record it       (a message Meta redelivers is recorded once and handled once)
 *   blue ticks      and "typing…" when the bot will answer
 *   held replies    a staff reply waiting for the 24-hour window goes out now it is open
 *   who answers     the bot, unless a person has the conversation
 *
 * Called from the webhook AFTER Meta has had its 200, so nothing here can slow the acknowledgement.
 */

/* The quick-reply button on support_reply. Tapping it asks for the held reply, not for the bot. */
const SHOW_REPLY = /^show reply$/i;

/* What a message says, whatever kind it is. */
function readMessage(m: any): { body: string | null; mediaType: string | null; mediaId: string | null } {
  switch (m?.type) {
    case 'text': return { body: m.text?.body ?? '', mediaType: null, mediaId: null };
    case 'button': return { body: m.button?.text || m.button?.payload || '', mediaType: null, mediaId: null };
    case 'interactive':
      return { body: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '', mediaType: null, mediaId: null };
    case 'image': case 'video': case 'audio': case 'document': case 'sticker': {
      const media = m[m.type] || {};
      const type = m.type === 'audio' && media.voice ? 'voice note' : m.type === 'document' ? 'file' : m.type;
      return { body: media.caption || media.filename || null, mediaType: type, mediaId: media.id || null };
    }
    case 'location': {
      const l = m.location || {};
      return { body: `Location: ${[l.name, l.address].filter(Boolean).join(', ')} (${l.latitude}, ${l.longitude})`, mediaType: null, mediaId: null };
    }
    default: return { body: `[${m?.type || 'unsupported'} message]`, mediaType: null, mediaId: null };
  }
}

export async function handleInboundMessages(value: any): Promise<void> {
  const names = new Map<string, string>();
  for (const c of value?.contacts ?? []) if (c?.wa_id) names.set(String(c.wa_id), c?.profile?.name || '');

  for (const m of value?.messages ?? []) {
    try {
      /* A reaction to one of our messages is not something to answer. */
      if (m?.type === 'reaction') continue;
      const from = String(m?.from || '');
      if (!from) continue;

      let conv = await conversationForPhone(from, names.get(from) || null);
      if (!conv.ticket_id && conv.user_id) {
        const t = await latestOpenTicket(conv.user_id);
        if (t) await attachTicket(conv.id, t.id);
      }

      const { body, mediaType, mediaId } = readMessage(m);
      const at = m?.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : undefined;
      const recorded = await recordMessage({
        conversationId: conv.id, direction: 'in', sender: 'customer', senderName: names.get(from) || null,
        body, mediaType, mediaId, waMessageId: String(m?.id || '') || null, at,
      });
      if (!recorded) {
        log('support', `duplicate ${m?.id} ignored`);
        continue;
      }
      conv = (await getConversation(conv.id)) || conv;
      log('support', `conv ${conv.id} | in (${m?.type}) | mode=${conv.mode}`);

      void markReadAndTyping(String(m.id), conv.mode === 'BOT');
      const delivered = await deliverHeld(conv.id);

      if (delivered && SHOW_REPLY.test(String(body || '').trim())) continue;
      if (conv.mode === 'BOT') scheduleBotReply(conv.id);
    } catch (err: any) {
      log('support', `✗ inbound ${m?.id}: ${err?.message || err}`);
    }
  }
}
