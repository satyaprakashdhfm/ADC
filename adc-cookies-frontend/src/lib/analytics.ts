/*
 * Google Analytics 4, Google Ads and the Meta Pixel, in one place.
 *
 * DORMANT UNTIL CONFIGURED. With no measurement id set, nothing loads and every call here is a
 * no-op — the same shape as an unconfigured integration on the backend. So this can ship before
 * the Google account exists, and switching it on is an environment variable rather than a deploy.
 *
 * Nothing in here may throw. An analytics failure must never take a page down, and least of all
 * the page a customer reaches after paying us.
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
/** Google Ads conversion id, e.g. "AW-123456789". Separate account, separate id. */
export const ADS_ID = process.env.NEXT_PUBLIC_ADS_ID || '';
/** The purchase conversion's label, e.g. "AW-123456789/AbC-D_efGhIjKl". */
export const ADS_PURCHASE_LABEL = process.env.NEXT_PUBLIC_ADS_PURCHASE_LABEL || '';

export const analyticsEnabled = !!(GA_ID || ADS_ID);

/** Meta Pixel id (Events Manager). Public by nature — it ends up in the page either way. */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';

type GtagArgs = [command: string, ...rest: unknown[]];
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[][]; push: Fbq; loaded: boolean; version: string };
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: GtagArgs) => void; fbq?: Fbq; _fbq?: Fbq }
}

/** Never throws, never fires when unconfigured, never runs during SSR. */
function gtag(...args: GtagArgs) {
  if (typeof window === 'undefined' || !analyticsEnabled) return;
  try { window.gtag?.(...args); } catch { /* analytics must not break a page */ }
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  gtag('event', name, params);
}

/*
 * The Meta Pixel, loaded on first use rather than from a <Script> tag.
 *
 * This is Meta's own base snippet, run as a function: it installs a queueing stub for fbq, starts
 * fetching fbevents.js, and calls init — and the library drains the queue when it arrives. Doing it
 * here means an event fired before the library has loaded is queued, not lost, which a separate
 * <Script> racing a component's first effect could not promise. The first caller is the page-view
 * hook, after hydration, so it still never sits in front of the page.
 *
 * Staff screens (/admin, /store) never call it, so the office and the shop counters are not in the
 * audience the ads are trained on.
 */
function loadPixel(): Fbq | null {
  if (typeof window === 'undefined' || !META_PIXEL_ID) return null;
  if (window.fbq) return window.fbq;
  const n = function (...args: unknown[]) {
    // apply(n, …), exactly as Meta's snippet does — fbevents.js may rely on `this` being fbq.
    if (n.callMethod) n.callMethod.apply(n, args); else n.queue.push(args);
  } as Fbq;
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  const t = document.createElement('script');
  t.async = true;
  t.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(t);
  n('init', META_PIXEL_ID);
  return n;
}

/** Never throws, never fires when unconfigured, never runs during SSR. */
function fbq(...args: unknown[]) {
  try { loadPixel()?.(...args); } catch { /* analytics must not break a page */ }
}

/** One per page, including client-side navigations — the hook in usePageTracking calls it. */
export function trackPageView() {
  fbq('track', 'PageView');
}

export interface CartLine { id: string | number; name: string; price: number; qty: number }

export function trackAddToCart(line: CartLine) {
  const value = line.price * line.qty;
  fbq('track', 'AddToCart', {
    content_ids: [String(line.id)], content_name: line.name, content_type: 'product',
    contents: [{ id: String(line.id), quantity: line.qty }], value, currency: 'INR',
  });
  trackEvent('add_to_cart', {
    currency: 'INR', value,
    items: [{ item_id: String(line.id), item_name: line.name, price: line.price, quantity: line.qty }],
  });
}

/** GA only — Meta has no standard event for taking something out. */
export function trackRemoveFromCart(line: CartLine) {
  trackEvent('remove_from_cart', {
    currency: 'INR', value: line.price * line.qty,
    items: [{ item_id: String(line.id), item_name: line.name, price: line.price, quantity: line.qty }],
  });
}

