'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminDashboard, type AdminStats } from '@/lib/api';

/**
 * Headline dashboard counters. `refreshStats` is the single re-fetch other domains call after an
 * action that moves one of these numbers (an order status change, a message marked handled), so
 * they don't each re-implement the fetch.
 */
export function useAdminStats(enabled: boolean, onError?: (msg: string) => void) {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (enabled) adminDashboard().then(setStats).catch(e => onError?.(String(e.message || e)));
    // onError is intentionally not a dependency: it's a setState wrapper that changes identity
    // every render, and re-fetching the counters on every render is not the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const refreshStats = useCallback(() => { adminDashboard().then(setStats).catch(() => {}); }, []);

  return { stats, refreshStats };
}
