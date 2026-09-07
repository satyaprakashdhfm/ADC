
/*
 * Email via ZeptoMail's HTTPS API.
 *
 * ZeptoMail is Zoho's transactional sender, and the mailboxes for this domain are already Zoho —
 * so the sending domain, the DKIM key and the bounce handling all sit with the same provider that
 * holds the inbox, instead of being split across two.
 *
 * THE INDIA DATA CENTRE MATTERS. This account is on Zoho's India DC (the MX records are
 * mx.zoho.in), and ZeptoMail's hosts, consoles and keys are per-DC. A key from one DC used against
 * another's host fails as an auth error that says nothing about the cause, so the host is a
 * variable rather than a constant and defaults to the .in endpoint.
 *
 * HTTPS, not SMTP, even though Pro lifts Railway's SMTP block. It keeps this file a single fetch
 * with no sockets, connection pool or timeouts to own, it cannot be re-broken by a change in
 * Railway's egress policy, and it is the shape the Resend path already had. The dead nodemailer
 * block that used to sit at the bottom of this file goes with it.
 *
 * Env vars:
 *   ZEPTOMAIL_API_KEY  = the Agent's "Send API key" (Agents > SMTP/API > Send API key). Sent as
 *                        `Authorization: Zoho-enczapikey <key>` — the scheme word is part of the
 *                        header VALUE, and `Bearer <key>` fails here.
 *   ZEPTOMAIL_API_URL  = optional override. Defaults to https://api.zeptomail.in/v1.1/email
 *   RESEND_API_KEY     = RETIRED 2026-09-07. Read by nothing; the Resend transport below is
 *                        commented out and both go on 2026-09-09.
 *   MAIL_USER          = the address that sends mail (info@adoughcookie.com). Must be on a domain
 *                        VERIFIED IN THE AGENT or ZeptoMail rejects the request outright.
 *   BUSINESS_EMAIL     = where enquiries / order copies go (defaults to MAIL_USER)
 *
 * With no key set, email is skipped and logged — the API keeps working. Sending never throws,
 * so it cannot break a request.
 *
 * ZeptoMail is TRANSACTIONAL ONLY and its terms forbid bulk or promotional mail. Everything sent
 * from this file qualifies: order confirmations, delivery milestones, cancellations, contact
 * replies, support tickets, spin rewards. A marketing send would risk the same account that
 * delivers order confirmations — that belongs in Zoho Campaigns.
 */

function cfg() {
  return {
    user: process.env.MAIL_USER || '',
    business: process.env.BUSINESS_EMAIL || process.env.MAIL_USER || '',
  };
}

interface OutgoingMail {
  to?: string | null;
  subject: string;
  html: string;
  /** Optional: only the contact form sets it, so the customer's address is what Reply hits. */
  replyTo?: string | null;
}

const ZEPTO_URL = process.env.ZEPTOMAIL_API_URL || 'https://api.zeptomail.in/v1.1/email';

/*
 * Tolerate the key being pasted with its scheme word already attached.
 *
 * ZeptoMail's console presents the credential as `Zoho-enczapikey wSsV...`, so copying the line
 * rather than the token is the obvious mistake {D} and it was made here on the first attempt. We
 * add the scheme ourselves, so the header would have gone out with it twice and failed as a bare
 * auth error naming nothing. Accept either form: the operator should not have to know which half
 * of a displayed value we wanted.
 */
const zeptoKeyFrom = (raw: string) => raw.trim().replace(/^Zoho-enczapikey\s+/i, '');

/*
 * ZeptoMail's body is asymmetric in a way that is easy to get inside out: `to` is an array of
 * objects WRAPPING an `email_address`, while `reply_to` is an array of the address objects
 * directly. Swapping them is still valid JSON and is rejected by the API rather than by the
 * compiler.
 */
