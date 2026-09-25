import { z } from 'zod';
import { tool } from 'ai';
import { getAll, getOne } from '../../db/index.js';
import { addTicketNote } from '../ticket.service.js';
import { attachTicket, handToHuman } from './conversation.service.js';

/*
 * What the WhatsApp bot can do beyond the website assistant's tools.
 *
 * The same rule as chatTools.service: no tool takes a user id. The account is the one the sending
 * WhatsApp number belongs to, found by the webhook and closed over here, so a customer can read and
 * add to their OWN tickets and nobody else's, however the request is worded.
 */
export function buildSupportTools({ userId, conversationId }: { userId: number | null; conversationId: number }) {
  const handOver = {
    handOverToPerson: tool({
      description:
        'Pass this conversation to a person on the ADC team. Use when the customer asks for a human, '
        + 'when you cannot answer from your tools and rules, when they are upset, or for anything '
        + 'that needs a decision (refund, replacement, a damaged or missing item). After this you '
        + 'stop replying; tell them a person from the team will reply here.',
      inputSchema: z.object({ reason: z.string().describe('One line for the team: what they need') }),
      execute: async ({ reason }) => {
        await handToHuman(conversationId, reason);
        return { ok: true, note: 'Handed over. Tell the customer a person from the team will reply in this chat.' };
      },
    }),
  };
  if (!userId) return handOver;

  return {
    ...handOver,

    getMyTickets: tool({
      description:
        "This customer's support tickets, newest first, with status and the notes added since. Use "
        + 'for "what happened to my complaint", "any update", or to find which ticket they mean.',
      inputSchema: z.object({}),
      execute: async () => {
        const tickets = await getAll(
          `SELECT t.id, t.subject, t.category, t.status, t.created_at, t.updated_at, o.order_number,
                  (SELECT count(*)::int FROM support_ticket_notes n WHERE n.ticket_id = t.id) AS notes
             FROM support_tickets t LEFT JOIN orders o ON o.id = t.order_id
            WHERE t.user_id = $1 ORDER BY t.id DESC LIMIT 10`, [userId]);
        return { count: tickets.length, tickets };
      },
    }),

    addToMyTicket: tool({
      description:
        'Add what the customer just told you to one of THEIR tickets, by ticket number. Use when '
        + 'they give new information about a problem that already has a ticket (a photo, a detail, '
        + 'a changed request). Do NOT raise a new ticket for the same problem.',
      inputSchema: z.object({
        ticketId: z.number().int().describe('The ticket number'),
        text: z.string().describe("The new information, in the customer's own words where possible"),
      }),
      execute: async ({ ticketId, text }) => {
        const t = await getOne('SELECT id FROM support_tickets WHERE id = $1 AND user_id = $2', [ticketId, userId]);
        if (!t) return { ok: false, reason: 'No ticket with that number on this account.' };
        await addTicketNote(ticketId, text, 'WHATSAPP');
        await attachTicket(conversationId, ticketId);
        return { ok: true, ticketId };
      },
    }),
  };
}
