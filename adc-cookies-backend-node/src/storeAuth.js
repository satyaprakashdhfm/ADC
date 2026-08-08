import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { getOne, getAll, query, nowIso } from './db.js';
import { ADC_STORES, storeByCode } from './stores.js';

/*
 * Authentication for STORE STAFF — the people working a counter, not customers and not admins.
 *
 * Deliberately its own scheme rather than another Supabase role. Staff share a shop terminal, turn
 * over often, and must never be able to reach /admin or a customer's account; giving them a
 * Supabase identity would put them one role edit away from all of it. A store login proves one
 * thing only: "this session may act for this store", and every /api/store route re-checks the store
 * on the token against the store on the row it is about to touch.
 *
 * THE SIGNING KEY IS DERIVED, NOT SHARED. Signing with JWT_SECRET itself would be a real hole:
 * verifySupabaseToken() accepts any HS256 token signed with that secret, so a store token would be
 * a valid customer token. HKDF with a distinct label produces a key that cannot verify there.
 */

const TOKEN_TTL_SECONDS = 12 * 60 * 60;  // a shift, not a week — shared terminals get left logged in
const ISSUER = 'adc-store-portal';

function signingKey() {
  const explicit = (process.env.STORE_JWT_SECRET || '').trim();
  if (explicit) return explicit;
  const base = process.env.JWT_SECRET || '';
  if (!base) return '';
  // Derived so it is cryptographically unrelated to the Supabase secret it comes from.
  return crypto.hkdfSync('sha256', Buffer.from(base), Buffer.alloc(0), Buffer.from(ISSUER), 32);
}

export const storeAuthConfigured = () => !!signingKey();

export function signStoreToken(user) {
  return jwt.sign(
    { sub: String(user.id), store: user.store_code, username: user.username, kind: 'store' },
    signingKey(),
    { algorithm: 'HS256', issuer: ISSUER, audience: ISSUER, expiresIn: TOKEN_TTL_SECONDS }
  );
}

function verifyStoreToken(token) {
  const payload = jwt.verify(token, signingKey(), { algorithms: ['HS256'], issuer: ISSUER, audience: ISSUER });
  if (payload.kind !== 'store') throw new Error('not a store token');
  return payload;
}

export const hashPassword = (plain) => bcrypt.hash(String(plain), 10);
export const checkPassword = (plain, hash) => bcrypt.compare(String(plain), String(hash || ''));

/**
 * The password a freshly created account is handed. Deterministic on purpose: a hash cannot be read
 * back, so without this the admin screen could never tell anyone what to type on day one. It stops
 * being the answer the moment the account is used — see `password_set_at` / `last_login_at`.
 */
export const defaultPasswordFor = (code) => `${code}@adc2026`;

/**
 * Give every store one account if it has none. Runs at boot and is idempotent: an existing account
 * is never touched, so a password someone changed cannot be reset by a redeploy.
 */
export async function ensureStoreAccounts() {
  const existing = await getAll('SELECT store_code FROM store_users').catch(() => null);
  if (!existing) return;                                  // table not migrated yet — next boot will
  const have = new Set(existing.map((r) => r.store_code));
  for (const store of ADC_STORES) {
    if (have.has(store.code)) continue;
    const ts = nowIso();
    await query(
      `INSERT INTO store_users (store_code, username, password_hash, name, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT (username) DO NOTHING`,
      [store.code, store.code, await hashPassword(defaultPasswordFor(store.code)), store.name, ts]
    );
    console.log(`[STORE] created staff login "${store.code}" for ${store.name} (starting password shown in Admin → Stores)`);
  }
}

/**
 * Gate for /api/store. Attaches req.storeUser = { id, storeCode, username, store }.
 *
 * `store` is the record from stores.js, not the token — the token carries a code, and everything
 * that matters (pickup nickname, coordinates, whether we relay to Petpooja) is read from code.
 */
export async function requireStoreUser(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Sign in to your store account' });
  }
  if (!storeAuthConfigured()) {
    return res.status(503).json({ error: 'Not configured', message: 'Store logins are not configured on this environment (JWT_SECRET missing)' });
  }
  let payload;
  try {
    payload = verifyStoreToken(header.slice(7));
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Your session has expired — sign in again' });
  }
  // Re-read the row every request: a deactivated account must stop working immediately, not when
  // its 12-hour token happens to expire.
  const user = await getOne('SELECT * FROM store_users WHERE id = $1', [Number(payload.sub)]);
  if (!user || !user.is_active) {
    return res.status(403).json({ error: 'Forbidden', message: 'This store account is no longer active' });
  }
  const store = storeByCode(user.store_code);
  if (!store) {
    return res.status(403).json({ error: 'Forbidden', message: `Store "${user.store_code}" no longer exists` });
  }
  req.storeUser = { id: user.id, storeCode: user.store_code, username: user.username, name: user.name, store };
  next();
}
