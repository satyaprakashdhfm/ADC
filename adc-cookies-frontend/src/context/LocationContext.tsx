'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { STORES, type Store } from '@/lib/stores';

/*
 * Delivery location — the industry-standard "Deliver to …" selector.
 * We're intracity, so a location always resolves to the NEAREST A Dough Cookie store
 * (even if the user is out of town, we pick the closest store to serve from).
 * Persisted per browser so the choice sticks across pages and visits.
 */
const LS_KEY = 'adc_location_pincode';

/** Short area name for a store, e.g. "A Dough Cookie — Jayanagar" → "Jayanagar". */
export const storeArea = (s: Store) => {
  const parts = s.name.split('—');
  return (parts[1] || s.city).trim();
};
export const storeLabel = (s: Store) => `${storeArea(s)}, ${s.city}`;

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestStore(lat: number, lng: number): Store {
  return STORES.reduce(
    (best, s) => (haversine(lat, lng, s.lat, s.lng) < haversine(lat, lng, best.lat, best.lng) ? s : best),
    STORES[0],
  );
}

interface LocationValue {
  store: Store | null;
  label: string;
  detecting: boolean;
  error: string;
  ready: boolean;               // hydrated from localStorage (avoids SSR/first-paint flash)
  detect: () => Promise<Store | null>;
  chooseStore: (s: Store) => void;
  clear: () => void;
}

const Ctx = createContext<LocationValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const pin = Number(localStorage.getItem(LS_KEY));
      if (pin) {
        const s = STORES.find(x => x.pincode === pin);
        if (s) setStore(s);
      }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  const persist = (s: Store | null) => {
    try {
      if (s) localStorage.setItem(LS_KEY, String(s.pincode));
      else localStorage.removeItem(LS_KEY);
    } catch { /* ignore */ }
  };

  const chooseStore = useCallback((s: Store) => { setStore(s); setError(''); persist(s); }, []);
  const clear = useCallback(() => { setStore(null); persist(null); }, []);

  const detect = useCallback(() => new Promise<Store | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location isn’t available on this device — pick a store below.');
      resolve(null); return;
    }
    setDetecting(true); setError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const s = nearestStore(pos.coords.latitude, pos.coords.longitude);
        setStore(s); persist(s); setDetecting(false); resolve(s);
      },
      err => {
        setDetecting(false);
        setError(err.code === 1
          ? 'Location permission denied — pick a store below.'
          : err.code === 3 ? 'Location timed out — try again or pick a store below.'
            : 'Couldn’t detect your location — pick a store below.');
        resolve(null);
      },
      // Coarse + longer window is far more reliable than high-accuracy (which times out indoors/desktop).
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }), []);

  return (
    <Ctx.Provider value={{ store, label: store ? storeLabel(store) : '', detecting, error, ready, detect, chooseStore, clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
