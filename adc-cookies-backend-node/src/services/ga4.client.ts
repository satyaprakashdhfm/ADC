import { googleAccessToken, serviceAccount, serviceAccountProblem } from './googleServiceAccount.js';

/*
 * Google Analytics 4 — the Data API, read-only. Talks to Google and nothing else.
 *
 * Same .client split as WhatsApp and Delhivery: no database in here. It runs reports against the
 * GA4 property the storefront's gtag.js reports into, and returns plain rows.
 *
 * Authenticates as our SERVICE ACCOUNT, through googleServiceAccount (shared with Search Console).
 *
 * Configured by two variables:
 *   GA4_PROPERTY_ID           the property's NUMBER (Admin → Property details), not the G-… id
 *   GA4_SERVICE_ACCOUNT_JSON  the service account's key file, pasted whole (or base64 of it)
 * The service account must be added to the property as a Viewer.
 *
 * Free: Google charges nothing for the Data API, it only meters "tokens" per property per day,
 * and a dashboard that caches its reports (trafficAnalytics.service does) uses a sliver of them.
 */
const PROPERTY_ID = String(process.env.GA4_PROPERTY_ID || '').trim();
const API = 'https://analyticsdata.googleapis.com/v1beta';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/* GA4 needs the property as well as the key. Its problems are checked first, because a wrong
   property id is the mistake people actually make (the G-… measurement id looks like the answer). */
function readConfig(): { ok: boolean; problem: string | null } {
  if (!PROPERTY_ID) return { ok: false, problem: 'GA4_PROPERTY_ID is not set.' };
  if (!/^\d+$/.test(PROPERTY_ID)) return { ok: false, problem: 'GA4_PROPERTY_ID must be the property NUMBER (Admin → Property details), not the G-… measurement id.' };
  if (!serviceAccount()) return { ok: false, problem: serviceAccountProblem() };
  return { ok: true, problem: null };
}

const { ok: CONFIGURED, problem: CONFIG_PROBLEM } = readConfig();
const KEY = CONFIGURED ? serviceAccount() : null;

export const ga4Configured = () => !!KEY;
/** Why GA4 is off, in a sentence for the admin — or null when it is on. */
export const ga4Problem = () => CONFIG_PROBLEM;

console.log(KEY
  ? `[GA4] config | property=${PROPERTY_ID} | key=${KEY.client_email}`
  : `[GA4] config | off | ${CONFIG_PROBLEM}`);

const accessToken = () => googleAccessToken(SCOPE);

/**
 * One report row: dimension values as strings, metric values as numbers, both in request order.
 * dim(i) / met(i) read one safely — '' and 0 for a column the row does not have.
 */
export interface Ga4Row { dims: string[]; mets: number[]; dim(i: number): string; met(i: number): number }
export type Ga4Result = { ok: true; rows: Ga4Row[] } | { ok: false; reason: string };

async function call(method: 'runReport' | 'runRealtimeReport', body: object): Promise<Ga4Result> {
  if (!KEY) return { ok: false, reason: CONFIG_PROBLEM || 'not_configured' };
  try {
    const res = await fetch(`${API}/properties/${PROPERTY_ID}:${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      /* 403 is almost always the service account not having been added to the property. Said
         in those words, because Google's own message ("User does not have sufficient
         permissions") does not say which user or where to fix it. */
      const reason = res.status === 403
        ? `Google refused access. Add ${KEY.client_email} to the GA4 property as a Viewer (Admin → Property access management).`
        : data?.error?.message || `http ${res.status}`;
      return { ok: false, reason };
    }
    const rows: Ga4Row[] = (data.rows || []).map((r: any) => {
      const dims: string[] = (r.dimensionValues || []).map((d: any) => String(d.value ?? ''));
      const mets: number[] = (r.metricValues || []).map((m: any) => Number(m.value) || 0);
      return { dims, mets, dim: (i: number) => dims[i] ?? '', met: (i: number) => mets[i] ?? 0 };
    });
    return { ok: true, rows };
  } catch (err: any) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? 'Google Analytics timed out' : err?.message || String(err) };
  }
}

/** A standard report over a date range. `body` is the Data API's own RunReportRequest. */
export const runReport = (body: object) => call('runReport', body);

/** Who is on the site in the last 30 minutes. Same shape, from the realtime endpoint. */
export const runRealtimeReport = (body: object) => call('runRealtimeReport', body);
