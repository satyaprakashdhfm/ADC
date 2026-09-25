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
import { notifyTicketCreated } from './support/ticketNotify.service.js';

export type TicketTurn = { role: 'user' | 'assistant'; text: string };

/*
 * The categories, as a closed list.
 *
 * This was a free-text string with five suggested values, and the cost of that showed up the first
 * time somebody described a problem that fit none of them: a customer whose DELIVERY OTP never
 * arrived — the courier's code, at the door — was filed as a sign-in problem, because LOGIN was the
 * nearest thing on offer and the model had to pick something.
 *
 * So the list now covers what people actually contact a bakery about, and the two OTP situations
 * are separate entries rather than one word doing double duty. OTHER is a real destination, not a
 * failure: a request that does not fit belongs in OTHER with the customer's own words intact, which
 * is far more useful than the closest wrong label.
 */
export const TICKET_CATEGORIES = [
  'ORDER_TRACKING',     // where is it, why is it late
  'DELIVERY_HANDOVER',  // the rider is here / the delivery OTP at the door / handover failed
  'CANCELLATION',
  'REFUND',
  'PAYMENT',            // failed, charged twice, the bank's OTP
  'LOGIN_ACCESS',       // cannot sign in, our sign-in OTP did not arrive
  'CONTACT_DETAILS',    // wrong phone or address on the order
  'PRODUCT',            // quality, wrong or missing item, allergens
  'OTHER',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** Anything the model invents lands in OTHER rather than being written to the row unchecked. */
export function normaliseCategory(v: unknown): TicketCategory {
  const c = String(v ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (TICKET_CATEGORIES as readonly string[]).includes(c) ? (c as TicketCategory) : 'OTHER';
}

/** How many tickets one account may raise in an hour, so a loop cannot flood the Messages tab. */
const MAX_PER_HOUR = 5;

export interface RaiseTicketInput {
  userId: number;
  subject: string;
  details: string;
  /** The customer's own sentences, unparaphrased. See the column comment in initSchema. */
  customerWords?: string | null;
  category?: string;
  orderNumber?: string | null;
  transcript?: TicketTurn[];
  /** Where it was raised. A WhatsApp ticket gets no WhatsApp announcement: the customer is in the chat. */
  source?: 'WEB' | 'WHATSAPP';
}

/*
 * The ticket this request belongs to, if the customer already has one open about the same thing.
 *
 * People ask twice: they raise a ticket on the website, then say the same on WhatsApp, or ask the
 * assistant again an hour later because nobody has answered yet. Each of those used to be a new
 * ticket, and two people could pick up the same problem. So a request is the SAME ticket when it is
 * about the same order, or, with no order, the same kind of problem within a week, and the new
 * words become a note on it instead.
 */
async function openTicketFor(userId: number, orderId: number | null, category: TicketCategory) {
  return getOne<{ id: number }>(
    `SELECT id FROM support_tickets
      WHERE user_id = $1 AND status IN ('OPEN','IN_PROGRESS')
        AND (($2::int IS NOT NULL AND order_id = $2::int)
          OR ($2::int IS NULL AND order_id IS NULL AND category = $3 AND created_at > now() - interval '7 days'))
      ORDER BY id DESC LIMIT 1`,
    [userId, orderId, category],
  );
}

/** A note on an existing ticket. The ticket's updated_at moves, so it rises in the team's list. */
export async function addTicketNote(ticketId: number, body: string, source: 'WEB' | 'WHATSAPP' | 'STAFF', author: string | null = null) {
  const ts = nowIso();
  await query('INSERT INTO support_ticket_notes (ticket_id, source, author, body, created_at) VALUES ($1,$2,$3,$4,$5)',
    [ticketId, source, author, String(body).slice(0, 4000), ts]);
  await query("UPDATE support_tickets SET updated_at = $1, status = CASE WHEN status = 'RESOLVED' THEN 'OPEN' ELSE status END WHERE id = $2", [ts, ticketId]);
}

export async function raiseTicket(
  { userId, subject, details, customerWords = null, category = 'OTHER', orderNumber = null, transcript = [], source = 'WEB' }: RaiseTicketInput,
) {
  /* Resolve the order against THIS customer. An order number belonging to somebody else resolves to
     nothing and the ticket is simply filed without one, rather than pointing at a stranger's order. */
  const order = orderNumber
    ? await getOne<{ id: number; order_number: string; store_code: string | null }>(
        'SELECT id, order_number, store_code FROM orders WHERE user_id = $1 AND upper(order_number) = upper($2)',
        [userId, String(orderNumber).trim()],
      )
    : null;

  const cat = normaliseCategory(category);
  const already = await openTicketFor(userId, order?.id ?? null, cat);
  if (already) {
    await addTicketNote(already.id, customerWords || details, source);
    console.log(`[TICKET] same as open ticket ${already.id} | user=${userId} | added as a note`);
    return {
      ok: true as const, ticketId: already.id, orderNumber: order?.order_number ?? null, alreadyOpen: true,
      message: `Ticket ${already.id} was already open for this, so this was added to it. Give the customer that `
        + 'number and say it was added to their existing ticket. Do not say a new ticket was raised.',
    };
  }

  const recent = await getOne<{ n: number }>(
    "SELECT count(*)::int AS n FROM support_tickets WHERE user_id = $1 AND created_at > now() - interval '1 hour'",
    [userId],
  );
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
    return { ok: false as const, reason: 'rate_limited', message: 'A few tickets are already open for this account — the team will get to them shortly.' };
  }

  const ts = nowIso();
  const { rows: [row] } = await query<{ id: number }>(
    `INSERT INTO support_tickets (user_id, order_id, subject, details, customer_words, category, status, transcript, source, store_code, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7,$8,$9,$10,$10) RETURNING id`,
    [userId, order?.id ?? null, subject.slice(0, 200), details.slice(0, 4000),
     customerWords ? String(customerWords).slice(0, 4000) : null,
     cat, JSON.stringify(transcript.slice(-8)), source, order?.store_code ?? null, ts],
  );

  const customer = await getOne<{ name: string; email: string }>(
    'SELECT name, email FROM users WHERE id = $1', [userId],
  );

  /* Email last and never fatal: the ticket is already committed, and a mail outage must not make a
     recorded request look like it was never made. */
  await sendSupportTicketEmail({
    id: row!.id, subject, details, customerWords, category: normaliseCategory(category),
    orderNumber: order?.order_number ?? null,
    customerName: customer?.name ?? null, customerEmail: customer?.email ?? null,
    transcript,
  }).catch((e: any) => console.error(`[TICKET] email failed | ticket=${row!.id} | ${e?.message || e}`));

  /* The WhatsApp message that moves the conversation there. After the ticket is committed, in the
     background, and never fatal: a WhatsApp problem must not undo a ticket. */
  if (source === 'WEB') void notifyTicketCreated(row!.id);

  console.log(`[TICKET] raised | id=${row!.id} | user=${userId} | order=${order?.order_number ?? 'none'} | ${subject}`);
  return { ok: true as const, ticketId: row!.id, orderNumber: order?.order_number ?? null, alreadyOpen: false };
}

/**
 * The tool form. `transcript` is the conversation so far, supplied by the route rather than by the
 * model, so the ticket carries what was actually asked. Takes a real user id, never null — a signed-out visitor has no account to file
 * against, so the CALLER leaves this out of the tool set entirely rather than passing null and
 * having the tool refuse. Asking someone for details we cannot attach to anything would be theatre.
 */
export function buildTicketTool(
  userId: number, transcript: TicketTurn[] = [], source: 'WEB' | 'WHATSAPP' = 'WEB',
  /** Told the ticket's number once it is raised or joined; WhatsApp points its conversation at it. */
  onTicket?: (ticketId: number) => Promise<void>,
) {
  return {
    raiseSupportTicket: tool({
      description:
        'Raise a ticket for the ADC team. Use this whenever the customer wants something you cannot '
        + 'do yourself — cancel an order, change an address, chase a refund, report a problem with '
        + 'what arrived — or when they ask to speak to a person. Always tell them you have done it. '
        + 'Before raising one for a symptom that has more than one possible cause, ask the ONE '
        + 'question that separates them, then file with the answer included. If the customer '
        + 'already has a ticket open about the same thing, this adds to it rather than opening a '
        + 'second one, and the result says so.',
      inputSchema: z.object({
        subject: z.string().describe('One short line, e.g. "Cancel order ADC20260821072232"'),
        details: z.string().describe(
          'YOUR reading of the problem: what they need, and anything you established by asking. '
          + 'Do not put your guess at the cause here if they did not say it.',
        ),
        /*
         * The verbatim field, and the reason the whole schema changed.
         *
         * Everything else here is the model's interpretation, and an interpretation is exactly what
         * failed us: "my OTP is not coming" became a sign-in ticket when the customer meant the
         * courier's code at her door. Whoever picks the ticket up needs the sentence she actually
         * typed, not a second-hand rendering of it, so this is required and explicitly not a summary.
         */
        customerWords: z.string().describe(
          "The customer's OWN words, quoted as they typed them — do not paraphrase, correct or "
          + 'shorten. If they said it across several messages, join them. This is what the team '
          + 'reads when your reading turns out to be wrong.',
        ),
        category: z.enum(TICKET_CATEGORIES).default('OTHER').describe(
          'ORDER_TRACKING (where is it, why late) · DELIVERY_HANDOVER (rider at the door, the '
          + 'delivery OTP the RIDER asks for, handover failed) · CANCELLATION · REFUND · PAYMENT '
          + "(failed, charged twice, the bank's OTP) · LOGIN_ACCESS (cannot sign in, OUR sign-in "
          + 'OTP did not arrive) · CONTACT_DETAILS (wrong phone or address on the order) · PRODUCT '
          + '(quality, wrong or missing item, allergens) · OTHER. Pick OTHER rather than forcing a '
          + 'near-miss — a wrong label sends the ticket to the wrong person.',
        ),
        orderNumber: z.string().default('').describe('The ADC order number if this is about one; empty otherwise'),
      }),
      execute: async ({ subject, details, customerWords, category, orderNumber }) => {
        /* The turns come from the CALLER, not the model: it would otherwise be summarising the
           conversation into an argument describing that same conversation, and what a human needs
           here is what was actually said, not a second summary of it. */
        const r = await raiseTicket({ userId, subject, details, customerWords, category, orderNumber: orderNumber || null, transcript, source });
        if (r.ok && onTicket) await onTicket(r.ticketId).catch(() => {});
        return r;
      },
    }),
  };
}
