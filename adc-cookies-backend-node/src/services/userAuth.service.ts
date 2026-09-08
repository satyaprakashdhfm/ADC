import crypto from 'crypto';
import { getOne, query, nowIso } from '../db/index.js';

/*
 * Customer sessions, issued and validated by us instead of by Supabase Auth.
 *
 * Modelled directly on adminAuth.service.ts, which has been doing this for the dashboard for
 * months. That is the point: the safest auth code here is the auth code already in production, so
 * this deliberately copies its shape rather than inventing a second one.
 *
 * WHY NOT A JWT. The obvious move when replacing Supabase Auth is to mint our own JWTs -- we
 * already verify theirs with JWT_SECRET, so signing is the easy half. It is also the wrong half.
 * A self-contained token cannot be withdrawn: "sign this person out everywhere", "this account was
 * absorbed into another", "this session was stolen" all become a blocklist you have to build,
 * store and consult on every request -- which is a sessions table with extra steps. An opaque
 * token backed by a row gives revocation for free, and skips refresh tokens entirely: there is
 * nothing to refresh when the server decides validity on each request.
 *
 * The token is random, never a hash of anything guessable, and only its SHA-256 is stored. A leak
 * of user_sessions therefore hands over no logins.
 */

/** Inactivity window. Sliding, not absolute — see touchSession. */
export const USER_SESSION_DAYS = Number(process.env.USER_SESSION_DAYS || 60);

/** Only the hash is stored, so a dump of user_sessions cannot be replayed as a login. */
const hashToken = (raw: unknown) => crypto.createHash('sha256').update(String(raw)).digest('hex');

/*
 * Ours or Supabase's?
 *
 * Both travel in `Authorization: Bearer`, which keeps the frontend from needing a second header
 * and lets both work at once while the migration is half done. They are told apart by shape: a
 * JWT is three base64url segments separated by dots, and base64url has no '.' in its alphabet, so
 * a token we minted can never contain one. Checked for exactly two dots rather than "contains a
 * dot" so a malformed value falls to the session lookup and fails closed there.
 */
export const looksLikeJwt = (raw: string) => String(raw).split('.').length === 3;

/**
 * Start a session for an identity that has ALREADY been proven — a verified OTP, or a completed
 * OAuth exchange. This function does not authenticate anything; calling it is the act of trusting
 * whatever did.
 *
 * Returns the raw token, which exists outside the caller's response exactly once: the database
 * keeps only its hash, so it cannot be recovered or re-sent later.
 */
export async function createUserSession(userId: number, userAgent?: unknown) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = new Date(now + USER_SESSION_DAYS * 24 * 3600_000).toISOString();
  await query(
    `INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at, last_seen_at, user_agent)
     VALUES ($1,$2,$3,$4,$3,$5)`,
    [hashToken(raw), userId, new Date(now).toISOString(), expiresAt, String(userAgent || '').slice(0, 300)],
  );
  /* Opportunistic cleanup: there is no scheduler in this process, and expired rows are dead
     weight that would otherwise accumulate forever. Never allowed to fail the login it follows. */
  await query('DELETE FROM user_sessions WHERE expires_at < $1', [new Date(now).toISOString()]).catch(() => {});
  return { token: raw, expiresAt };
}

/**
 * The user this token belongs to, or null.
 *
 * Returns the whole users row because parseAuth needs name, role and phone from it anyway, and a
 * second query to fetch them would double the cost of every authenticated request.
 *
 * An expired row is deleted rather than merely rejected — it will never be valid again, and
 * leaving it means checking it again on every retry.
 */
export async function resolveUserSession(rawToken: string) {
  if (!rawToken) return null;
  const row = await getOne(
    `SELECT s.token_hash, s.expires_at, u.*
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1`,
    [hashToken(rawToken)],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await query('DELETE FROM user_sessions WHERE token_hash = $1', [row.token_hash]).catch(() => {});
    return null;
  }
  return row;
}

/**
 * Stamp activity and slide the expiry forward.
 *
 * Both in one write, because the sliding window is the whole reason the stamp exists. Without the
 * slide, USER_SESSION_DAYS would mean "signed out on this date regardless", and a customer who
 * orders every fortnight would be sent back through an OTP for no reason other than a clock.
 *
 * Fire-and-forget: this decorates a request that has already been authorised, and a failed
 * housekeeping write must never turn a good request into an error.
 */
export function touchSession(tokenHash: string) {
  const next = new Date(Date.now() + USER_SESSION_DAYS * 24 * 3600_000).toISOString();
  query(
    'UPDATE user_sessions SET last_seen_at = $1, expires_at = $2 WHERE token_hash = $3',
    [nowIso(), next, tokenHash],
  ).catch(() => {});
}

/** Sign out of the session this token belongs to. Never errors on an unknown or absent token. */
export async function revokeUserSession(rawToken: string) {
  if (!rawToken) return;
  await query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(rawToken)]).catch(() => {});
}

/**
 * Sign out of every session for one account.
 *
 * Wanted in two places beyond a "log out everywhere" button: when two accounts are found to be
 * the same person and one is absorbed, and if an account ever has to be locked. The CASCADE on
 * user_sessions.user_id already covers the absorb case, so this is for the times the row survives.
 */
export async function revokeAllUserSessions(userId: number) {
  await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]).catch(() => {});
}
