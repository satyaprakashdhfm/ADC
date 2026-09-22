'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminTraffic, adminTrafficLive, type AdminTraffic, type AdminTrafficLive } from '@/lib/api';
import { todayStr, daysAgoStr } from '@/components/admin/shared/format';

const LIVE_EVERY_MS = 60_000;

/**
 * The Traffic tab's data: the report for a chosen date range, and who is on the site right now.
 *
 * Loads only while the tab is open (`enabled`) — the report is nine Google Analytics queries plus
 * Meta's, and nobody reading the Orders tab needs them. The live count refreshes every minute while
 * the tab is open, which matches the backend's one-minute cache; asking faster would only get the
 * same number back.
 *
 * A failure is reported, not drawn as zeros, for the same reason as useAdminAnalytics: "nobody
 * visited" and "the request died" must not look alike.
 */
export function useAdminTraffic(enabled: boolean) {
  const [range, setRange] = useState(() => ({ from: daysAgoStr(29), to: todayStr() }));
  const [report, setReport] = useState<AdminTraffic | null>(null);
  const [live, setLive] = useState<AdminTrafficLive | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /* No loading flag set in here: this runs from an effect, and a synchronous setState there costs
     an extra render on every range change. The tab derives "loading" from report/error instead. */
  const load = useCallback((fresh = false) =>
    adminTraffic(range.from, range.to, fresh)
      .then(r => { setReport(r); setError(''); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load traffic.')),
  [range.from, range.to]);

  const loadLive = useCallback((fresh = false) =>
    adminTrafficLive(fresh).then(setLive).catch(() => { /* the card keeps its last reading */ }), []);

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    void loadLive();
    const t = setInterval(() => void loadLive(), LIVE_EVERY_MS);
    return () => clearInterval(t);
  }, [enabled, loadLive]);

  /** The Refresh button: skip both caches, so what shows is what Google and Meta say this minute. */
  const refresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([load(true), loadLive(true)]).finally(() => setRefreshing(false));
  }, [load, loadLive]);

  return { report, live, range, setRange, error, refreshing, refresh };
}