async function sendViaZeptoMail(apiKey, { to, subject, html, replyTo }: OutgoingMail) {
  const res = await fetch(ZEPTO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-enczapikey ${zeptoKeyFrom(apiKey)}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: { address: cfg().user, name: 'a dough cookie' },
      to: [{ email_address: { address: to } }],
      subject,
      htmlbody: html,
      ...(replyTo ? { reply_to: [{ address: replyTo }] } : {}),
      /* Off deliberately. Open tracking injects a pixel and click tracking rewrites every link
         through a redirector — on an order confirmation that buys nothing and costs the customer
         a rewritten "Track your parcel" URL. */
      track_opens: false,
      track_clicks: false,
    }),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    /* Their failures nest the useful part: error.details[].message names what was wrong and
       .target names the field, while error.message is a generic status. Without this a rejected
       sender address reads only as "Request not valid". */
    const d = body?.error?.details?.[0];
    const why = d?.message || body?.error?.message || body?.message || `HTTP ${res.status}`;
    throw new Error(d?.target ? `${why} (field: ${d.target})` : why);
  }
  return body?.request_id || body?.data?.[0]?.code || '?';
}

/*
 * Resend — RETIRED 2026-09-07, kept commented for two days and then to be deleted.
 *
 * ZeptoMail is proven on both environments (a real send to a Gmail address arrived with
 * dkim=pass for adoughcookie.com), so nothing reaches this code any more. It stays only as a
 * short-lived record of the previous transport while the new one settles.
 *
 * NOTE ON REVERTING: uncommenting this is a code change and a deploy. While the fallback was
 * live, reverting was deleting one variable. If ZeptoMail turns out to have a problem in the
 * next two days, restoring RESEND_API_KEY alone will NOT bring mail back — this function has
 * to come back with it.
 *
 * DELETE ME after 2026-09-09 along with RESEND_API_KEY on both Railway services.
 */
// async function sendViaResend(apiKey, { to, subject, html, replyTo }: OutgoingMail) {
//   const res = await fetch('https://api.resend.com/emails', {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       from: `a dough cookie <${cfg().user}>`,
//       to,
//       subject,
//       html,
//       ...(replyTo ? { reply_to: replyTo } : {}),
//     }),
//   });
//   const body: any = await res.json().catch(() => null);
//   if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`);
//   return body?.id || '?';
// }

/*
 * The one funnel every email in the app goes through. Both providers look identical from the
 * outside, so none of the six senders below ever learns which one carried the message.
 */
async function send({ to, subject, html, replyTo }: OutgoingMail) {
  if (!to) return;
  const zeptoKey = process.env.ZEPTOMAIL_API_KEY;
  if (!zeptoKey) {
    console.warn('[mailer] disabled (set ZEPTOMAIL_API_KEY). Skipped:', subject);
    return;
  }
  /* Check the sender before spending a round trip on it.
     Without this, an unset MAIL_USER built `from: "a dough cookie <>"` and every send came back
     "Invalid `from` field" — an error that describes the symptom and names neither the variable
     nor the fact that one was missing. Both environments ran that way for weeks: order
     confirmations, spin rewards and contact replies all failed, each logging a line that read like
     a formatting bug in the code rather than a blank in the config. ZeptoMail is stricter still:
     the address must also be on a domain verified in the Agent. */
  if (!cfg().user) {
    console.error(`[mailer] ✗ MAIL_USER is not set — no sender address, so nothing can be sent. Skipped: ${subject}`);
    return;
  }
  try {
    const id = await sendViaZeptoMail(zeptoKey, { to, subject, html, replyTo });
    console.log('[mailer] sent via zeptomail:', subject, '→', to, `(id: ${id})`);
  } catch (e: any) {
    // Never throws. A mail problem must not surface as a failed payment or a failed sweep.
    console.error('[mailer] ✗ send failed via zeptomail:', subject, '-', e.message);
  }
}

const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => (({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as Record<string, string>)[c] ?? c));

