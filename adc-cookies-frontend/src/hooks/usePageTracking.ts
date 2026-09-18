'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { captureAttribution } from '@/lib/attribution';
import { trackPageView } from '@/lib/analytics';

/** The back office and the shop counters' tablets. Not customers, so not tracked. */
function isStaffScreen(p: string) {
  return p === '/admin' || p.startsWith('/admin/') || p === '/store' || p.startsWith('/store/');
}

/**
 * Per-page tracking for the storefront.
 *
 *   • once per full page load: remember where this visitor came from (lib/attribution), which is
 *     what the order carries to the backend and the dashboard reads back.
 *   • on every page, including client-side navigations: a Meta PageView. Next.js swaps pages without
 *     reloading, so Meta's usual "PageView on load" would see a whole visit as one page.
 *
 * Keyed on the pathname only, so a filter changing ?cat= on the home page is not a new page view.
 */
export function usePageTracking() {
  const pathname = usePathname() || '/';
  const captured = useRef(false);

  useEffect(() => {
    if (isStaffScreen(pathname)) return;
    if (!captured.current) { captured.current = true; captureAttribution(); }
    trackPageView();
  }, [pathname]);
}
