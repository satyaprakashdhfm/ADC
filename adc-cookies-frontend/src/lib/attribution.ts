/*
 * Where this visitor came from — kept in the browser, sent with the order.
 *
 * An ad click lands with UTM tags (utm_source=meta&utm_campaign=…) and a click id (fbclid from Meta,
 * gclid from Google). The order is placed pages and maybe days later, by which time the URL has long
 * lost them — so they are kept here, and createOrder() hands them to the backend, which stores them
 * on the order. That is what lets the dashboard say which orders an ad actually brought in.
 *
 * The rules, in order:
 *   • A visit carrying UTM tags or a click id always replaces what is stored. The latest ad click is
 *     the one that brought them back.
 *   • A visit from another website is only recorded when nothing live is stored — an organic visit
 *     does not take the credit away from an ad clicked yesterday.
 *   • A direct visit (typed URL, bookmark) never replaces anything.
 *   • After 30 days it is forgotten.
 *
 * Some "other websites" are not sources at all — they are our own round trips. Razorpay sends a
 * redirected payment back from its domain, and Google sign-in comes back from accounts.google.com;
 * counting either would file the customer's next order under "payment gateway" or "Google search".
 *
 * Nothing in here may throw — storage can be unavailable in private windows and in-app browsers.
 */

const KEY = 'adc_attribution';
const TTL_MS = 30 * 24 * 3600_000;

const NOT_A_SOURCE = /(^|\.)(razorpay\.com|accounts\.google\.com|adoughcookie\.com|railway\.app|vercel\.app)$/;

export interface Touch {
  source?: string; medium?: string; campaign?: string; term?: string; content?: string;
  fbclid?: string; gclid?: string;
  referrer?: string;   // hostname only — the full referring URL can carry someone else's query string
  landing?: string;    // path they landed on
  at: number;          // when, ms
}

function read(): Touch | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null') as Touch | null;
    return t && Date.now() - t.at < TTL_MS ? t : null;
  } catch { return null; }
}

function write(t: Touch) {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* private mode / quota */ }
}

/** Call once per page load. */
export function captureAttribution() {
  if (typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    const pick = (k: string) => (q.get(k) || '').trim().slice(0, 200) || undefined;
    const tagged: Touch = {
      source: pick('utm_source'), medium: pick('utm_medium'), campaign: pick('utm_campaign'),
      term: pick('utm_term'), content: pick('utm_content'),
      fbclid: pick('fbclid'), gclid: pick('gclid'),
      landing: window.location.pathname, at: Date.now(),
    };
    if (tagged.source || tagged.fbclid || tagged.gclid || tagged.campaign) {
      let referrer: string | undefined;
      try { referrer = document.referrer ? new URL(document.referrer).hostname : undefined; } catch { /* malformed */ }
      write({ ...tagged, referrer });
      return;
    }
    if (!document.referrer || read()) return;
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (!host || host === window.location.hostname || NOT_A_SOURCE.test(host)) return;
    write({ referrer: host, landing: window.location.pathname, at: Date.now() });
  } catch { /* attribution must never break a page */ }
}

function cookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch { return undefined; }
}

/**
 * What goes to the backend with an order: the stored touch, plus Meta's own first-party cookies
 * (_fbp identifies this browser, _fbc the ad click) and the page the order is placed from. Those
 * three are what the server-side Purchase event matches on.
 */
export function getAttribution(): Record<string, string | number> | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const t = read();
    const out: Record<string, string | number> = { pageUrl: window.location.href.split('#')[0] };
    if (t) for (const [k, v] of Object.entries(t)) if (v !== undefined && v !== '') out[k] = v;
    const fbp = cookie('_fbp'); if (fbp) out.fbp = fbp;
    const fbc = cookie('_fbc'); if (fbc) out.fbc = fbc;
    return out;
  } catch { return undefined; }
}
