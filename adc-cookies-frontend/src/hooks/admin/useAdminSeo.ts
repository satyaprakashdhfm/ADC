'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminSeo, type AdminSeo } from '@/lib/api';
import { PLAN_PAGES } from '@/lib/seo/plan';

export const SEO_PERIODS = [7, 28, 90] as const;
export type SeoPeriod = typeof SEO_PERIODS[number];

const PATHS = PLAN_PAGES.map(p => p.path);

/**
 * The SEO tab's Google Search Console numbers for the pages in the plan.
 *
 * Loads only while the tab is open (`enabled`): the first load checks every page with Google's URL
 * Inspection, which takes several seconds, and nobody on the Orders tab needs it. The backend caches
 * for half an hour; Refresh skips that.
 *
 * A failure is reported, not drawn as zeros: "Google never showed this page" and "the request died"
 * must not look alike.
 */
export function useAdminSeo(enabled: boolean) {
  const [days, setDays] = useState<SeoPeriod>(28);
  const [report, setReport] = useState<AdminSeo | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /* No loading flag set in here: this runs from an effect, and a synchronous setState there costs
     an extra render. The tab derives "loading" from report/error instead. */
  const load = useCallback((fresh = false) =>
    adminSeo(days, PATHS, fresh)
      .then(r => { setReport(r); setError(''); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load Google Search Console.')),
  [days]);

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(true).finally(() => setRefreshing(false));
  }, [load]);

  return { report, days, setDays, error, refreshing, refresh };
}
