'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getOrders } from '@/lib/api';
import { trackPurchase } from '@/lib/analytics';

/**
 * The browser Purchase for a payment that came back by redirect.
 *
 * Instagram's and Facebook's in-app browsers cannot run Razorpay's popup, so Razorpay redirects
 * instead, and the backend sends the customer on to /account?payment=success&order=<number>. The
 * success screen — the only other place a browser Purchase fires — is never shown on that path.
 * That is precisely the path an ad click takes, so without this GA4 never saw those sales at all,
 * and Meta only had its server copy.
 *
 * Safe to fire even if something else already reported the order: GA4 de-duplicates on
 * transaction_id and Meta on eventID, and both are the order number. Only a PAID order counts.
 * The two parameters are removed afterwards so a refresh does not ask again.
 */
export function useRedirectPurchase() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== '/account' || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const number = url.searchParams.get('order');
    if (url.searchParams.get('payment') !== 'success' || !number) return;
    url.searchParams.delete('payment');
    url.searchParams.delete('order');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);

    getOrders()
      .then((orders) => {
        const o = (orders || []).find((x) => x.orderNumber === number);
        if (!o || o.paymentStatus !== 'PAID') return;
        trackPurchase({
          orderNumber: o.orderNumber,
          value: Number(o.totalAmount) || 0,
          items: (o.items || []).map((i) => ({ name: i.productName, qty: i.quantity })),
          coupon: o.couponCode ?? null,
        });
      })
      .catch(() => { /* not signed in on this browser, or offline — the server copy still counts it */ });
  }, [pathname]);
}
