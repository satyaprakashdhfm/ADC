// import nodemailer from 'nodemailer'; // kept for the old SMTP path below — see note

/*
 * Email via Resend (HTTPS API) — https://resend.com
 *
 * Switched from SMTP/nodemailer because Railway's Hobby plan blocks outbound SMTP entirely
 * (ports 25/465/587) — every send was failing with a silent 10s "Connection timeout". Resend's
 * API runs over plain HTTPS, which Railway doesn't restrict, so it isn't affected.
 *
 * Env vars:
 *   RESEND_API_KEY     = Resend API key
 *   MAIL_USER          = the address that sends mail (e.g. info@adoughcookie.com) — must be on
 *                        a domain verified in Resend
 *   BUSINESS_EMAIL     = where enquiries / order copies go (defaults to MAIL_USER)
 *
 * If RESEND_API_KEY is not set, email is simply skipped (logged) — the API keeps working.
 * Sending never throws, so it can't break a request.
 *
 * The old SMTP/nodemailer implementation is kept commented out at the bottom of this file —
 * Railway's outbound SMTP block only lifts on the Pro plan and above, so that's the fallback
 * to restore if this project ever moves off Hobby and back to SMTP.
 */

function cfg() {
  return {
    user: process.env.MAIL_USER || '',
    business: process.env.BUSINESS_EMAIL || process.env.MAIL_USER || '',
  };
}

async function send({ to, subject, html, replyTo }) {
  if (!to) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[mailer] disabled (set RESEND_API_KEY). Skipped:', subject); return; }
  /* Check the sender before spending a round trip on it.
     Without this, an unset MAIL_USER built `from: "a dough cookie <>"` and every send came back
     "Invalid `from` field" — an error that describes the symptom and names neither the variable
     nor the fact that one was missing. Both environments ran that way for weeks: order
     confirmations, spin rewards and contact replies all failed, each logging a line that read like
     a formatting bug in the code rather than a blank in the config. */
  if (!cfg().user) {
    console.error(`[mailer] ✗ MAIL_USER is not set — no sender address, so nothing can be sent. Skipped: ${subject}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `a dough cookie <${cfg().user}>`,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('[mailer] send failed:', subject, '-', body?.message || `HTTP ${res.status}`);
      return;
    }
    console.log('[mailer] sent:', subject, '→', to, '(id:', (body?.id || '?') + ')');
  } catch (e) {
    console.error('[mailer] send failed:', subject, '-', e.message);
  }
}

const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const shell = (title, body) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f6efe3;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eadfce">
      <div style="background:linear-gradient(135deg,#F29F05,#EF7507);padding:20px 24px">
        <div style="font-size:20px;font-weight:800;color:#fff">a dough cookie</div>
        <div style="font-size:12px;color:#fff;opacity:.9">Aroma of Freshness</div>
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
      ? `<p style="color:#2B1D12;line-height:1.6">It is already saved to your account — just apply it at checkout.</p>`
      : `<p style="color:#2B1D12;line-height:1.6">Sign in at a dough cookie with <b>this email (${esc(email)})</b> and the coupon will be waiting in your account — just apply it at checkout.</p>`}
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
 * One email per order, to the customer.
 *
 * There used to be a second copy to the business on every order. It doubled the send volume for
 * something nobody reads: an order reaches the shop through the admin dashboard, the store portal
 * the counter actually watches, and Petpooja where that store is on AUTO. The mailbox was the one
 * channel that told no one anything they were not already looking at.
 *
 * Halving the sends matters because the mail plan is counted per message, and the customer's
 * confirmation is the one that must never be the send that hits the cap.
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
    <p style="color:#5C4636">We are sorry — we have had to cancel your order <b>${esc(number)}</b>.</p>
    <div style="margin:16px 0;padding:16px;border-radius:12px;background:#FFF6E9;border:1px solid #F3D9B5">
      <div style="font-size:13px;color:#7A6353;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Why</div>
      <div style="margin-top:4px;color:#2B1D12;line-height:1.6">${esc(reason)}</div>
    </div>
    ${refunded
      ? `<p style="color:#2B1D12;line-height:1.6"><b>${amount != null ? rupee(amount) : 'Your payment'} has been refunded in full</b> to the card or account you paid from. Banks usually take 5&ndash;7 working days to show it.</p>`
      : `<p style="color:#2B1D12;line-height:1.6">If you were charged, your refund is being arranged and will come back to the account you paid from. Reply to this email if you do not see it within a week.</p>`}
    <p style="color:#7A6353;font-size:13px;line-height:1.6">We know this is disappointing, and we would rather tell you now than leave you waiting. Do order again — we will make it right.</p>`;
  await send({ to, subject: `Your order ${number} has been cancelled`, html: shell('Order cancelled', body) });
}

export async function sendOrderEmails(o) {
  await send({ to: o.customerEmail, subject: `Your order ${o.orderNumber} is placed 🍪`, html: shell('Order confirmed', orderBody(o)) });
}

/* ---- Previous SMTP/nodemailer implementation (kept for reference/fallback) ----
 * Works with Gmail OR any SMTP host (Zoho, etc.). Env vars it used:
 *   MAIL_USER          = the address that sends mail (e.g. info@adoughcookie.com)
 *   MAIL_APP_PASSWORD  = its app password (Gmail App password, or a Zoho app-specific password)
 *   BUSINESS_EMAIL     = where enquiries / order copies go (defaults to MAIL_USER)
 *   MAIL_HOST          = SMTP host — set for Zoho: smtp.zoho.in (India) or smtp.zoho.com
 *   MAIL_PORT          = SMTP port (default 465, SSL). MAIL_SECURE=false for STARTTLS on 587.
 *   (If MAIL_HOST is unset, it falls back to Gmail's service preset.)
 *
function cfgSmtp() {
  return {
    user: process.env.MAIL_USER || '',
    pass: (process.env.MAIL_APP_PASSWORD || '').replace(/\s+/g, ''), // app passwords are shown with spaces
    business: process.env.BUSINESS_EMAIL || process.env.MAIL_USER || '',
  };
}

let transporter = null;
function transport() {
  const { user, pass } = cfgSmtp();
  if (!user || !pass) return null;
  if (!transporter) {
    const host = process.env.MAIL_HOST || '';
    // Custom host (e.g. Zoho) if MAIL_HOST is set; otherwise Gmail's service preset.
    const base = host
      ? { host, port: Number(process.env.MAIL_PORT || 465), secure: String(process.env.MAIL_SECURE ?? 'true') !== 'false' }
      : { service: 'gmail' };
    transporter = nodemailer.createTransport({
      ...base,
      auth: { user, pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
  }
  return transporter;
}

async function sendSmtp({ to, subject, html, replyTo }) {
  if (!to) return;
  const t = transport();
  if (!t) { console.warn('[mailer] disabled (set MAIL_USER & MAIL_APP_PASSWORD). Skipped:', subject); return; }
  try {
    await t.sendMail({ from: `"a dough cookie" <${cfgSmtp().user}>`, to, subject, html, replyTo });
    console.log('[mailer] sent:', subject, '→', to);
  } catch (e) {
    console.error('[mailer] send failed:', subject, '-', e.message);
  }
}
---- end previous implementation ---- */
