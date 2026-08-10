'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminAttention, type AttentionReport } from '@/lib/api';

/**
 * Orders that took money but never reached the kitchen or a courier. Loaded on every admin visit
 * rather than lazily per tab: this is the one thing that must not wait for someone to click the
 * right tab.
 */
export function useAdminAttention(enabled: boolean) {
  const [attention, setAttention] = useState<AttentionReport | null>(null);

  useEffect(() => {
    if (enabled) adminAttention().then(setAttention).catch(() => {});
  }, [enabled]);

  const refreshAttention = useCallback(() => { adminAttention().then(setAttention).catch(() => {}); }, []);

  return { attention, refreshAttention };
}
