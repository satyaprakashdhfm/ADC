import crypto from 'node:crypto';

/*
 * Signing in to Google as our service account (adc-analytics-reader), for every Google API we
 * read: GA4 for the Traffic tab, Search Console for the SEO tab. One key, one account, a token per
 * scope.
 *
 * The key is GA4_SERVICE_ACCOUNT_JSON, named for the first API that used it. It is not renamed:
 * the value in Railway took three attempts to paste, and the name is the one thing about it that
 * works.
 *
 * A JWT signed with the key is swapped for an access token, cached until shortly before it
 * expires. Done by hand with node:crypto rather than google-auth-library: the whole exchange is one
 * signature and one POST.
 */
const RAW_KEY = String(process.env.GA4_SERVICE_ACCOUNT_JSON || '').trim();

export interface ServiceAccount { client_email: string; private_key: string }

/*
 * Read the key once, and when it is wrong say HOW — the admin tabs show this sentence verbatim.
 *
 * Railway mangles this value both ways it can be pasted, and both happened on the first day:
 *   - pasted as the multi-line file, it keeps only the first line, `"{`;
 *   - pasted as one line, it turns each `\n` inside private_key into a REAL line break, which is
 *     not allowed inside a JSON string, so the whole value stops parsing.
 * The second is undone here (real line breaks back into `\n`) rather than sending someone back to
 * Railway a third time. The first cannot be undone — the rest of the file never arrived.
 */
function readKey(): { key: ServiceAccount | null; problem: string | null } {
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

const { key: KEY, problem: KEY_PROBLEM } = readKey();

/** The service account, or null when the key is missing or unreadable. */
export const serviceAccount = () => KEY;
/** Why the key cannot be used, in a sentence for the admin — or null when it can. */
export const serviceAccountProblem = () => KEY_PROBLEM;

// --- access tokens, one per scope, cached (Railway runs one long-lived process) ---
const tokens = new Map<string, { token: string; expMs: number }>();

export async function googleAccessToken(scope: string): Promise<string> {
  const hit = tokens.get(scope);
  if (hit && Date.now() < hit.expMs - 60_000) return hit.token;
  if (!KEY) throw new Error(KEY_PROBLEM || 'The Google service account is not configured');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: KEY.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(KEY.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(15_000),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
  tokens.set(scope, { token: body.access_token, expMs: Date.now() + (Number(body.expires_in) || 3600) * 1000 });
  return body.access_token;
}
