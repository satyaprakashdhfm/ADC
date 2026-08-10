'use client';
import { useState, useEffect } from 'react';
import { checkDeliveryPin, type DeliveryCheck } from '@/lib/api';

/**
 * Real serviceability + TAT for the selected address, re-checked whenever its pincode changes.
 *
 * Display only: orders.js recomputes serviceability and the delivery fee authoritatively at
 * order-creation and never trusts what the client showed here.
 */
export function useDeliveryCheck(pincode?: string | null) {
  const [delivCheck, setDelivCheck] = useState<DeliveryCheck | null>(null);
  const [delivChecking, setDelivChecking] = useState(false);

  useEffect(() => {
    const pin = pincode?.replace(/\D/g, '') || '';
    if (pin.length !== 6) { setDelivCheck(null); return; }
    let cancelled = false;
    setDelivChecking(true);
    checkDeliveryPin(pin).then(r => { if (!cancelled) { setDelivCheck(r); setDelivChecking(false); } })
      .catch(() => { if (!cancelled) { setDelivCheck(null); setDelivChecking(false); } });
    return () => { cancelled = true; };
  }, [pincode]);

  return { delivCheck, delivChecking };
}
