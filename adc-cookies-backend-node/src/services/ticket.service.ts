/*
 * Raising a support ticket — the assistant's ONLY write, and the only thing it can offer when
 * somebody asks for something it has no authority to do.
 *
 * That covers cancellations, refunds, address changes and anything else that alters an order. The
 * assistant has no tool for any of those, so this is not a fallback after a failed attempt; it is
 * the whole response. A person picks it up from the Messages tab or the email.
 *
 * The write is safe for the same reason the reads are: user_id comes from the verified session and
 * is closed over here, never supplied by the model. A ticket cannot be filed against another
 * account, and an order number the model passes is resolved against THIS customer's orders only —
 * so naming somebody else's order simply attaches nothing.
 */
import { z } from 'zod';
import { tool } from 'ai';
import { getOne, query, nowIso } from '../db/index.js';
import { sendSupportTicketEmail } from './mailer.client.js';

export type TicketTurn = { role: 'user' | 'assistant'; text: string };

/** How many tickets one account may raise in an hour, so a loop cannot flood the Messages tab. */
const MAX_PER_HOUR = 5;

export interface RaiseTicketInput {
  userId: number;
  subject: string;
  details: string;
  category?: string;
  orderNumber?: string | null;
  transcript?: TicketTurn[];
}

export async function raiseTicket(
  { userId, subject, details, category = 'GENERAL', orderNumber = null, transcript = [] }: RaiseTicketInput,
) {
  const recent = await getOne<{ n: number }>(
    "SELECT count(*)::int AS n FROM support_tickets WHERE user_id = $1 AND created_at > now() - interval '1 hour'",
    [userId],
  );
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
    return { ok: false as const, reason: 'rate_limited', message: 'A few tickets are already open for this account — the team will get to them shortly.' };
  }

  /* Resolve the order against THIS customer. An order number belonging to somebody else resolves to
     nothing and the ticket is simply filed without one, rather than pointing at a stranger's order. */
  const order = orderNumber
    ? await getOne<{ id: number; order_number: string }>(
        'SELECT id, order_number FROM orders WHERE user_id = $1 AND upper(order_number) = upper($2)',
        [userId, String(orderNumber).trim()],
      )
    : null;

  const ts = nowIso();
  const { rows: [row] } = await query<{ id: number }>(
    `INSERT INTO support_tickets (user_id, order_id, subject, details, category, status, transcript, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'OPEN',$6,$7,$7) RETURNING id`,
    [userId, order?.id ?? null, subject.slice(0, 200), details.slice(0, 4000),
     String(category || 'GENERAL').toUpperCase().slice(0, 40), JSON.stringify(transcript.slice(-8)), ts],
  );

  const customer = await getOne<{ name: string; email: string }>(
    'SELECT name, email FROM users WHERE id = $1', [userId],
  );

  /* Email last and never fatal: the ticket is already committed, and a mail outage must not make a
     recorded request look like it was never made. */
  await sendSupportTicketEmail({
    id: row!.id, subject, details, category: String(category || 'GENERAL'),
    orderNumber: order?.order_number ?? null,
    customerName: customer?.name ?? null, customerEmail: customer?.email ?? null,
    transcript,
  }).catch((e: any) => console.error(`[TICKET] email failed | ticket=${row!.id} | ${e?.message || e}`));

  console.log(`[TICKET] raised | id=${row!.id} | user=${userId} | order=${order?.order_number ?? 'none'} | ${subject}`);
  return { ok: true as const, ticketId: row!.id, orderNumber: order?.order_number ?? null };
}

/**
 * The tool form. `transcript` is the conversation so far, supplied by the route rather than by the
 * model, so the ticket carries what was actually asked. Takes a real user id, never null — a signed-out visitor has no account to file
 * against, so the CALLER leaves this out of the tool set entirely rather than passing null and
 * having the tool refuse. Asking someone for details we cannot attach to anything would be theatre.
 */
export function buildTicketTool(userId: number, transcript: TicketTurn[] = []) {
  return {
    raiseSupportTicket: tool({
      description:
        'Raise a ticket for the ADC team. Use this whenever the customer wants something you cannot '
        + 'do yourself — cancel an order, change an address, chase a refund, report a problem with '
        + 'what arrived — or when they ask to speak to a person. Always tell them you have done it.',
      inputSchema: z.object({
        subject: z.string().describe('One short line, e.g. "Cancel order ADC20260821072232"'),
        details: z.string().describe("What the customer wants, in their own words where possible"),
        category: z.string().default('GENERAL').describe('CANCELLATION, REFUND, DELIVERY, PRODUCT, or GENERAL'),
        orderNumber: z.string().default('').describe('The ADC order number if this is about one; empty otherwise'),
      }),
      execute: async ({ subject, details, category, orderNumber }) =>
        /* The turns come from the CALLER, not the model: it would otherwise be summarising the
           conversation into an argument describing that same conversation, and what a human needs
           here is what was actually said, not a second summary of it. */
        raiseTicket({ userId, subject, details, category, orderNumber: orderNumber || null, transcript }),
    }),
  };
}
