'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSpinStatus, claimSpin } from '@/lib/api';

// A won reward, either already claimed (server-recorded, logged in) or still pending a login
// (guest — held in localStorage until they sign in, honoured for CLAIM_WINDOW_HOURS).
export interface ActiveReward {
  code: string; label: string; discountType?: string; discountValue?: number;
  minimumOrderAmount?: number | null; maximumDiscount?: number | null; terms?: string;
  isGift?: boolean;
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

// Full hr/min/sec countdown, e.g. "11h 42m 05s" — used in the wheel popup where there's room.
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : m > 0 ? `${m}m ${pad(s)}s` : `${s}s`;
}

// Compact clock for the small launcher badge — "11:42:05" (H:MM:SS), still hr/min/sec but tight.
export function formatRemainingShort(ms: number): string {
  if (ms <= 0) return 'Now';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
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
          reward = { code: claimed.code, label: claimed.label, discountType: claimed.discountType, discountValue: claimed.discountValue, minimumOrderAmount: claimed.minimumOrderAmount, maximumDiscount: claimed.maximumDiscount, terms: claimed.terms, isGift: claimed.isGift, expiresAtMs: new Date(claimed.expiresAt).getTime(), claimed: true };
        } catch { /* the code may no longer be valid — fall through to a server status check */ }
        clearPending();
      }
      if (!reward) {
        const status = await getSpinStatus().catch(() => null);
        if (status?.active) {
          const a = status.active;
          reward = { code: a.code, label: a.label, discountType: a.discountType, discountValue: a.discountValue, minimumOrderAmount: a.minimumOrderAmount, maximumDiscount: a.maximumDiscount, terms: a.terms, isGift: a.isGift, expiresAtMs: new Date(a.expiresAt).getTime(), claimed: true };
        }
      }
    } else {
      reward = readPending();
    }
    setActiveReward(reward);
    setChecking(false);
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => { void resolve(); }, 0);
    return () => clearTimeout(t);
  }, [resolve]);

  // Tick every second so the hr/min/sec countdown (badge + popup) stays live. Only runs while a
  // reward is actually being shown, so there's no per-second render churn otherwise.
  useEffect(() => {
    if (!activeReward) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeReward]);

  // Drop the reward the moment its window runs out, wherever it's being displayed.
  useEffect(() => {
    if (!activeReward) return;
    const t = setTimeout(() => {
      clearPending();
      setActiveReward(null);
    }, Math.max(0, activeReward.expiresAtMs - Date.now()));
    return () => clearTimeout(t);
  }, [activeReward]);

  return { activeReward, setActiveReward, checking, now, refresh: resolve };
}
