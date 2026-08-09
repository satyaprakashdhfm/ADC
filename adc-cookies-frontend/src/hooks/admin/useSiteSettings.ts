'use client';
import { useState, useEffect } from 'react';
import { adminGetSettings, adminSetPromoProduct, adminSetHeaderOffer, adminSetStallInfo } from '@/lib/api';

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

  useEffect(() => {
    if (enabled) adminGetSettings().then(s => {
      setPromoProductId(s.promoProductId);
      setHeaderOffer(s.headerOffer || '');
      setStallInfo(s.stallInfo || '');
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

  return {
    promoProductId, savePromoProduct,
    headerOffer, headerOfferSaved, changeHeaderOffer, saveHeaderOffer,
    stallInfo, stallInfoSaved, changeStallInfo, saveStallInfo,
  };
}
