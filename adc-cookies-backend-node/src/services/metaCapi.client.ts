import { createHash } from 'node:crypto';
import { getOne, getAll } from '../db/index.js';
import { normalizePhone } from './messageCentral.client.js';
import type { Attribution } from './attribution.service.js';

/*
 * Meta Conversions API — the server's copy of the Purchase event.
 *
 * The Pixel in the browser sends Purchase too, from the success screen. This exists because that
 * screen is the least reliable place on the site to count a sale from: an ad click opens in
 * Instagram's in-app browser, which cannot run Razorpay's popup, so Razorpay REDIRECTS instead — and
 * a redirected payment comes back to /account, where no Purchase is fired at all. Add ad blockers,
 * Safari's tracking protection, and a shopper who pays in the UPI app and never comes back to the
 * tab, and the browser alone misses exactly the sales an ad account most needs to learn from.
 *
 * Every paid order passes through finalizePaidOrder, which calls this once, on the atomic PAID claim.
 * Both copies carry the order number as their event id, so when both arrive Meta keeps one.
 *
 * DORMANT UNTIL CONFIGURED: with no META_PIXEL_ID + META_CAPI_TOKEN every call is a no-op. With
 * META_TEST_EVENT_CODE set (staging only), events show up under Events Manager > Test events.
 *
 * Never throws. A failure here is a missing conversion, not a failed payment.
 */

const PIXEL_ID = (process.env.META_PIXEL_ID || '').trim();
const TOKEN = (process.env.META_CAPI_TOKEN || '').trim();
const TEST_CODE = (process.env.META_TEST_EVENT_CODE || '').trim();
const API_VERSION = process.env.META_API_VERSION || 'v23.0';
const SITE = (process.env.FRONTEND_URL || 'https://www.adoughcookie.com').replace(/\/+$/, '');

export const metaCapiConfigured = !!(PIXEL_ID && TOKEN);

console.log(metaCapiConfigured
  ? `[META] capi | ✓ on | pixel=…${PIXEL_ID.slice(-4)}${TEST_CODE ? ` | TEST MODE (${TEST_CODE})` : ''}`
  : `[META] capi | off | ${PIXEL_ID ? 'META_CAPI_TOKEN' : 'META_PIXEL_ID'} not set`);

/* Meta matches on SHA-256 of a normalised value: lowercase, trimmed, and for names and places no
   spaces or punctuation. The IP, user agent and fbp/fbc cookies are sent as-is — Meta says so. */
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const squash = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export async function sendMetaPurchase(orderId: number) {
  if (!metaCapiConfigured) return;
  try {
    const o = await getOne(
      `SELECT o.id, o.order_number, o.user_id, o.total_amount, o.address_id, o.attribution,
              u.email, u.phone AS user_phone, u.name AS user_name
         FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`, [orderId]);
    if (!o) return;
    const a: Attribution = o.attribution || {};

    /* A website event needs the browser's user agent, and that only exists on orders placed since
       attribution was recorded. An order created before this shipped and paid after is skipped
       rather than sent half-formed. */
    if (!a.ua) {
      console.log(`[META] purchase | order=${o.order_number} | skipped: no browser details on this order`);
      return;
    }

    const [items, addr] = await Promise.all([
      getAll('SELECT product_id, quantity, unit_price FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]),
      o.address_id ? getOne('SELECT full_name, phone, city, state, pincode FROM addresses WHERE id = $1', [o.address_id]) : null,
    ]);

    const email = String(o.email || '').trim().toLowerCase();
    // Phone-login accounts have no email; guard the synthetic address older rows may still carry.
    const realEmail = email && !email.endsWith('@phone.adccookies.app') ? email : '';
    const phones = [...new Set([o.user_phone, addr?.phone]
      .map((p) => normalizePhone(p)?.digits).filter(Boolean) as string[])];
    const nameParts = String(addr?.full_name || o.user_name || '').trim().split(/\s+/).filter(Boolean);

    /* fbc is normally the _fbc cookie the Pixel writes when someone lands with ?fbclid=. If the
       Pixel never got to run (blocked, or the order came before it loaded), rebuild it from the
       fbclid we kept ourselves, in Meta's own format: fb.1.<landing time ms>.<fbclid>. */
    const fbc = a.fbc || (a.fbclid ? `fb.1.${a.at || Date.now()}.${a.fbclid}` : undefined);

    const user_data: Record<string, unknown> = {
      ...(realEmail ? { em: [sha(realEmail)] } : {}),
      ...(phones.length ? { ph: phones.map(sha) } : {}),
      ...(nameParts[0] ? { fn: [sha(squash(nameParts[0]))] } : {}),
      ...(nameParts.length > 1 ? { ln: [sha(squash(nameParts[nameParts.length - 1]))] } : {}),
      ...(addr?.city ? { ct: [sha(squash(addr.city))] } : {}),
      ...(addr?.state ? { st: [sha(squash(addr.state))] } : {}),
      ...(addr?.pincode ? { zp: [sha(String(addr.pincode).replace(/\D/g, ''))] } : {}),
      country: [sha('in')],
      external_id: [sha(String(o.user_id))],
      ...(a.ip ? { client_ip_address: a.ip } : {}),
      client_user_agent: a.ua,
      ...(a.fbp ? { fbp: a.fbp } : {}),
      ...(fbc ? { fbc } : {}),
    };

    const contents = items.map((i) => ({
      id: String(i.product_id), quantity: Number(i.quantity) || 1, item_price: Number(i.unit_price) || 0,
    }));

    const event = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: o.order_number,            // the browser Purchase uses the same id — Meta keeps one
      action_source: 'website',
      event_source_url: a.pageUrl || `${SITE}/payment`,
      user_data,
      custom_data: {
        currency: 'INR',
        value: Number(o.total_amount) || 0,
        order_id: o.order_number,
        content_type: 'product',
        content_ids: contents.map((c) => c.id),
        contents,
        num_items: contents.reduce((s, c) => s + c.quantity, 0),
      },
    };

    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The token rides in the body, not the query string, so it never lands in a request log.
      body: JSON.stringify({ data: [event], access_token: TOKEN, ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = body?.error || {};
      console.error(`[META] purchase | order=${o.order_number} | ✗ http ${res.status} | ${e.error_user_msg || e.message || 'no error body'}${e.fbtrace_id ? ` | trace=${e.fbtrace_id}` : ''}`);
      return;
    }
    const matched = Object.keys(user_data).filter((k) => k !== 'country').join(',');
    console.log(`[META] purchase | order=${o.order_number} | ✓ sent ₹${event.custom_data.value} | received=${body.events_received ?? '?'} | match=${matched}${TEST_CODE ? ' | TEST' : ''}`);
  } catch (err: any) {
    console.error(`[META] purchase | order=${orderId} | ✗ ${err?.name === 'TimeoutError' ? 'timed out' : err?.message || err}`);
  }
}
