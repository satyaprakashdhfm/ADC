import type { Attribution } from './attribution.service.js';

/*
 * Where somebody came from, in words the shop uses — one list for BOTH halves of the traffic tab.
 *
 * Visits are described by Google Analytics (source, medium, its own channel group); orders by the
 * attribution we record at checkout (utm tags, fbclid, referring site). They are two different
 * shapes of the same fact, so each has its own reader below, and both answer with a key from this
 * one list. That shared key is what lets a row say "Instagram: 120 visitors, 3 orders" — without it
 * the two sides would name the same place differently and never line up.
 *
 * Kept apart from sourceOf() in attribution.service on purpose. That one feeds the Overview's
 * "Orders by source" and folds Instagram and Facebook together; this one splits them, because
 * "how many came from Instagram" is the question this tab exists to answer.
 */
export const CHANNELS = {
  meta_ads: { label: 'Meta ads', hint: 'Clicked one of our paid ads on Instagram or Facebook.' },
  instagram: { label: 'Instagram (not an ad)', hint: 'Our profile, a post, a story or the bio link — Instagram we did not pay for.' },
  facebook: { label: 'Facebook (not an ad)', hint: 'Our page or a post on Facebook that was not an ad.' },
  insta_fb: { label: 'Instagram / Facebook (not an ad)', hint: 'Came from Instagram or Facebook, but the link did not say which.' },
  whatsapp: { label: 'WhatsApp', hint: 'A link someone shared on WhatsApp.' },
  social: { label: 'Other social media', hint: 'YouTube, LinkedIn, X, Pinterest and the like.' },
  google_ads: { label: 'Google ads', hint: 'Clicked a paid Google ad.' },
  search: { label: 'Search (Google, Bing…)', hint: 'Found us by searching, without an ad.' },
  websites: { label: 'Other websites', hint: 'Followed a link on another website.' },
  email: { label: 'Email', hint: 'A link in an email.' },
  tagged: { label: 'Other tagged links', hint: 'A link we tagged ourselves (a QR code, a partner) that is none of the above.' },
  direct: { label: 'Direct', hint: 'Typed the address, used a bookmark, or came from an app that hides where the link was — WhatsApp often does.' },
  other: { label: 'Other', hint: 'Somewhere Google could not put in a group.' },
  untracked: { label: 'Not tracked', hint: 'Orders placed before we started recording where customers came from (18 Sep 2026).' },
} as const;

export type ChannelKey = keyof typeof CHANNELS;

const META_SOURCE = /^(meta|facebook|fb|instagram|ig)$|(^|\.)(facebook|instagram)\.com$/;
const PAID_MEDIUM = /paid|cpc|ppc|cpm|^ads?$|display/;
const WHATSAPP = /whatsapp|^wa\.me$|^l\.wl\.co$/;
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia)\.|^(google|bing|duckduckgo|yahoo|ecosia)$/;
const OTHER_SOCIAL = /youtube|linkedin|twitter|^t\.co$|(^|\.)x\.com$|pinterest|reddit|snapchat|threads/;
const NOT_SET = new Set(['', '(not set)', '(none)', '(direct)', '(organic)', '(referral)']);

/** The Meta-like source, split into which app it actually was. */
function metaApp(s: string): ChannelKey {
  if (s.includes('instagram') || s === 'ig') return 'instagram';
  if (s.includes('facebook') || s === 'fb') return 'facebook';
  return 'insta_fb';
}

/**
 * A GA4 session, from its session source / medium / default channel group / campaign.
 *
 * "Meta ads" needs a paid medium or a campaign name on a Meta source — the URL parameters every ad
 * carries. Organic Instagram arrives as source "instagram.com" / "l.instagram.com" with medium
 * "referral", and lands under Instagram.
 */
export function channelOfVisit(source: string, medium: string, channelGroup: string, campaign: string): ChannelKey {
  const s = source.toLowerCase().trim();
  const m = medium.toLowerCase().trim();
  const g = channelGroup.toLowerCase().trim();
  const hasCampaign = !NOT_SET.has(campaign.toLowerCase().trim());
  const paid = PAID_MEDIUM.test(m) || g.startsWith('paid');

  if (META_SOURCE.test(s)) return paid || hasCampaign ? 'meta_ads' : metaApp(s);
  if (WHATSAPP.test(s)) return 'whatsapp';
  if (g === 'paid search' || (s === 'google' && paid)) return 'google_ads';
  if (g === 'organic search' || (SEARCH.test(s) && (m === 'organic' || m === 'referral'))) return 'search';
  if (s === '(direct)' || g === 'direct') return 'direct';
  if (g === 'email' || m === 'email') return 'email';
  if (g === 'organic social' || OTHER_SOCIAL.test(s)) return 'social';
  if (g === 'referral' || m === 'referral') return 'websites';
  if (!NOT_SET.has(s) && !NOT_SET.has(m)) return 'tagged';
  return 'other';
}

/** One of our orders, from the attribution recorded with it at checkout. Same rules, other shape. */
export function channelOfOrder(a: Attribution | null): ChannelKey {
  if (!a) return 'untracked';
  const s = (a.source || '').toLowerCase().trim();
  const m = (a.medium || '').toLowerCase().trim();
  const ref = (a.referrer || '').toLowerCase().trim();

  if (s && META_SOURCE.test(s)) return PAID_MEDIUM.test(m) || !!a.campaign ? 'meta_ads' : metaApp(s);
  if (a.gclid || (s === 'google' && PAID_MEDIUM.test(m))) return 'google_ads';
  if (m === 'email') return 'email';
  if (s) return WHATSAPP.test(s) ? 'whatsapp' : 'tagged';
  /* A bare fbclid is Meta stamping an ordinary outbound link — a bio link, a shared post — not an
     ad. The referring host, when the browser kept one, says which app it was. */
  if (META_SOURCE.test(ref)) return metaApp(ref);
  if (a.fbclid) return 'insta_fb';
  if (WHATSAPP.test(ref)) return 'whatsapp';
  if (SEARCH.test(ref)) return 'search';
  if (OTHER_SOCIAL.test(ref)) return 'social';
  if (ref) return 'websites';
  return 'direct';
}
