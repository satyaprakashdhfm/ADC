'use client';
import { useState, useEffect } from 'react';
import { adminGetSettings, adminSetBannerMessages, adminSetOrderingPaused, adminSetDeliveryFeeOutstation } from '@/lib/api';

/**
 * The site-wide switches an admin edits from the Products tab: the top banner's rotating lines,
 * whether ordering is open, and the outstation delivery fee. Each saves independently and keeps
 * its own "Saved ✓" flag.
 */
export function useSiteSettings(enabled: boolean, onError: (s: string) => void) {
  const [bannerMessages, setBannerMessages] = useState<string[]>([]);
  const [bannerMessagesSaved, setBannerMessagesSaved] = useState(false);
  const [orderingPaused, setOrderingPaused] = useState('');
  const [orderingPausedSaved, setOrderingPausedSaved] = useState(false);
  const [deliveryFeeOutstation, setDeliveryFeeOutstation] = useState('100');
  const [deliveryFeeSaved, setDeliveryFeeSaved] = useState(false);

  useEffect(() => {
    if (enabled) adminGetSettings().then(s => {
      setBannerMessages(s.bannerMessages?.length ? s.bannerMessages : ['']);
      setOrderingPaused(s.orderingPaused || '');
      setDeliveryFeeOutstation(String(s.deliveryFeeOutstation ?? 100));
    }).catch(() => {});
  }, [enabled]);

  const changeBannerMessage = (i: number, v: string) => {
    setBannerMessages(p => p.map((m, idx) => (idx === i ? v : m)));
    setBannerMessagesSaved(false);
  };
  const addBannerMessage = () => { setBannerMessages(p => [...p, '']); setBannerMessagesSaved(false); };
  const removeBannerMessage = (i: number) => {
    // Never leave the list empty: the ribbon's height is part of the page layout, and the server
    // refuses an empty list for the same reason.
    setBannerMessages(p => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));
    setBannerMessagesSaved(false);
  };
  const saveBannerMessages = async () => {
    const clean = bannerMessages.map(m => m.trim()).filter(Boolean);
    if (!clean.length) { onError('Write at least one banner message before saving.'); return; }
    const saved = await adminSetBannerMessages(clean).catch(err => { onError(String(err.message || err)); return null; });
    if (!saved) return;
    // Show what was actually stored, so a blank row the server dropped disappears here too rather
    // than sitting in the form looking saved.
    setBannerMessages(saved.bannerMessages?.length ? saved.bannerMessages : clean);
    setBannerMessagesSaved(true);
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
    bannerMessages, bannerMessagesSaved, changeBannerMessage, addBannerMessage, removeBannerMessage, saveBannerMessages,
    orderingPaused, orderingPausedSaved, changeOrderingPaused, saveOrderingPaused,
    deliveryFeeOutstation, deliveryFeeSaved, changeDeliveryFeeOutstation, saveDeliveryFeeOutstation,
  };
}
