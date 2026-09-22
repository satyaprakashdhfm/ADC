import { googleAccessToken, serviceAccount, serviceAccountProblem } from './googleServiceAccount.js';

/*
 * Google Search Console — read-only. Talks to Google and nothing else (the .client split).
 *
 * Signs in as the same service account as GA4 (googleServiceAccount), which has been added as a
 * user on the adoughcookie.com property. Three things are read:
 *   - search analytics: how often each page was shown in Google, clicked, and at what position,
 *     per search typed;
 *   - URL inspection: whether Google has indexed a page yet;
 *   - sitemaps: when Google last read ours.
 *
 * Which property: SEARCH_CONSOLE_SITE if set ("sc-domain:adoughcookie.com" or
 * "https://www.adoughcookie.com/"), otherwise found by listing the properties the service account
 * can see and taking the one for adoughcookie.com. Nothing new to configure in Railway.
 *
 * Free. Search analytics allows 1,200 queries a minute and URL inspection 2,000 a day per
 * property; the SEO report caches both (seoReport.service), so a busy admin uses a sliver.
 */
const API = 'https://searchconsole.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const SITE_OVERRIDE = String(process.env.SEARCH_CONSOLE_SITE || '').trim();
const DOMAIN = 'adoughcookie.com';

export const searchConsoleConfigured = () => !!serviceAccount();

export type ScResult<T> = { ok: true; data: T } | { ok: false; reason: string };

async function call<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<ScResult<T>> {
  const key = serviceAccount();
  if (!key) return { ok: false, reason: serviceAccountProblem() || 'not_configured' };
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await googleAccessToken(SCOPE)}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.error?.message || '');
      /* Google's 403 covers two different fixes, and its own wording names neither the account nor
         the place to fix it, so both are said in full. */
      const reason = res.status === 403 && /has not been used|is disabled/i.test(msg)
        ? 'The Search Console API is turned off in the Google Cloud project.'
        : res.status === 403
          ? `Search Console refused access. ${key.client_email} needs to be a user on the ${DOMAIN} property.`
          : msg || `http ${res.status}`;
      return { ok: false, reason };
    }
    return { ok: true, data: data as T };
  } catch (err: any) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? 'Search Console timed out' : err?.message || String(err) };
  }
}

/* The property, found once and remembered for the life of the process. A domain property wins
   over a URL one: it covers www and non-www, http and https, which is how Google reports it. */
let siteFound: string | null = null;

export async function scSite(): Promise<ScResult<string>> {
  if (SITE_OVERRIDE) return { ok: true, data: SITE_OVERRIDE };
  if (siteFound) return { ok: true, data: siteFound };
  const r = await call<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>('GET', '/webmasters/v3/sites');
  if (!r.ok) return r;
  const sites = (r.data.siteEntry || []).filter(s => s.permissionLevel !== 'siteUnverifiedUser').map(s => s.siteUrl);
  const pick = sites.find(s => s === `sc-domain:${DOMAIN}`)
    || sites.find(s => s === `https://www.${DOMAIN}/`)
    || sites.find(s => s.includes(DOMAIN));
  if (!pick) {
    return { ok: false, reason: `No Search Console property for ${DOMAIN} is shared with ${serviceAccount()?.client_email}.` };
  }
  siteFound = pick;
  return { ok: true, data: pick };
}

const sitePath = (site: string) => encodeURIComponent(site);

export interface ScRow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

/** One search analytics query. `body` is Google's searchAnalytics.query request. */
export async function searchAnalytics(site: string, body: object): Promise<ScResult<ScRow[]>> {
  const r = await call<{ rows?: ScRow[] }>('POST', `/webmasters/v3/sites/${sitePath(site)}/searchAnalytics/query`, body);
  return r.ok ? { ok: true, data: r.data.rows || [] } : r;
}

export interface ScInspection {
  verdict: string;
  coverageState: string;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
}

/** Whether Google has this URL in its index, per URL Inspection. */
export async function inspectUrl(site: string, url: string): Promise<ScResult<ScInspection>> {
  const r = await call<any>('POST', '/v1/urlInspection/index:inspect', { inspectionUrl: url, siteUrl: site, languageCode: 'en-IN' });
  if (!r.ok) return r;
  const s = r.data?.inspectionResult?.indexStatusResult || {};
  return {
    ok: true,
    data: {
      verdict: String(s.verdict || 'VERDICT_UNSPECIFIED'),
      coverageState: String(s.coverageState || ''),
      lastCrawlTime: s.lastCrawlTime || null,
      googleCanonical: s.googleCanonical || null,
    },
  };
}

export interface ScSitemap {
  path: string;
  lastDownloaded: string | null;
  lastSubmitted: string | null;
  isPending: boolean;
  errors: number;
  warnings: number;
  submitted: number;
}

export async function listSitemaps(site: string): Promise<ScResult<ScSitemap[]>> {
  const r = await call<{ sitemap?: any[] }>('GET', `/webmasters/v3/sites/${sitePath(site)}/sitemaps`);
  if (!r.ok) return r;
  return {
    ok: true,
    data: (r.data.sitemap || []).map(s => ({
      path: String(s.path),
      lastDownloaded: s.lastDownloaded || null,
      lastSubmitted: s.lastSubmitted || null,
      isPending: !!s.isPending,
      errors: Number(s.errors) || 0,
      warnings: Number(s.warnings) || 0,
      submitted: (s.contents || []).reduce((n: number, c: any) => n + (Number(c.submitted) || 0), 0),
    })),
  };
}
