'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSpinStatus, claimSpin } from '@/lib/api';

// A won reward, either already claimed (server-recorded, logged in) or still pending a login
// (guest — held in localStorage until they sign in, honoured for CLAIM_WINDOW_HOURS).
export interface ActiveReward {
  code: string; label: string; discountType?: string; discountValue?: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null; terms?: string;
  expiresAtMs: number; claimed: boolean;
}

export const PENDING_KEY = 'adc_spin_pending';
export const CLAIM_WINDOW_HOURS = 12; // mirrors the backend — a guest win survives this long awaiting login

export function readPending(): ActiveReward | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ActiveReward;
    if (!p.expiresAtMs || p.expiresAtMs <= Date.now()) { localStorage.removeItem(PENDING_KEY); return null; }
    return p;
  } catch { return null; }
}
export function savePending(r: ActiveReward) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(r)); } catch { /* ignore */ } }
export function clearPending() { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } }

export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Compact form for a small badge — "11h", "42m", or "Now" — where the full "11h 42m" wouldn't fit.
export function formatRemainingShort(ms: number): string {
  if (ms <= 0) return 'Now';
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  return h > 0 ? `${h}h` : `${totalMin}m`;
}

// Resolves and tracks the shopper's active Spin & Win reward (claimed or pending-login),
// independent of whether the wheel's modal is open — so a persistent badge (e.g. on the
// floating dock launcher) can keep showing the 12h countdown after the modal is closed.
export function useActiveSpinReward() {
  const { user } = useAuth();
  const [activeReward, setActiveReward] = useState<ActiveReward | null>(null);
  const [checking, setChecking] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const resolve = useCallback(async () => {
    setChecking(true);
    let reward: ActiveReward | null = null;
    if (user) {
      const pending = readPending();
      if (pending) {
        try {
          const claimed = await claimSpin(pending.code);
          reward = { code: claimed.code, label: claimed.label, discountType: claimed.discountType, discountValue: claimed.discountValue, minimumOrderAmount: claimed.minimumOrderAmount, maximumDiscount: claimed.maximumDiscount, terms: claimed.terms, expiresAtMs: new Date(claimed.expiresAt).getTime(), claimed: true };
        } catch { /* the code may no longer be valid — fall through to a server status check */ }
        clearPending();
      }
      if (!reward) {
        const status = await getSpinStatus().catch(() => null);
        if (status?.active) {
          const a = status.active;
          reward = { code: a.code, label: a.label, discountType: a.discountType, discountValue: a.discountValue, minimumOrderAmount: a.minimumOrderAmount, maximumDiscount: a.maximumDiscount, terms: a.terms, expiresAtMs: new Date(a.expiresAt).getTime(), claimed: true };
        }
      }
    } else {
      reward = readPending();
    }
    setActiveReward(reward);
    setChecking(false);
  }, [user]);

  useEffect(() => { resolve(); }, [resolve]);

  // Tick every 30s so a visible countdown stays fresh even while the modal is closed.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Drop the reward the moment its window runs out, wherever it's being displayed.
  useEffect(() => {
    if (activeReward && activeReward.expiresAtMs <= now) {
      clearPending();
      setActiveReward(null);
    }
  }, [activeReward, now]);

  return { activeReward, setActiveReward, checking, now, refresh: resolve };
}
