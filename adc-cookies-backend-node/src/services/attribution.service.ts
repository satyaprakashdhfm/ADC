import type { Request } from 'express';

/*
 * Where an order came from, recorded on the order itself.
 *
 * The storefront keeps the last ad click or outside link that brought this browser here (UTM tags,
 * Meta's fbclid, Google's gclid, or just the referring site) and sends it with the order. That is
 * what lets the dashboard say "these orders came from a Meta ad" out of our own data, instead of
 * taking Ads Manager's word for it — Meta counts people who only SAW an ad, and models part of the
 * rest.
 *
 * It is also where the Conversions API gets what it needs later. The Purchase event is sent when
 * Razorpay confirms the money, and the webhook that does that has no browser attached — so the
 * customer's user agent, IP and Meta cookies have to be captured here, at the one request that is
 * still the customer's own.
 *
 * Nothing here is trusted for anything but reporting: it is whitelisted, length-capped text, and no
 * price, discount or permission is ever decided from it.
 */

const TEXT_KEYS = [
  'source', 'medium', 'campaign', 'term', 'content',   // utm_*
  'fbclid', 'gclid',                                   // ad-click ids
  'referrer', 'landing',                               // the outside site, and the page they landed on
  'fbp', 'fbc',                                        // Meta's first-party cookies, for matching
  'pageUrl',                                           // the page the order was placed from
] as const;

export type Attribution = Partial<Record<(typeof TEXT_KEYS)[number] | 'ip' | 'ua', string>> & { at?: number };

export function attributionFromRequest(req: Request): Attribution | null {
  const raw = req.body?.attribution;
  const out: Attribution = {};
  if (raw && typeof raw === 'object') {
    for (const k of TEXT_KEYS) {
      const v = raw[k];
      if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 500);
    }
    const at = Number(raw.at);
    if (Number.isFinite(at) && at > 0) out.at = at;
  }
  /* The LEFTMOST X-Forwarded-For entry is the customer: the storefront's /api rewrite and Railway's
     edge each append their own address to the right. Same reading as /auth/log-location, and for
     the same reason — req.ip peels back only one hop. Spoofable, which is fine for ad matching and
     would not be for anything that decides access. */
  const xff = String(req.headers['x-forwarded-for'] || '');
  const ip = (xff.split(',')[0] || req.ip || '').trim().replace(/^::ffff:/, '');
  if (ip) out.ip = ip.slice(0, 64);
  const ua = String(req.headers['user-agent'] || '').trim();
  if (ua) out.ua = ua.slice(0, 500);
  return Object.keys(out).length ? out : null;
}

const META_SOURCES = new Set(['meta', 'facebook', 'fb', 'instagram', 'ig']);
const PAID_MEDIUM = /paid|cpc|ppc|cpm|^ads?$|display/;

/**
 * Which bucket an order goes in on the dashboard's "Orders by source".
 *
 * "Meta ads" is ONLY an order whose link carried a paid-medium or campaign tag from Meta — the URL
 * parameters set on every ad. A bare fbclid is not enough: Facebook and Instagram stamp one on every
 * outbound link, a bio link and a shared post included, so counting it as an ad would credit the
 * ad budget with organic sales. Those land in "Instagram / Facebook (not an ad)" instead, which is
 * also where an ad whose URL parameters were forgotten would show up — a useful thing to notice.
 */
export function sourceOf(a: Attribution | null): string {
  if (!a) return 'Not tracked';
  const src = (a.source || '').toLowerCase();
  const med = (a.medium || '').toLowerCase();
  const ref = (a.referrer || '').toLowerCase();
  const isMeta = META_SOURCES.has(src);
  if (isMeta && (PAID_MEDIUM.test(med) || !!a.campaign)) return 'Meta ads';
  if (a.gclid || (src === 'google' && PAID_MEDIUM.test(med))) return 'Google ads';
  if (isMeta || a.fbclid || /(^|\.)(facebook|instagram)\.com$|^l\.facebook|^lm\.facebook|^l\.instagram/.test(ref)) return 'Instagram / Facebook (not an ad)';
  if (src) return `Tagged link: ${src}`;
  if (/(^|\.)(google|bing|duckduckgo|yahoo)\./.test(ref)) return 'Search (Google, Bing…)';
  if (ref) return 'Other websites';
  return 'Direct';
}

/** One line for the order log, e.g. "meta/paid_social/diwali_launch". */
export function attributionSummary(a: Attribution | null): string {
  if (!a) return 'none';
  if (a.source) return [a.source, a.medium, a.campaign].filter(Boolean).join('/');
  if (a.fbclid) return 'fbclid';
  if (a.gclid) return 'gclid';
  if (a.referrer) return `ref:${a.referrer}`;
  return 'direct';
}