/*
 * The logo, as an absolute public URL. An email is rendered outside our site, so a relative path
 * would resolve against the mail client rather than adoughcookie.com. Overridable via env so a
 * staging build can point at its own deploy; the production asset is a fine default either way,
 * since it is the same artwork.
 */
const LOGO_URL = process.env.MAIL_LOGO_URL || 'https://www.adoughcookie.com/assets/adc-logo.png';

const shell = (title, body) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f6efe3;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eadfce">
      <!-- background-color first as the fallback: Outlook's Word engine ignores the gradient, and
           without a solid colour under it the header rendered as a white band. -->
      <div style="background-color:#EF7507;background:linear-gradient(135deg,#F29F05,#EF7507);padding:20px 24px">
        <!-- The artwork is amber, so it cannot sit straight on this orange — and the site's
             crush-to-black-then-invert trick is a CSS filter, which email clients do not support.
             A white chip gives it a surface it reads on everywhere, with no second asset to keep in
             step. alt carries the name for the many clients that block remote images by default,
             which is also why the tagline below stays live text rather than being part of the image. -->
        <div style="display:inline-block;background:#ffffff;border-radius:12px;padding:6px 12px">
          <img src="${LOGO_URL}" alt="a dough cookie" width="150"
               style="display:block;width:150px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none" />
        </div>
        <div style="font-size:12px;color:#fff;opacity:.9;margin-top:10px">Aroma of Freshness</div>
      </div>
      <div style="padding:24px">
        <h2 style="margin:0 0 14px;color:#2B1D12;font-size:18px">${title}</h2>
        ${body}
      </div>
      <div style="padding:14px 24px;background:#160D06;color:rgba(255,248,241,.6);font-size:12px">a dough cookie · Aroma of Freshness</div>
    </div>
  </div>`;

export async function sendContactEmail({ name, email, phone, message }) {
  const body = `
    <p style="color:#5C4636">You have a new enquiry from the website.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#2B1D12">
      <tr><td style="padding:6px 0;width:90px;color:#7A6353">Name</td><td style="padding:6px 0;font-weight:700">${esc(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#7A6353">Email</td><td style="padding:6px 0;font-weight:700">${esc(email)}</td></tr>
      <tr><td style="padding:6px 0;color:#7A6353">Phone</td><td style="padding:6px 0;font-weight:700">${esc(phone || '—')}</td></tr>
    </table>
    <p style="margin:14px 0 4px;color:#7A6353;font-size:13px">Message</p>
    <p style="margin:0;color:#2B1D12;line-height:1.6;white-space:pre-wrap">${esc(message)}</p>`;
  await send({ to: cfg().business, replyTo: email, subject: `New enquiry from ${name}`, html: shell('New website enquiry', body) });
}

/*
 * A support ticket the chatbot raised, emailed to the business.
 *
 * The assistant cannot cancel, refund or change anything, so a ticket IS the action for every
 * request of that kind — which makes this mail the thing that turns "the bot could not help" into
 * somebody actually picking it up. Best-effort like every other mail here: a send failure must not
 * lose the ticket, which is already committed to the database before this is called.
 */
export interface TicketMailTurn { role: 'user' | 'assistant'; text: string }

export async function sendSupportTicketEmail({ id, subject, details, customerWords, category, orderNumber, customerName, customerEmail, transcript = [] }: {
  id: number; subject: string; details: string; customerWords?: string | null; category: string;
  orderNumber?: string | null; customerName?: string | null; customerEmail?: string | null;
  transcript?: TicketMailTurn[];
}) {
  const rows = [
    ['Ticket', `#${id}`],
    ['Category', category],
    ['Order', orderNumber || '—'],
    ['Customer', `${customerName || '—'}${customerEmail ? ` (${customerEmail})` : ''}`],
  ].map(([k, v]) => `<tr><td style="padding:6px 0;width:90px;color:#7A6353">${esc(k)}</td><td style="padding:6px 0;font-weight:700">${esc(String(v))}</td></tr>`).join('');

  const convo = (transcript || []).slice(-6)
    .map((m) => `<p style="margin:0 0 8px"><span style="color:#7A6353;font-weight:700">${esc(m.role === 'user' ? 'Customer' : 'Doughie')}:</span> ${esc(String(m.text || '').slice(0, 500))}</p>`)
    .join('');

  /* Their words first, and visually first, because the assistant's reading is the part that can be
     wrong — and when it is, this is the block that tells you so at a glance. */
  const verbatim = customerWords
    ? `<p style="margin:14px 0 4px;color:#7A6353;font-size:13px">In their words</p>
       <blockquote style="margin:0;padding:10px 14px;border-left:3px solid #EF7507;background:#FFF6E9;color:#2B1D12;line-height:1.6;white-space:pre-wrap;font-style:italic">${esc(customerWords)}</blockquote>`
    : '';

  const body = `
    <p style="color:#5C4636">A customer raised this through the support chat.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#2B1D12">${rows}</table>
    ${verbatim}
    <p style="margin:14px 0 4px;color:#7A6353;font-size:13px">What Doughie understood</p>
    <p style="margin:0;color:#2B1D12;line-height:1.6;white-space:pre-wrap">${esc(details)}</p>
    ${convo ? `<p style="margin:18px 0 6px;color:#7A6353;font-size:13px">How the conversation went</p><div style="font-size:13px;color:#2B1D12;line-height:1.5">${convo}</div>` : ''}`;

  await send({
    to: cfg().business,
    replyTo: customerEmail || null,
    subject: `Support ticket #${id} — ${subject}`,
    html: shell('New support ticket', body),
  });
}

