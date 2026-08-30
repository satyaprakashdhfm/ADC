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
}

export async function raiseTicket(
  { userId, subject, details, customerWords = null, category = 'OTHER', orderNumber = null, transcript = [] }: RaiseTicketInput,
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
    `INSERT INTO support_tickets (user_id, order_id, subject, details, customer_words, category, status, transcript, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7,$8,$8) RETURNING id`,
    [userId, order?.id ?? null, subject.slice(0, 200), details.slice(0, 4000),
     customerWords ? String(customerWords).slice(0, 4000) : null,
     normaliseCategory(category), JSON.stringify(transcript.slice(-8)), ts],
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
        + 'what arrived — or when they ask to speak to a person. Always tell them you have done it. '
        + 'Before raising one for a symptom that has more than one possible cause, ask the ONE '
        + 'question that separates them, then file with the answer included.',
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
      execute: async ({ subject, details, customerWords, category, orderNumber }) =>
        /* The turns come from the CALLER, not the model: it would otherwise be summarising the
           conversation into an argument describing that same conversation, and what a human needs
           here is what was actually said, not a second summary of it. */
        raiseTicket({ userId, subject, details, customerWords, category, orderNumber: orderNumber || null, transcript }),
    }),
  };
}
