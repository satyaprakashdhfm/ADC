'use client';
import { ReactNode } from 'react';
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
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <LocationProvider>
          {children}
          <ProfileGate />
          <LocationGate />
          <CartBar />
          <FloatingDock />
        </LocationProvider>
      </CartProvider>
    </AuthProvider>
  );
}
