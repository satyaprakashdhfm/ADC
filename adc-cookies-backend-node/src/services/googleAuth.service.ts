import crypto from 'crypto';
import { getOne, query } from '../db/index.js';

/*
 * Google sign-in, done ourselves rather than through Supabase's OAuth proxy.
 *
 * The server-side "authorization code" flow: the browser is sent to Google, Google sends it back
 * to us with a short-lived code, and WE swap that code for tokens in a direct server-to-server
 * call authenticated with the client secret. The secret never reaches the browser, which is the
 * whole reason to do it this way round.
 *
 * Two protections span the round trip, both stored in oauth_states because the redirect out and
 * the redirect back are separate requests:
 *
 *   state          Proves the callback belongs to a sign-in we started. Omit it and an attacker
 *                  can hand a victim's browser a callback URL carrying the attacker's own code,
 *                  signing the victim into the attacker's account without either noticing. The
 *                  row is deleted when consumed, so a captured callback cannot be replayed.
 *   PKCE verifier  Guards the code itself. Optional for a confidential client, included anyway.
 *
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI. The redirect URI is explicit
 * rather than assembled from request headers, because Google compares it byte-for-byte with what
 * is registered and a mismatch surfaces only as `redirect_uri_mismatch` with no clue which side
 * is wrong.
 */

const CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = () => process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = () => process.env.GOOGLE_REDIRECT_URI || '';

export const googleConfigured = () => !!(CLIENT_ID() && CLIENT_SECRET() && REDIRECT_URI());

/** How long a half-finished sign-in stays valid. Long enough to pick an account, short enough
 *  that an abandoned attempt is not a lingering credential. */
const STATE_TTL_MS = 10 * 60_000;
/** The handoff code's life. Spent within a second or two in practice; a minute is slack for a
 *  slow render, not a window worth attacking. */
const HANDOFF_TTL_MS = 60_000;

const sha256 = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');
const b64url = (buf: Buffer) => buf.toString('base64url');

/*
 * Where to send the browser afterwards.
 *
 * Only a PATH is ever accepted, never a full URL, and this is not fussiness: echoing a
 * caller-supplied absolute URL into a redirect is an open redirect, and on a sign-in endpoint it
 * is a phishing primitive — a link that genuinely starts on our domain, authenticates, and then
 * lands the user on someone else's page. Rejecting anything that could change origin (a scheme,
 * a protocol-relative `//host`, a backslash Windows-style separator) leaves nothing to abuse.
 */
export function safeNextPath(input: unknown): string {
  const raw = String(input || '').trim();
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (/[\r\n]/.test(raw)) return '/';           // header-splitting belt and braces
  return raw;
}

/** Begin a sign-in: store the state and PKCE verifier, return the Google URL to send them to. */
export async function beginGoogleLogin(nextPath: string) {
  const state = b64url(crypto.randomBytes(32));
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const now = Date.now();

  await query(
    `INSERT INTO oauth_states (state, code_verifier, next_path, created_at, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [state, verifier, safeNextPath(nextPath), new Date(now).toISOString(),
     new Date(now + STATE_TTL_MS).toISOString()],
  );
  // No scheduler in this process, so sweep opportunistically. Never fails the login.
  await query('DELETE FROM oauth_states WHERE expires_at < $1', [new Date(now).toISOString()]).catch(() => {});

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID());
  url.searchParams.set('redirect_uri', REDIRECT_URI());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  /* select_account, not consent: returning users should not be re-asked for permission they have
     already given, but they should still be able to choose which Google account to use — the
     default silently reuses whichever one the browser is signed into, which is how people end up
     in the wrong account with no idea why. */
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/**
 * Consume a state value. Returns the stored verifier and next path, or null if the state is
 * unknown or expired.
 *
 * Deleted on read, so a state is single-use: a callback URL captured from a browser's history or
 * a proxy log cannot be replayed. The DELETE ... RETURNING makes that atomic, so two simultaneous
 * callbacks cannot both succeed.
 */
export async function consumeState(state: string) {
  if (!state) return null;
  const row = await getOne(
    'DELETE FROM oauth_states WHERE state = $1 RETURNING code_verifier, next_path, expires_at',
    [state],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return { verifier: row.code_verifier as string, nextPath: safeNextPath(row.next_path) };
}

export interface GoogleIdentity { sub: string; email: string; emailVerified: boolean; name: string }

/**
 * Swap the authorization code for tokens, and read the identity out of the ID token.
 *
 * The ID token's signature is deliberately NOT verified against Google's JWKS. That check exists
 * for tokens received from an untrusted party — one arriving in a browser redirect, say. This one
 * comes back in the body of a TLS request we made directly to Google's token endpoint, having
 * authenticated with our client secret, so the channel already establishes both who sent it and
 * that it was not tampered with. Google's own documentation says as much. `aud` is still checked,
 * because that costs nothing and catches the configuration mistake where a client id and secret
 * from two different projects get mixed.
 */
export async function exchangeCodeForIdentity(code: string, verifier: string): Promise<GoogleIdentity> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      redirect_uri: REDIRECT_URI(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body?.id_token) {
    /* Google's error bodies are terse but the only diagnostic there is, so pass the description
       through. invalid_grant here almost always means the code was already spent or has expired;
       redirect_uri_mismatch means GOOGLE_REDIRECT_URI and the console disagree by a character. */
    throw new Error(body?.error_description || body?.error || `Google token exchange failed (${res.status})`);
  }

  const parts = String(body.id_token).split('.');
  const payload = parts.length === 3 ? parts[1] : undefined;
  if (!payload) throw new Error('Google returned a malformed ID token.');
  let claims: any;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Google ID token payload could not be read.');
  }

  if (claims.aud !== CLIENT_ID()) throw new Error('Google ID token was issued for a different client.');

  const email = String(claims.email || '').toLowerCase();
  if (!email) throw new Error('Google did not return an email address.');

  return {
    sub: String(claims.sub || ''),
    email,
    /* Google sends this as a boolean or the string "true" depending on the flow, so compare
       loosely rather than trusting the type. The caller must refuse an unverified address: our
       accounts are keyed on email, so accepting one Google has not confirmed would let anyone
       who can assert an address take over the account already holding it. */
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: String(claims.name || '').trim(),
  };
}

/** Mint the single-use code that carries a finished sign-in back to the frontend. */
export async function createHandoff(userId: number) {
  const raw = b64url(crypto.randomBytes(32));
  const now = Date.now();
  await query(
    `INSERT INTO oauth_handoffs (code_hash, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)`,
    [sha256(raw), userId, new Date(now).toISOString(), new Date(now + HANDOFF_TTL_MS).toISOString()],
  );
  await query('DELETE FROM oauth_handoffs WHERE expires_at < $1', [new Date(now).toISOString()]).catch(() => {});
  return raw;
}

/**
 * Spend a handoff code and return the user id it named, or null.
 *
 * Deleted on read for the same reason states are: single-use, atomically, so the code sitting in
 * the browser's address bar is worthless the instant the page has used it.
 */
export async function consumeHandoff(rawCode: string): Promise<number | null> {
  if (!rawCode) return null;
  const row = await getOne(
    'DELETE FROM oauth_handoffs WHERE code_hash = $1 RETURNING user_id, expires_at',
    [sha256(rawCode)],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return Number(row.user_id);
}
