'use client';
import { useState, useEffect } from 'react';
import { adminAnalytics, type AdminAnalytics } from '@/lib/api';
import { todayStr, daysAgoStr } from '@/components/admin/shared/format';

/** Charts data for the Overview tab, scoped to a date range the operator picks. */
export function useAdminAnalytics(enabled: boolean) {
  const [range, setRange] = useState(() => ({ from: daysAgoStr(29), to: todayStr() }));
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);

  useEffect(() => {
    if (enabled) adminAnalytics(range.from, range.to).then(setAnalytics).catch(() => {});
  }, [enabled, range.from, range.to]);

  return { analytics, range, setRange };
}
