'use client';
import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LocationProvider } from '@/context/LocationContext';
import ProfileGate from '@/components/ProfileGate';
import FloatingDock from '@/components/storefront/FloatingDock';
import CartBar from '@/components/storefront/CartBar';

/* App-wide providers, mounted once in the root layout so auth + cart state stay
   consistent across every page (no remount on navigation).
   Note: the homepage no longer force-opens a location picker on first visit — the spin wheel
   pops directly, and the delivery location is collected at checkout via the address form.
   FloatingDock (support chat + WhatsApp) lives here rather than on the homepage alone, so help is
   reachable from every page; it self-limits the spin-wheel auto-popup to the homepage. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <LocationProvider>
          {children}
          <ProfileGate />
          <CartBar />
          <FloatingDock />
        </LocationProvider>
      </CartProvider>
    </AuthProvider>
  );
}
