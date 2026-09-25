import { getOne } from '../../db/index.js';
import { whatsappConfigured, log } from '../whatsapp.client.js';
import { sendWhatsApp, templateApproved } from '../whatsapp.service.js';
import { TICKET_CREATED } from '../whatsapp.templates.js';
import { conversationForPhone, attachTicket, recordMessage } from './conversation.service.js';

/*
 * A ticket raised on the website moves to WhatsApp: the ticket_created template goes to the
 * account's number, and the conversation for that number is pointed at the ticket so that whatever
 * the customer replies lands on it, in front of the right store.
 *
 * Called by raiseTicket only after the ticket is committed, and only for a NEW ticket (a request
 * that joined an open one is not announced again). Never throws: the ticket stands whatever
 * WhatsApp does.
 */
export async function notifyTicketCreated(ticketId: number): Promise<void> {
  try {
    if (!whatsappConfigured()) return;
    const t = await getOne<{ id: number; subject: string; user_id: number; name: string | null; phone: string | null }>(
      `SELECT t.id, t.subject, t.user_id, u.name, u.phone
         FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`, [ticketId]);
    if (!t) return;
    if (!t.phone) {
      log('support', `ticket ${ticketId} | no WhatsApp message — no phone on the account`);
      return;
    }

    const conv = await conversationForPhone(t.phone);
    await attachTicket(conv.id, t.id);
    if (!(await templateApproved(TICKET_CREATED.name, TICKET_CREATED.language))) {
      log('support', `ticket ${ticketId} | ${TICKET_CREATED.name} not approved yet — chat linked, no message sent`);
      return;
    }
    const r = await sendWhatsApp(TICKET_CREATED, { customerName: t.name, ticketId: t.id, summary: t.subject },
      { to: t.phone, userId: t.user_id, label: `ticket ${t.id}` });
    await recordMessage({
      conversationId: conv.id, direction: 'out', sender: 'system',
      body: `Ticket ${t.id} raised on the website: ${t.subject}`,
      waMessageId: r.ok ? r.messageId : null, status: r.ok ? 'sent' : 'failed', error: r.ok ? null : r.reason,
    });
  } catch (err: any) {
    log('support', `ticket ${ticketId} | ✗ WhatsApp notice failed: ${err?.message || err}`);
  }
}
