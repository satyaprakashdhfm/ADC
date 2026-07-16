'use client';
import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LocationProvider } from '@/context/LocationContext';
import { LocationGate } from '@/components/storefront/LocationPicker';
import ProfileGate from '@/components/ProfileGate';

/* App-wide providers, mounted once in the root layout so auth + cart state stay
   consistent across every page (no remount on navigation). */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <LocationProvider>
          {children}
          <LocationGate />
          <ProfileGate />
        </LocationProvider>
      </CartProvider>
    </AuthProvider>
  );
}
