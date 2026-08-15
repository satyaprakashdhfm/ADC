'use client';
import { useState, useEffect } from 'react';
import { adminGetSettings, adminSetHeaderOffer, adminSetOrderingPaused, adminSetDeliveryFeeOutstation } from '@/lib/api';

/**
 * The site-wide switches an admin edits from the Products tab: the header banner line, whether
 * ordering is open, and the outstation delivery fee. Each saves independently and keeps its own
 * "Saved ✓" flag.
 */
export function useSiteSettings(enabled: boolean, onError: (s: string) => void) {
  const [headerOffer, setHeaderOffer] = useState('');
  const [headerOfferSaved, setHeaderOfferSaved] = useState(false);
  const [orderingPaused, setOrderingPaused] = useState('');
  const [orderingPausedSaved, setOrderingPausedSaved] = useState(false);
  const [deliveryFeeOutstation, setDeliveryFeeOutstation] = useState('100');
  const [deliveryFeeSaved, setDeliveryFeeSaved] = useState(false);

  useEffect(() => {
    if (enabled) adminGetSettings().then(s => {
      setHeaderOffer(s.headerOffer || '');
      setOrderingPaused(s.orderingPaused || '');
      setDeliveryFeeOutstation(String(s.deliveryFeeOutstation ?? 100));
    }).catch(() => {});
  }, [enabled]);

  const changeHeaderOffer = (v: string) => { setHeaderOffer(v); setHeaderOfferSaved(false); };
  const saveHeaderOffer = async () => {
    await adminSetHeaderOffer(headerOffer.trim() || null).catch(err => onError(String(err.message || err)));
    setHeaderOfferSaved(true);
  };

  const changeOrderingPaused = (v: string) => { setOrderingPaused(v); setOrderingPausedSaved(false); };
  const saveOrderingPaused = async () => {
    await adminSetOrderingPaused(orderingPaused.trim() || null).catch(err => onError(String(err.message || err)));
    setOrderingPausedSaved(true);
  };

  const changeDeliveryFeeOutstation = (v: string) => { setDeliveryFeeOutstation(v); setDeliveryFeeSaved(false); };
  const saveDeliveryFeeOutstation = async () => {
    const n = Number(deliveryFeeOutstation);
    if (!Number.isFinite(n) || n < 0) { onError('Enter a valid, non-negative delivery fee.'); return; }
    await adminSetDeliveryFeeOutstation(n).catch(err => onError(String(err.message || err)));
    setDeliveryFeeSaved(true);
  };

  return {
    headerOffer, headerOfferSaved, changeHeaderOffer, saveHeaderOffer,
    orderingPaused, orderingPausedSaved, changeOrderingPaused, saveOrderingPaused,
    deliveryFeeOutstation, deliveryFeeSaved, changeDeliveryFeeOutstation, saveDeliveryFeeOutstation,
  };
}