// Spin & Win — emails the won coupon to a guest who subscribed with their email to claim it.
// The code becomes usable once they sign in with this same email (it's attached to their account).
export async function sendCouponEmail({ email, name, code, label, offerText, terms, expiresAt, alreadyInAccount = false }) {
  const expiry = expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const body = `
    <p style="color:#5C4636">Hi ${esc(name || 'there')}, you won a treat on the a dough cookie spin wheel! 🎉</p>
    <div style="margin:18px 0;padding:20px;border:2px dashed #EF7507;border-radius:14px;background:#FFF6E9;text-align:center">
      <div style="font-size:13px;color:#7A6353;font-weight:700;text-transform:uppercase;letter-spacing:.08em">${esc(label || 'Your reward')}</div>
      <div style="font-size:28px;font-weight:900;color:#EF7507;letter-spacing:.12em;margin:6px 0">${esc(code)}</div>
      ${offerText ? `<div style="font-size:14px;color:#2B1D12;font-weight:700">${esc(offerText)}</div>` : ''}
    </div>
    ${alreadyInAccount
      ? `<p style="color:#2B1D12;line-height:1.6">It is already saved to your account. Just apply it at checkout.</p>`
      : `<p style="color:#2B1D12;line-height:1.6">Sign in at a dough cookie with <b>this email (${esc(email)})</b> and the coupon will be waiting in your account. Just apply it at checkout.</p>`}
    ${expiry ? `<p style="color:#7A6353;font-size:13px">Valid until <b>${esc(expiry)}</b>.</p>` : ''}
    ${terms ? `<p style="color:#7A6353;font-size:12px;line-height:1.5;margin-top:12px"><b>Terms:</b> ${esc(terms)}</p>` : ''}`;
  await send({ to: email, subject: `🍪 Your a dough cookie reward: ${code}`, html: shell('You won a treat!', body) });
}

