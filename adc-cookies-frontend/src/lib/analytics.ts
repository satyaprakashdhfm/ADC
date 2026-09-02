/*
 * Google Analytics 4 and Google Ads, in one place.
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

type GtagArgs = [command: string, ...rest: unknown[]];
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: GtagArgs) => void }
}

/** Never throws, never fires when unconfigured, never runs during SSR. */
function gtag(...args: GtagArgs) {
  if (typeof window === 'undefined' || !analyticsEnabled) return;
  try { window.gtag?.(...args); } catch { /* analytics must not break a page */ }
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  gtag('event', name, params);
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
