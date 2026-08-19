'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminAnalytics, type AdminAnalytics } from '@/lib/api';
import { todayStr, daysAgoStr } from '@/components/admin/shared/format';

/**
 * Charts data for the Overview tab, scoped to a date range the operator picks.
 *
 * The failure is reported, not swallowed. This used to end in `.catch(() => {})`, which meant a
 * broken endpoint left `analytics` null forever and every chart painted its own "no data yet" empty
 * state. That is exactly what happened for as long as /admin/analytics was 500ing on a bad SQL
 * function call: the dashboard said, in four places, that the shop had never sold anything. An
 * error has to look different from a quiet week.
 *
 * `loading` is deliberately derived by the caller from `analytics === null && !error` rather than
 * kept here — setting a flag inside the effect body is a synchronous setState during render, which
 * cascades an extra render on every range change.
 */
export function useAdminAnalytics(enabled: boolean) {
  const [range, setRange] = useState(() => ({ from: daysAgoStr(29), to: todayStr() }));
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => adminAnalytics(range.from, range.to)
      .then(a => { setAnalytics(a); setError(''); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the charts.')),
    [range.from, range.to],
  );

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  return { analytics, range, setRange, error, reload: load };
}