/** Pay pressed — the step between "reviewing an order" and "in Razorpay's window". */
export function trackAddPaymentInfo(value: number) {
  fbq('track', 'AddPaymentInfo', { value, currency: 'INR' });
  trackEvent('add_payment_info', { currency: 'INR', value, payment_type: 'razorpay' });
}

/*
 * A completed sign-in. A brand-new account is a sign-up (GA4 sign_up, Meta CompleteRegistration —
 * the event a "get sign-ups" campaign optimises for); anyone else is a login. "New" is an account
 * created in the last ten minutes, read from /auth/me, because the sign-in itself looks identical
 * either way from here.
 */
export function trackSignIn(method: 'phone' | 'google', createdAt?: string | null) {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  if (Number.isFinite(created) && Date.now() - created < 10 * 60_000) {
    trackEvent('sign_up', { method });
    fbq('track', 'CompleteRegistration', { content_name: method, status: true });
  } else {
    trackEvent('login', { method });
  }
}

export function trackInitiateCheckout(lines: CartLine[]) {
  const value = lines.reduce((s, l) => s + l.price * l.qty, 0);
  fbq('track', 'InitiateCheckout', {
    content_ids: lines.map(l => String(l.id)), content_type: 'product',
    contents: lines.map(l => ({ id: String(l.id), quantity: l.qty })),
    num_items: lines.reduce((s, l) => s + l.qty, 0), value, currency: 'INR',
  });
  trackEvent('begin_checkout', {
    currency: 'INR', value,
    items: lines.map(l => ({ item_id: String(l.id), item_name: l.name, price: l.price, quantity: l.qty })),
  });
}

export interface PurchasePayload {
  orderNumber: string;
  value: number;
  items?: { name: string; qty: number }[];
  coupon?: string | null;
}

/*
 * The one event that matters.
 *
 * transaction_id is our order number, and it is what makes this SAFE TO CALL MORE THAN ONCE:
 * GA4 de-duplicates a purchase on it, so a refresh, a back-button, or a customer returning to the
 * success page cannot inflate revenue. Without it, one order counted three times teaches Google's
 * bidding to pay three times too much for the next one.
 *
 * Sent to GA4 and, when a conversion label is configured, to Google Ads as well — Ads reads its own
 * conversion rather than the GA4 event unless the accounts are linked and the import is set up, and
 * an ad account that cannot see conversions is an ad account spending blind.
 */
export function trackPurchase({ orderNumber, value, items, coupon }: PurchasePayload) {
  if (!orderNumber) return;
  const payload = {
    transaction_id: orderNumber,
    value,
    currency: 'INR',
    coupon: coupon || undefined,
    items: (items || []).map((i, index) => ({
      item_id: `${i.name}`.slice(0, 100),
      item_name: i.name,
      quantity: i.qty,
      index,
    })),
  };
  trackEvent('purchase', payload);
  /* eventID is the order number, and the server sends the same id from finalizePaidOrder. When both
     arrive Meta keeps one — which is what makes it safe to send from both places. */
  fbq('track', 'Purchase', {
    value, currency: 'INR', content_type: 'product',
    num_items: (items || []).reduce((s, i) => s + i.qty, 0),
  }, { eventID: orderNumber });
  if (ADS_PURCHASE_LABEL) {
    gtag('event', 'conversion', {
      send_to: ADS_PURCHASE_LABEL,
      value,
      currency: 'INR',
      transaction_id: orderNumber,
    });
  }
}

/*
 * Enhanced conversions: the customer's own identifiers, so a conversion still matches when the
 * cookie does not — which on mobile is most of the time.
 *
 * Google hashes these in the browser before they leave, and only when the account has enhanced
 * conversions turned on. We pass them raw to gtag, which is what their API expects; we do NOT log
 * them, store them, or send them anywhere else.
 */
export function setUserData(user: { email?: string | null; phone?: string | null }) {
  const email = (user.email || '').trim().toLowerCase();
  const phone = (user.phone || '').replace(/\D/g, '');
  if (!email && !phone) return;
  gtag('set', 'user_data', {
    ...(email ? { email } : {}),
    // E.164, which is the only format their matcher accepts.
    ...(phone ? { phone_number: `+${phone.length === 10 ? '91' + phone : phone}` } : {}),
  });
}
