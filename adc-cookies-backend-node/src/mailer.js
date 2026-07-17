import nodemailer from 'nodemailer';

/*
 * Email via SMTP (Nodemailer). Works with Gmail OR any SMTP host (Zoho, etc.). Env vars:
 *   MAIL_USER          = the address that sends mail (e.g. info@adoughcookie.com)
 *   MAIL_APP_PASSWORD  = its app password (Gmail App password, or a Zoho app-specific password)
 *   BUSINESS_EMAIL     = where enquiries / order copies go (defaults to MAIL_USER)
 *   MAIL_HOST          = SMTP host — set for Zoho: smtp.zoho.in (India) or smtp.zoho.com
 *   MAIL_PORT          = SMTP port (default 465, SSL). MAIL_SECURE=false for STARTTLS on 587.
 *   (If MAIL_HOST is unset, it falls back to Gmail's service preset.)
 *
 * If MAIL_USER / MAIL_APP_PASSWORD are not set, email is simply skipped (logged) — the
 * API keeps working. Sending never throws, so it can't break a request.
 */

function cfg() {
  return {
    user: process.env.MAIL_USER || '',
    pass: (process.env.MAIL_APP_PASSWORD || '').replace(/\s+/g, ''), // app passwords are shown with spaces
    business: process.env.BUSINESS_EMAIL || process.env.MAIL_USER || '',
  };
}

let transporter = null;
function transport() {
  const { user, pass } = cfg();
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

async function send({ to, subject, html, replyTo }) {
  if (!to) return;
  const t = transport();
  if (!t) { console.warn('[mailer] disabled (set MAIL_USER & MAIL_APP_PASSWORD). Skipped:', subject); return; }
  try {
    await t.sendMail({ from: `"a dough cookie" <${cfg().user}>`, to, subject, html, replyTo });
    console.log('[mailer] sent:', subject, '→', to);
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

function orderRows(items) {
  return (items || []).map((i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0e6d6;color:#2B1D12">${esc(i.name)} <span style="color:#7A6353">× ${i.qty}</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e6d6;text-align:right;color:#2B1D12">${rupee(i.total)}</td>
    </tr>`).join('');
}

function orderBody(o, forBusiness) {
  const a = o.address;
  const addr = a ? [a.full_name, a.address_line1, a.address_line2, a.city, a.state, a.pincode].filter(Boolean).join(', ') : '';
  const phone = a?.phone ? `<div style="color:#7A6353;font-size:13px;margin-top:4px">Phone: ${esc(a.phone)}</div>` : '';
  const intro = forBusiness
    ? `<p style="color:#5C4636">New order received from <b>${esc(o.customerName)}</b> (${esc(o.customerEmail)}).</p>`
    : `<p style="color:#5C4636">Thanks for your order, ${esc(o.customerName)}! We're baking it fresh. 🍪</p>`;
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

export async function sendOrderEmails(o) {
  // To the customer
  await send({ to: o.customerEmail, subject: `Your order ${o.orderNumber} is placed 🍪`, html: shell('Order confirmed', orderBody(o, false)) });
  // Copy to the business (skip if it's the same address)
  const business = cfg().business;
  if (business && business !== o.customerEmail) {
    await send({ to: business, subject: `New order ${o.orderNumber} — ${rupee(o.total)}`, html: shell('New order received', orderBody(o, true)) });
  }
}
