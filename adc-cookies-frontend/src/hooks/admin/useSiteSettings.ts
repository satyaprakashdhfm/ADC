'use client';
import { useState, useEffect } from 'react';
import {
  adminGetSettings, adminSetBannerMessages, adminSetOrderingPaused, adminSetDeliveryFeeOutstation,
  adminSetHeroBanner, type HeroBannerRefs, type HeroBannerUrls, type HeroSizes,
} from '@/lib/api';

const EMPTY_HERO: HeroBannerRefs = { desktopRef: null, mobileRef: null, href: null, alt: null };
const EMPTY_HERO_URLS: HeroBannerUrls = { desktop: null, mobile: null, href: null, alt: null };
const DEFAULT_HERO_SIZES: HeroSizes = {
  desktop: { width: 2400, height: 1200, note: '2:1 landscape' },
  mobile: { width: 1200, height: 1600, note: '3:4 portrait' },
};

/**
 * The site-wide switches: the ribbon's rotating lines, the home page's hero photograph, whether
 * ordering is open, and the outstation delivery fee. Each saves independently and keeps its own
 * "Saved ✓" flag.
 *
 * The hero is held as two parallel values — `heroBanner` (the stored references, which is what a
 * save sends) and `heroUrls` (the signed URLs, which only display). Saving the second would store
 * links that expire in a week, so they are deliberately never the same field.
 */
export function useSiteSettings(enabled: boolean, onError: (s: string) => void) {
  const [bannerMessages, setBannerMessages] = useState<string[]>([]);
  const [bannerMessagesSaved, setBannerMessagesSaved] = useState(false);
  const [orderingPaused, setOrderingPaused] = useState('');
  const [orderingPausedSaved, setOrderingPausedSaved] = useState(false);
  const [orderingPausedBusy, setOrderingPausedBusy] = useState(false);
  // Null until the first load lands. The ordering switch must not paint "LIVE" before it knows.
  const [orderingLoaded, setOrderingLoaded] = useState(false);
  const [deliveryFeeOutstation, setDeliveryFeeOutstation] = useState('100');
  const [deliveryFeeSaved, setDeliveryFeeSaved] = useState(false);
  const [heroBanner, setHeroBanner] = useState<HeroBannerRefs>(EMPTY_HERO);
  const [heroUrls, setHeroUrls] = useState<HeroBannerUrls>(EMPTY_HERO_URLS);
  const [heroSizes, setHeroSizes] = useState<HeroSizes>(DEFAULT_HERO_SIZES);
  const [heroSaved, setHeroSaved] = useState(false);
  const [heroBusy, setHeroBusy] = useState(false);

  useEffect(() => {
    if (enabled) adminGetSettings().then(s => {
      setBannerMessages(s.bannerMessages?.length ? s.bannerMessages : ['']);
      setOrderingPaused(s.orderingPaused || '');
      setDeliveryFeeOutstation(String(s.deliveryFeeOutstation ?? 100));
      setHeroBanner(s.heroBanner || EMPTY_HERO);
      setHeroUrls(s.heroBannerUrls || EMPTY_HERO_URLS);
      if (s.heroSizes) setHeroSizes(s.heroSizes);
      setOrderingLoaded(true);
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
  /* Takes the value to save rather than only reading state, so "go live" can send an empty string
     in one call. Going live off the state alone meant clearing the box first and saving second —
     two steps for the switch that decides whether the shop can take money, with a render in
     between where the box looked live but the server had not been told. */
  const saveOrderingPaused = async (override?: string) => {
    const value = override !== undefined ? override : orderingPaused;
    setOrderingPausedBusy(true);
    const ok = await adminSetOrderingPaused(value.trim() || null)
      .then(() => true)
      .catch(err => { onError(String(err.message || err)); return false; });
    setOrderingPausedBusy(false);
    if (!ok) return false;
    setOrderingPaused(value);
    setOrderingPausedSaved(true);
    return true;
  };

  /* An upload has already happened by the time this is called — the file is in the bucket. It is
     only recorded in the row on save, so cancelling out of the tab leaves an orphan object rather
     than a broken banner, which is the right way round of the two. */
  const changeHeroImage = (which: 'desktop' | 'mobile', ref: string, url: string) => {
    setHeroBanner(h => ({ ...h, [which === 'desktop' ? 'desktopRef' : 'mobileRef']: ref || null }));
    setHeroUrls(u => ({ ...u, [which]: url || null }));
    setHeroSaved(false);
  };
  const changeHeroField = (patch: Partial<Pick<HeroBannerRefs, 'href' | 'alt'>>) => {
    setHeroBanner(h => ({ ...h, ...patch }));
    setHeroSaved(false);
  };
  const saveHeroBanner = async () => {
    setHeroBusy(true);
    const saved = await adminSetHeroBanner(heroBanner).catch(err => { onError(String(err.message || err)); return null; });
    setHeroBusy(false);
    if (!saved) return;
    // Show what was actually stored: the server normalises the destination, so a path it tidied up
    // appears here tidied rather than sitting in the form looking like something else was saved.
    setHeroBanner(saved.heroBanner || EMPTY_HERO);
    setHeroUrls(saved.heroBannerUrls || EMPTY_HERO_URLS);
    setHeroSaved(true);
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
    orderingPaused, orderingPausedSaved, orderingPausedBusy, orderingLoaded, changeOrderingPaused, saveOrderingPaused,
    deliveryFeeOutstation, deliveryFeeSaved, changeDeliveryFeeOutstation, saveDeliveryFeeOutstation,
    heroBanner, heroUrls, heroSizes, heroSaved, heroBusy, changeHeroImage, changeHeroField, saveHeroBanner,
  };
}
