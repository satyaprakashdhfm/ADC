'use client';

/*
 * Browser notifications for a new order.
 *
 * Both boards already shout when an order lands — the store portal with an alarm and a tab-title
 * count, the admin dashboard with neither — but only while somebody is looking at that tab. A shop
 * tablet spends most of its day on the Petpooja app and the office laptop spends it in email, and
 * a notification is the only thing either browser will put in front of a person who is somewhere
 * else. That is the whole job here: no service worker, no push server, nothing that survives the
 * tab being closed. If the board is open, the notification fires.
 *
 * Everything below fails soft, because every step of this API is refusable:
 *
 *   - `Notification` does not exist at all on iOS Safari outside an installed web app.
 *   - Permission can be denied, and once denied it can only be changed in browser settings —
 *     asking again does nothing, so nothing here retries.
 *   - `new Notification()` throws `Illegal constructor` on Android Chrome, which only allows
 *     notifications through a service worker registration.
 *
 * None of those may break the board. A silent notification is a missed alert; a thrown one is a
 * blank screen.
 */

export type NotifyState = NotificationPermission | 'unsupported';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

export function notifyPermission(): NotifyState {
  return supported() ? Notification.permission : 'unsupported';
}

/**
 * Ask, once, from a click.
 *
 * Must be called from a user gesture — Safari requires it outright and Chrome will refuse a prompt
 * that no one asked for. Both the store portal and the dashboard hang this off a button the person
 * has to press, which is also the honest way to do it: a shop that wants alerts says so.
 *
 * Returns the resulting state rather than a boolean, so a caller can tell "they said no" from "this
 * browser cannot".
 */
export async function askToNotify(): Promise<NotifyState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    /* Safari before 16 only had the callback form and returns undefined; everything current returns
       a promise. Handing it both covers the pair without asking twice. */
    return await new Promise<NotificationPermission>((resolve) => {
      const maybe = Notification.requestPermission(resolve);
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve).catch(() => resolve(Notification.permission));
    });
  } catch {
    return Notification.permission;
  }
}

/**
 * Show one.
 *
 * `tag` replaces an existing notification with the same tag instead of stacking a second one, so a
 * poll that somehow reports the same order twice leaves one notification rather than two. Clicking
 * brings the board to the front, which is the only action there is to offer.
 */
export function notifyOrder(title: string, body: string, tag: string) {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag, icon: '/icon.png', badge: '/icon.png' });
    n.onclick = () => { try { window.focus(); n.close(); } catch { /* nothing to focus */ } };
  } catch {
    /* Android Chrome forbids the constructor outside a service worker. The board's own alarm and
       tab title still do their job; this is the extra, not the mechanism. */
  }
}

/** ₹ with Indian grouping, for a notification body. Kept here so both callers word it the same. */
export const notifyMoney = (v: number) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
