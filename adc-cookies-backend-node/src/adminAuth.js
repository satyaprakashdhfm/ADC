import crypto from 'crypto';
import { getOne, query, nowIso } from './db.js';

/*
 * Admin authentication, entirely separate from customer authentication.
 *
 * The dashboard used to be gated on users.role = 'ADMIN', which meant it sat behind the same login
 * as the storefront: an email/password or Google session could hold admin. It is now a phone
 * allowlist (admin_accounts) with its own OTP login and its own session token (admin_sessions).
 * A customer's Supabase token grants nothing here, and an admin token grants nothing on the
 * customer API — they travel in different headers and are validated by different code.
 *
 * The reason it is not simply "a phone claim on the Supabase token": user_metadata is writable by
 * the account holder, so any customer could set user_metadata.phone to an admin number and be
 * believed. Authorisation has to rest on something the client cannot author.
 *
 * Store staff are untouched. They have their own username/password portal (storeAuth.js) and are
 * deliberately NOT subject to the re-authentication window below — a counter cannot be logged out
 * mid-shift.
 */

/** How long an admin session lasts before a fresh OTP is required. */
export const ADMIN_SESSION_DAYS = 3;

const ADMIN_TOKEN_HEADER = 'x-admin-token';

/** Only the hash is stored, so a dump of admin_sessions cannot be replayed as a login. */
const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

/** 10 digits, no country code — the form every admin_accounts row is keyed on. */
export function normalizeAdminPhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return ten.length === 10 ? ten : null;
}

/**
 * Is this number allowed to open the dashboard at all?
 *
 * Consulted BEFORE an OTP is sent as well as after it is verified. Checking only on verify would
 * let anyone use our SMS credits to text any number they liked.
 */
export async function findAdminAccount(phone) {
  const ten = normalizeAdminPhone(phone);
  if (!ten) return null;
  const row = await getOne('SELECT phone, name, is_active FROM admin_accounts WHERE phone = $1', [ten]);
  return row && row.is_active ? row : null;
}

/**
 * Start a session for an already-OTP-verified admin phone. Returns the raw token, which is the only
 * time it exists outside the caller's response — the database keeps just its hash.
 */
export async function createAdminSession(phone, userAgent) {
  const ten = normalizeAdminPhone(phone);
  const raw = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = new Date(now + ADMIN_SESSION_DAYS * 24 * 3600_000).toISOString();
  await query(
    `INSERT INTO admin_sessions (token_hash, phone, created_at, expires_at, last_seen_at, user_agent)
     VALUES ($1,$2,$3,$4,$3,$5)`,
    [hashToken(raw), ten, new Date(now).toISOString(), expiresAt, String(userAgent || '').slice(0, 300)],
  );
  await query('UPDATE admin_accounts SET last_login_at = $1 WHERE phone = $2', [nowIso(), ten]);
  // Opportunistic cleanup: expired rows are dead weight and there is no scheduler here.
  await query('DELETE FROM admin_sessions WHERE expires_at < $1', [new Date(now).toISOString()]).catch(() => {});
  return { token: raw, expiresAt };
}

/** Sign this admin out of the session the token belongs to. Never errors on an unknown token. */
export async function revokeAdminSession(rawToken) {
  if (!rawToken) return;
  await query('DELETE FROM admin_sessions WHERE token_hash = $1', [hashToken(rawToken)]).catch(() => {});
}

export const readAdminToken = (req) => String(req.headers[ADMIN_TOKEN_HEADER] || '').trim();

/*
 * The gate for everything under /api/admin.
 *
 * Applied once, in routes/admin/index.js, so a new sub-router cannot ship unauthenticated.
 *
 * The failure codes are distinct on purpose: the dashboard has to tell "your three days are up,
 * sign in again" apart from "you are not an admin", and a single 403 cannot say which.
 */
export async function requireAdminSession(req, res, next) {
  const raw = readAdminToken(req);
  if (!raw) {
    return res.status(401).json({ error: 'Unauthorized', code: 'ADMIN_AUTH_REQUIRED', message: 'Admin sign-in required.' });
  }
  let row;
  try {
    row = await getOne(
      `SELECT s.token_hash, s.phone, s.expires_at, a.name, a.is_active
       FROM admin_sessions s JOIN admin_accounts a ON a.phone = s.phone
       WHERE s.token_hash = $1`,
      [hashToken(raw)],
    );
  } catch (e) {
    return next(e);
  }
  if (!row) {
    return res.status(401).json({ error: 'Unauthorized', code: 'ADMIN_AUTH_REQUIRED', message: 'Admin sign-in required.' });
  }
  if (!row.is_active) {
    // Revoked while signed in — drop the session rather than leaving it to expire on its own.
    await query('DELETE FROM admin_sessions WHERE phone = $1', [row.phone]).catch(() => {});
    return res.status(403).json({ error: 'Forbidden', code: 'ADMIN_REVOKED', message: 'This admin account is no longer active.' });
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await query('DELETE FROM admin_sessions WHERE token_hash = $1', [row.token_hash]).catch(() => {});
    return res.status(401).json({ error: 'Unauthorized', code: 'ADMIN_SESSION_EXPIRED', message: `Admin sessions last ${ADMIN_SESSION_DAYS} days. Please sign in again.` });
  }

  req.admin = { phone: row.phone, name: row.name, expiresAt: row.expires_at };
  // Best-effort activity stamp; never allowed to fail the request it is decorating.
  query('UPDATE admin_sessions SET last_seen_at = $1 WHERE token_hash = $2', [nowIso(), row.token_hash]).catch(() => {});
  next();
}