function orderRows(items) {
  return (items || []).map((i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0e6d6;color:#2B1D12">${esc(i.name)} <span style="color:#7A6353">× ${i.qty}</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e6d6;text-align:right;color:#2B1D12">${rupee(i.total)}</td>
    </tr>`).join('');
}

function orderBody(o) {
  const a = o.address;
  const addr = a ? [a.full_name, a.address_line1, a.address_line2, a.city, a.state, a.pincode].filter(Boolean).join(', ') : '';
  const phone = a?.phone ? `<div style="color:#7A6353;font-size:13px;margin-top:4px">Phone: ${esc(a.phone)}</div>` : '';
  const intro = `<p style="color:#5C4636">Thanks for your order, ${esc(o.customerName)}! We&rsquo;re baking it fresh. 🍪</p>`;
  return `
    ${intro}
    <div style="margin:10px 0;color:#7A6353;font-size:13px">Order <b style="color:#2B1D12">${esc(o.orderNumber)}</b></div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
      ${orderRows(o.items)}
      <tr><td style="padding:10px 0 4px;color:#7A6353">Subtotal</td><td style="padding:10px 0 4px;text-align:right;color:#2B1D12">${rupee(o.subtotal)}</td></tr>
      ${o.discount ? `<tr><td style="padding:4px 0;color:#1F8A4C">Discount</td><td style="padding:4px 0;text-align:right;color:#1F8A4C">−${rupee(o.discount)}</td></tr>` : ''}
      <tr><td style="padding:4px 0;color:#7A6353">Delivery</td><td style="padding:4px 0;text-align:right;color:#2B1D12">${rupee(o.deliveryFee)}</td></tr>
      <tr><td style="padding:10px 0 0;font-weight:800;color:#2B1D12">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:800;color:#2B1D12">${rupee(o.total)}</td></tr>
    </table>
    ${addr ? `<p style="margin:16px 0 4px;color:#7A6353;font-size:13px">Delivery address</p><p style="margin:0;color:#2B1D12;line-height:1.6">${esc(addr)}</p>${phone}` : ''}`;
}

/*
 * Two emails per PAID order: the customer's confirmation, and a copy to the business.
 *
 * The business copy was dropped once because it doubled the send volume against a plan counted per
 * message. What made that expensive was WHERE it was sent from: order creation, so every abandoned
 * checkout mailed twice for an order nobody had paid for. Sent from payment instead, the volume is
 * the number of real orders — and at that rate a copy in the mailbox is worth having as the one
 * record that does not depend on somebody being logged into a dashboard.
 *
 * The customer's copy is sent FIRST and awaited on its own, so if the plan ever does hit its cap
 * the send that fails is the internal one.
 */
/*
 * We cancelled an order the customer had already paid for. They are owed the reason in writing and
 * the money back, in that order — this is the only message where the refund line matters more than
 * anything else on the page, so it is stated plainly and near the top rather than buried in terms.
 *
 * `refunded` is what actually happened, not what was intended: if the refund call failed the mail
 * must not promise one, or the customer waits a week for money that was never sent.
 */
export async function sendOrderCancelledEmail({ order, reason, refunded }) {
  const to = order?.customerEmail || order?.customer_email;
  if (!to) return;
  const number = order.orderNumber || order.order_number || '';
  const amount = order.totalAmount ?? order.total_amount;
  const body = `
    <p style="color:#5C4636">We are sorry. We have had to cancel your order <b>${esc(number)}</b>.</p>
    <div style="margin:16px 0;padding:16px;border-radius:12px;background:#FFF6E9;border:1px solid #F3D9B5">
      <div style="font-size:13px;color:#7A6353;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Why</div>
      <div style="margin-top:4px;color:#2B1D12;line-height:1.6">${esc(reason)}</div>
    </div>
    ${refunded
      ? `<p style="color:#2B1D12;line-height:1.6"><b>${amount != null ? rupee(amount) : 'Your payment'} has been refunded in full</b> to the card or account you paid from. Banks usually take 5&ndash;7 working days to show it.</p>`
      : `<p style="color:#2B1D12;line-height:1.6">If you were charged, your refund is being arranged and will come back to the account you paid from. Reply to this email if you do not see it within a week.</p>`}
    <p style="color:#7A6353;font-size:13px;line-height:1.6">We know this is disappointing, and we would rather tell you now than leave you waiting. Do order again, we will make it right.</p>`;
  await send({ to, subject: `Your order ${number} has been cancelled`, html: shell('Order cancelled', body) });
}

/*
 * The three delivery updates a customer actually wants, and no more.
 *
 * The order confirmation already goes out from finalizePaidOrder, so these are the three that
 * happen AFTER it: the parcel left us, it arrives today, it arrived. A mail per carrier scan was
 * never an option — Delhivery alone reports a dozen facility hops on a cross-country parcel, the
 * poller sees every one of them, and the plan is counted per message.
 *
 * Keyed on the MILESTONE, not the carrier's status, so Delhivery's "In Transit — Shipment
 * Received at Facility" and Shiprocket's "PICKED UP" produce the same sentence. The customer does
 * not care whose vocabulary it is.
 *
 * No business copy on these. They already get one per paid order, and three more each would treble
 * the internal volume to say something the dashboard already shows.
 *
 * `note` is the admin's own sentence, set only when a person moved the order by hand. Nothing
 * generated fills it, because the one case that needs explaining — we delivered this ourselves
 * after the courier could not find a rider — is exactly the case a fixed template cannot
 * describe. Escaped like everything else here: it is free text out of a form.
 */
const MILESTONE_MAIL = {
  SHIPPED: {
    subject: (n) => `Your order ${n} is on its way 🚚`,
    title: 'On its way',
    line: 'is packed and has left our kitchen with the courier',
    note: 'It is moving now. We will write once more on the day it comes out for delivery.',
  },
  OUT_FOR_DELIVERY: {
    subject: (n) => `Your order ${n} arrives today 🍪`,
    title: 'Arriving today',
    line: 'is out for delivery today',
    note: 'Keep your phone nearby — the courier calls the number on your order, and somebody should be there to take it.',
  },
  DELIVERED: {
    subject: (n) => `Your order ${n} has been delivered 🎉`,
    title: 'Delivered',
    line: 'has been delivered',
    note: 'We hope they are still warm. If anything is not right, reply to this email and we will sort it out.',
  },
};

export async function sendOrderMilestoneEmail({ to, customerName, orderNumber, milestone, trackingUrl, note = '' }) {
  const m = MILESTONE_MAIL[milestone];
  /* An unknown milestone is our bug, not the customer's problem: say nothing rather than send a
     mail with a blank middle. */
  if (!m || !to) return false;

  const body = `
    <p style="color:#5C4636">${esc(customerName || 'Hello')}, your order
      <b style="color:#2B1D12">${esc(orderNumber)}</b> ${m.line}.</p>
    <p style="color:#2B1D12;line-height:1.6">${m.note}</p>
    ${note
      ? `<div style="margin:16px 0;padding:14px 16px;border-radius:12px;background:#FFF6E9;border:1px solid #F3D9B5;color:#2B1D12;line-height:1.6">${esc(note)}</div>`
      : ''}
    ${trackingUrl && milestone !== 'DELIVERED'
      ? `<p style="margin:18px 0 0"><a href="${esc(trackingUrl)}"
           style="display:inline-block;background:#EF7507;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:700">Track your parcel</a></p>`
      : ''}`;

  await send({ to, subject: m.subject(orderNumber), html: shell(m.title, body) });
  return true;
}

export async function sendOrderEmails(o) {
  const html = shell('Order confirmed', orderBody(o));
  // Customer first, and alone: see the note above about which send is allowed to be the one that fails.
  await send({ to: o.customerEmail, subject: `Your order ${o.orderNumber} is placed 🍪`, html });
  const { business } = cfg();
  // Never mail the business twice when BUSINESS_EMAIL is just the sending address again.
  if (business && business.toLowerCase() !== String(o.customerEmail || '').toLowerCase()) {
    await send({
      to: business,
      subject: `New paid order ${o.orderNumber} — ${o.customerName || 'Customer'}`,
      html,
      // Replying to the copy reaches the customer, which is the only thing anyone wants to do with it.
      replyTo: o.customerEmail || undefined,
    });
  }
}
