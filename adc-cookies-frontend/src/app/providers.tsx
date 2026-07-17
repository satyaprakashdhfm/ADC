'use client';
import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LocationProvider } from '@/context/LocationContext';
import ProfileGate from '@/components/ProfileGate';

/* App-wide providers, mounted once in the root layout so auth + cart state stay
   consistent across every page (no remount on navigation).
   Note: the homepage no longer force-opens a location picker on first visit — the spin wheel
   pops directly, and the delivery location is collected at checkout via the address form. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <LocationProvider>
          {children}
          <ProfileGate />
        </LocationProvider>
      </CartProvider>
    </AuthProvider>
  );
}
