'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminNewOrders } from '@/lib/api';
import { askToNotify, notifyMoney, notifyOrder, notifyPermission, type NotifyState } from '@/lib/notify';

/** Half a minute. Slow enough to be free, fast enough that nobody hears about an order from the phone first. */
const POLL_MS = 30_000;

/**
 * Tell the office when an order arrives, even when the dashboard is not the tab they are looking at.
 *
 * Runs for the whole dashboard rather than the Orders tab, because an order does not wait for
 * somebody to be on the right screen. It polls /admin/orders/new, which returns nothing at all when
 * nothing has happened — the full order list was far too heavy to ask for twice a minute.
 *
 * The first poll only learns where "now" is and announces nothing: a dashboard opened at nine in
 * the morning must not fire a notification for every order taken overnight.
 *
 * `count` is what has arrived since this page was opened. It drives the tab title, which is the
 * fallback for the two cases a notification cannot cover — permission refused, and a browser that
 * has no Notification API.
 */
export function useNewOrderAlert(enabled: boolean) {
  /* The highest order id we have accounted for. null until the first poll has landed, which is what
     marks that first poll as "learn, do not announce". A ref, not state: changing it must not
     re-run the effect that sets it. */
  const since = useRef<number | null>(null);
  const [permission, setPermission] = useState<NotifyState>('default');
  const [count, setCount] = useState(0);

  // Read on mount only — `Notification.permission` is not reactive, and anything the person changes
  // in browser settings mid-session shows up the next time they press the button.
  useEffect(() => { setPermission(notifyPermission()); }, []);

  const enableNotifications = useCallback(async () => { setPermission(await askToNotify()); }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const tick = async () => {
      try {
        const r = await adminNewOrders(since.current ?? undefined);
        if (!alive) return;
        const first = since.current === null;
        since.current = r.latestId;
        if (first || !r.orders.length) return;

        setCount(c => c + r.orders.length);
        /* Four at once is a rush, not four things to read. One line beats four notifications
           covering each other up. */
        if (r.orders.length > 3) {
          notifyOrder(`${r.orders.length} new orders`,
            r.orders.map(o => o.orderNumber).join(', ').slice(0, 140), 'adc-admin-orders');
          return;
        }
        for (const o of r.orders) {
          notifyOrder('New order',
            [o.orderNumber, notifyMoney(o.totalAmount), o.store].filter(Boolean).join(' · '),
            `adc-admin-order-${o.id}`);
        }
      } catch {
        /* A failed poll is not worth telling anyone about — the next one is thirty seconds away,
           and an alert that cries about its own network is an alert people turn off. */
      }
    };

    void tick();
    const t = setInterval(tick, POLL_MS);
    // Also the moment the tab comes back, so a laptop reopened after lunch is current immediately
    // rather than up to half a minute stale.
    const onFocus = () => void tick();
    window.addEventListener('focus', onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [enabled]);

  /* In the tab title, so the count is visible from a browser tab strip whatever the answer was to
     the permission prompt. Cleared by opening the Orders tab, which is what `clear` is for. */
  useEffect(() => {
    document.title = count ? `(${count}) New orders — ADC Admin` : 'ADC Admin';
  }, [count]);

  return { permission, enableNotifications, newOrders: count, clearNewOrders: () => setCount(0) };
}
