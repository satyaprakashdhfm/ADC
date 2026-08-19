'use client';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LocationProvider } from '@/context/LocationContext';
import ProfileGate from '@/components/ProfileGate';
import FloatingDock from '@/components/storefront/FloatingDock';
import CartBar from '@/components/storefront/CartBar';
import { LocationGate } from '@/components/storefront/LocationPicker';

/* App-wide providers, mounted once in the root layout so auth + cart state stay
   consistent across every page (no remount on navigation).
   A first-time visitor is asked where they want it delivered (LocationGate) — knowing the area up
   front is what lets us promise same-day at all. The spin wheel deliberately holds off until that
   has been asked, so the two don't stack on top of each other on someone's very first landing.
   FloatingDock (support chat + WhatsApp) lives here rather than on the homepage alone, so help is
   reachable from every page; it self-limits the spin-wheel auto-popup to the homepage. */

/**
 * Is this a staff screen rather than the shop?
 *
 * /admin is the back office and /store/<code> is the order board on a shop counter's tablet. Neither
 * is a shopfront, and the storefront's floating furniture had no business on either: the dashboard
 * carried a Spin & Win button, a support chatbot and a WhatsApp bubble over its own controls, and the
 * shop terminal got all three plus a "where would you like this delivered?" popup.
 *
 * Worse than the clutter, LocationGate writes its "already asked" flag to localStorage the first time
 * it runs whatever the page — so opening /admin on a browser silently used up the one chance a real
 * customer on that browser had of ever being asked where they are.
 */
function isStaffScreen(pathname: string | null): boolean {
  const p = pathname || '';
  return p === '/admin' || p.startsWith('/admin/') || p === '/store' || p.startsWith('/store/');
}

export default function Providers({ children }: { children: ReactNode }) {
  const staff = isStaffScreen(usePathname());
  return (
    <AuthProvider>
      <CartProvider>
        <LocationProvider>
          {children}
          {/* The providers themselves stay mounted everywhere — the admin dashboard is inside this
              tree and reads none of them, but a context that unmounts on navigation would drop a
              customer's cart on the way through. Only the visible storefront furniture is dropped. */}
          {!staff && <>
            <ProfileGate />
            <LocationGate />
            <CartBar />
            <FloatingDock />
          </>}
        </LocationProvider>
      </CartProvider>
    </AuthProvider>
  );
}
