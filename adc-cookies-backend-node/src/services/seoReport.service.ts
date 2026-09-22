import { scSite, searchAnalytics, inspectUrl, listSitemaps, searchConsoleConfigured, type ScRow } from './searchConsole.client.js';
import { serviceAccountProblem } from './googleServiceAccount.js';

/*
 * The admin SEO tab's numbers: for each search page, how often Google showed it, how often it was
 * clicked, its position for each search, and whether Google has indexed it yet.
 *
 * The admin sends the list of page paths (the plan lives in the frontend, lib/seo/plan.ts), so a
 * new page shows up here the day it is added there, with no backend change.
 *
 * Google reports one page under every address it has seen it at (www and bare domain, http and
 * https, a trailing slash or not). Those are folded into one path here, with position averaged by
 * how often each was shown, so a page is one row and not four.
 */

const ORIGIN = 'https://www.adoughcookie.com';
const REPORT_TTL_MS = 30 * 60_000;
const INSPECT_TTL_MS = 6 * 3600_000;
const INSPECT_MIN_GAP_MS = 10 * 60_000;

export interface SeoQuery { query: string; clicks: number; impressions: number; position: number }

export interface SeoPageStats {
  path: string;
  clicks: number;
  impressions: number;
  /** Average position across every search it was shown for; null when it was never shown. */
  position: number | null;
  /** The searches it was shown for, most shown first (top 50). */
  queries: SeoQuery[];
  /** URL Inspection: Google's verdict and coverage wording, or null if the check failed. */
  index: { verdict: string; coverage: string; lastCrawl: string | null } | null;
}

export interface SeoReport {
  connected: boolean;
  problem: string | null;
  site: string | null;
  days: number;
  from: string;
  to: string;
  totals: { clicks: number; impressions: number; position: number | null } | null;
  pages: SeoPageStats[];
  sitemap: { path: string; lastRead: string | null; pages: number; errors: number; warnings: number } | null;
  generatedAt: string;
}

/** A Google page URL as one of our paths: no host, no query, no trailing slash (except "/"). */
export function pathOf(url: string): string {
  try {
    const p = new URL(url).pathname.replace(/\/+$/, '');
    return p || '/';
  } catch {
    return url;
  }
}

/* Sums clicks and impressions, and averages position weighted by impressions: a position seen
   4,000 times says more than one seen 6 times. */
function fold<T extends { clicks: number; impressions: number; position: number }>(rows: T[]) {
  let clicks = 0, impressions = 0, weighted = 0;
  for (const r of rows) { clicks += r.clicks; impressions += r.impressions; weighted += r.position * r.impressions; }
  return { clicks, impressions, position: impressions ? weighted / impressions : null };
}

const istDay = (msAgo: number) => new Date(Date.now() + 5.5 * 3600_000 - msAgo).toISOString().slice(0, 10);

const reportCache = new Map<string, { at: number; report: SeoReport }>();
const inspectCache = new Map<string, { at: number; value: SeoPageStats['index'] }>();

async function indexStatus(site: string, path: string, fresh: boolean): Promise<SeoPageStats['index']> {
  const hit = inspectCache.get(path);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && (age < (fresh ? INSPECT_MIN_GAP_MS : INSPECT_TTL_MS))) return hit.value;
  const r = await inspectUrl(site, `${ORIGIN}${path === '/' ? '/' : path}`);
  const value = r.ok ? { verdict: r.data.verdict, coverage: r.data.coverageState, lastCrawl: r.data.lastCrawlTime } : null;
  if (r.ok) inspectCache.set(path, { at: Date.now(), value });
  else console.log(`[SEARCH-CONSOLE] inspect | ✗ ${path} | ${r.reason}`);
  return value;
}

export async function seoReport(paths: string[], days: number, { fresh = false } = {}): Promise<SeoReport> {
  const from = istDay((days - 1) * 864e5);
  const to = istDay(0);
  const empty = (problem: string, site: string | null = null): SeoReport => ({
    connected: false, problem, site, days, from, to, totals: null, pages: [], sitemap: null, generatedAt: new Date().toISOString(),
  });

  if (!searchConsoleConfigured()) return empty(serviceAccountProblem() || 'The Google service account is not configured.');

  const cacheKey = `${days}|${paths.join(',')}`;
  const cached = reportCache.get(cacheKey);
  if (!fresh && cached && Date.now() - cached.at < REPORT_TTL_MS) return cached.report;

  const site = await scSite();
  if (!site.ok) return empty(site.reason);

  /* dataState 'all' includes the last two days, which Google marks as not final. Better slightly
     provisional numbers than a tab that is always three days behind. */
  const range = { startDate: from, endDate: to, dataState: 'all' };
  const [byPage, byPageQuery, overall, sitemaps] = await Promise.all([
    searchAnalytics(site.data, { ...range, dimensions: ['page'], rowLimit: 5000 }),
    searchAnalytics(site.data, { ...range, dimensions: ['page', 'query'], rowLimit: 25000 }),
    searchAnalytics(site.data, { ...range, rowLimit: 1 }),
    listSitemaps(site.data),
  ]);
  if (!byPage.ok) return empty(byPage.reason, site.data);

  const wanted = new Set(paths);
  const pageRows = new Map<string, ScRow[]>();
  for (const r of byPage.data) {
    const p = pathOf(r.keys[0] ?? '');
    if (wanted.has(p)) pageRows.set(p, [...(pageRows.get(p) || []), r]);
  }
  const queryRows = new Map<string, Map<string, ScRow[]>>();
  if (byPageQuery.ok) {
    for (const r of byPageQuery.data) {
      const p = pathOf(r.keys[0] ?? '');
      if (!wanted.has(p)) continue;
      const q = (r.keys[1] ?? '').trim().toLowerCase();
      const forPage = queryRows.get(p) || new Map<string, ScRow[]>();
      forPage.set(q, [...(forPage.get(q) || []), r]);
      queryRows.set(p, forPage);
    }
  }

  const indexes = await Promise.all(paths.map(p => indexStatus(site.data, p, fresh)));

  const pages: SeoPageStats[] = paths.map((path, i) => {
    const t = fold(pageRows.get(path) || []);
    const queries = [...(queryRows.get(path) || new Map()).entries()]
      .map(([query, rows]) => { const f = fold(rows); return { query, clicks: f.clicks, impressions: f.impressions, position: f.position ?? 0 }; })
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 50);
    return { path, clicks: t.clicks, impressions: t.impressions, position: t.position, queries, index: indexes[i] ?? null };
  });

  const total = overall.ok && overall.data[0] ? overall.data[0] : null;
  const sm = sitemaps.ok ? sitemaps.data.find(s => s.path.endsWith('/sitemap.xml')) ?? sitemaps.data[0] : undefined;

  const report: SeoReport = {
    connected: true,
    problem: byPageQuery.ok ? null : `Searches per page did not load: ${byPageQuery.reason}`,
    site: site.data,
    days, from, to,
    totals: total ? { clicks: total.clicks, impressions: total.impressions, position: total.position } : null,
    pages,
    sitemap: sm ? { path: sm.path, lastRead: sm.lastDownloaded, pages: sm.submitted, errors: sm.errors, warnings: sm.warnings } : null,
    generatedAt: new Date().toISOString(),
  };
  reportCache.set(cacheKey, { at: Date.now(), report });
  return report;
}
