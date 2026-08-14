'use client';
import { useState, useEffect } from 'react';
import { adminGetSettings, adminSetPromoProduct, adminSetHeaderOffer, adminSetStallInfo, adminSetOrderingPaused, adminSetDeliveryFeeOutstation } from '@/lib/api';

/**
 * The site-wide switches an admin edits from the Products tab: which product the homepage popup
 * features, the header banner line and the "today's stall" card. Each saves independently and
 * keeps its own "Saved ✓" flag.
 */
export function useSiteSettings(enabled: boolean, onError: (s: string) => void) {
  const [promoProductId, setPromoProductId] = useState<number | null>(null);
  const [headerOffer, setHeaderOffer] = useState('');
  const [headerOfferSaved, setHeaderOfferSaved] = useState(false);
  const [stallInfo, setStallInfo] = useState('');
  const [stallInfoSaved, setStallInfoSaved] = useState(false);
  const [orderingPaused, setOrderingPaused] = useState('');
  const [orderingPausedSaved, setOrderingPausedSaved] = useState(false);
  const [deliveryFeeOutstation, setDeliveryFeeOutstation] = useState('100');
  const [deliveryFeeSaved, setDeliveryFeeSaved] = useState(false);

  useEffect(() => {
    if (enabled) adminGetSettings().then(s => {
      setPromoProductId(s.promoProductId);
      setHeaderOffer(s.headerOffer || '');
      setStallInfo(s.stallInfo || '');
      setOrderingPaused(s.orderingPaused || '');
      setDeliveryFeeOutstation(String(s.deliveryFeeOutstation ?? 100));
    }).catch(() => {});
  }, [enabled]);

  const savePromoProduct = async (val: number | null) => {
    setPromoProductId(val);
    await adminSetPromoProduct(val).catch(err => onError(String(err.message || err)));
  };

  const changeHeaderOffer = (v: string) => { setHeaderOffer(v); setHeaderOfferSaved(false); };
  const saveHeaderOffer = async () => {
    await adminSetHeaderOffer(headerOffer.trim() || null).catch(err => onError(String(err.message || err)));
    setHeaderOfferSaved(true);
  };

  const changeStallInfo = (v: string) => { setStallInfo(v); setStallInfoSaved(false); };
  const saveStallInfo = async () => {
    await adminSetStallInfo(stallInfo.trim() || null).catch(err => onError(String(err.message || err)));
    setStallInfoSaved(true);
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
    promoProductId, savePromoProduct,
    headerOffer, headerOfferSaved, changeHeaderOffer, saveHeaderOffer,
    stallInfo, stallInfoSaved, changeStallInfo, saveStallInfo,
    orderingPaused, orderingPausedSaved, changeOrderingPaused, saveOrderingPaused,
    deliveryFeeOutstation, deliveryFeeSaved, changeDeliveryFeeOutstation, saveDeliveryFeeOutstation,
  };
}
