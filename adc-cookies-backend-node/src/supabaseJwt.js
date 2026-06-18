import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

/*
 * Verifies a Supabase access token regardless of how the project signs them:
 *   - HS256  (legacy shared secret)        -> JWT_SECRET
 *   - ES256 / RS256 (current asymmetric keys) -> the project's JWKS public key (matched by `kid`)
 *
 * Supabase moved new projects to asymmetric signing keys; the public keys are published at
 * <SUPABASE_URL>/auth/v1/.well-known/jwks.json. We cache them in memory and only refetch when
 * we encounter an unknown key id (with a short cooldown so bad tokens can't trigger a fetch storm).
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const HS_SECRET = process.env.JWT_SECRET || '';

let cache = { keys: new Map(), fetchedAt: 0 };

async function refreshJwks() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL is not set');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
  const body = await res.json();
  const keys = new Map();
  for (const jwk of body.keys || []) {
    try { keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' })); } catch { /* skip bad key */ }
  }
  cache = { keys, fetchedAt: Date.now() };
}

export async function verifySupabaseToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header) throw new Error('malformed token');
  const { alg, kid } = decoded.header;

  if (alg === 'HS256') {
    return jwt.verify(token, HS_SECRET, { algorithms: ['HS256'] });
  }

  if (!cache.keys.has(kid) && Date.now() - cache.fetchedAt > 60_000) {
    await refreshJwks().catch(() => { /* keep stale cache; verify will fail cleanly below */ });
  }
  const key = cache.keys.get(kid);
  if (!key) throw new Error('no matching JWKS key for token');
  return jwt.verify(token, key, { algorithms: ['ES256', 'RS256'] });
}
