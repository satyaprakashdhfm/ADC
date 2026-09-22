import crypto from 'node:crypto';

/*
 * Google Analytics 4 — the Data API, read-only. Talks to Google and nothing else.
 *
 * Same .client split as WhatsApp and Delhivery: no database in here. It runs reports against the
 * GA4 property the storefront's gtag.js reports into, and returns plain rows.
 *
 * Authenticates as a SERVICE ACCOUNT: a JWT signed with its private key is swapped for an access
 * token, which is cached until shortly before it expires. Done by hand with node:crypto rather
 * than google-auth-library, because this is the only Google API we call with it and the whole
 * exchange is one signature and one POST.
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
const RAW_KEY = String(process.env.GA4_SERVICE_ACCOUNT_JSON || '').trim();
const API = 'https://analyticsdata.googleapis.com/v1beta';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

interface ServiceAccount { client_email: string; private_key: string }

/*
 * Read the key once, and when it is wrong say HOW — the admin tab shows this sentence verbatim.
 *
 * Railway mangles this value both ways it can be pasted, and both happened on the first day:
 *   - pasted as the multi-line file, it keeps only the first line, `"{`;
 *   - pasted as one line, it turns each `\n` inside private_key into a REAL line break, which is
 *     not allowed inside a JSON string, so the whole value stops parsing.
 * The second is undone here (real line breaks back into `\n`) rather than sending someone back to
 * Railway a third time. The first cannot be undone — the rest of the file never arrived.
 */
function readKey(): { key: ServiceAccount | null; problem: string | null } {
  if (!PROPERTY_ID) return { key: null, problem: 'GA4_PROPERTY_ID is not set.' };
  if (!/^\d+$/.test(PROPERTY_ID)) return { key: null, problem: 'GA4_PROPERTY_ID must be the property NUMBER (Admin → Property details), not the G-… measurement id.' };
  if (!RAW_KEY) return { key: null, problem: 'GA4_SERVICE_ACCOUNT_JSON is not set.' };
  let parsed: any = null;
  const forms = [RAW_KEY, RAW_KEY.replace(/\r?\n/g, '\\n'), Buffer.from(RAW_KEY, 'base64').toString('utf8')];
  for (const text of forms) {
    try { parsed = JSON.parse(text); break; } catch { /* try the next form */ }
  }
  if (!parsed) {
    return {
      key: null,
      problem: RAW_KEY.length < 100
        ? `GA4_SERVICE_ACCOUNT_JSON was cut off (only ${RAW_KEY.length} characters arrived). Railway keeps only the first line of a multi-line value — paste the key file as one line.`
        : 'GA4_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole key file exactly as downloaded.',
    };
  }
  if (!parsed.client_email || !parsed.private_key) {
    return { key: null, problem: 'GA4_SERVICE_ACCOUNT_JSON is JSON but not a service account key (no client_email / private_key).' };
  }
  return { key: { client_email: parsed.client_email, private_key: String(parsed.private_key).replace(/\\n/g, '\n') }, problem: null };
}

const { key: KEY, problem: CONFIG_PROBLEM } = readKey();

export const ga4Configured = () => !!KEY;
/** Why GA4 is off, in a sentence for the admin — or null when it is on. */
export const ga4Problem = () => CONFIG_PROBLEM;

console.log(KEY
  ? `[GA4] config | property=${PROPERTY_ID} | key=${KEY.client_email}`
  : `[GA4] config | off | ${CONFIG_PROBLEM}`);

// --- access token, cached (Railway runs one long-lived process) ---
let cached = { token: '', expMs: 0 };

async function accessToken(): Promise<string> {
  if (cached.token && Date.now() < cached.expMs - 60_000) return cached.token;
  if (!KEY) throw new Error(CONFIG_PROBLEM || 'GA4 is not configured');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: KEY.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(KEY.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(15_000),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
  cached = { token: body.access_token, expMs: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
  return cached.token;
}

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
