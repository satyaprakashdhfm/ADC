import { verifySupabaseToken } from '../services/auth.service.js';
import { getOne, query, nowIso } from '../db/index.js';
import { adminClient, supabaseConfigured } from '../config/supabase.js';
import { normalizePhone } from '../services/messageCentral.client.js';
import { looksLikeJwt, resolveUserSession, touchSession } from '../services/userAuth.service.js';

/*
 * Auth now runs on Supabase. The frontend sends the Supabase session access token as
 * "Authorization: Bearer <token>" — a JWT signed (HS256) with the project's JWT secret,
 * which we keep in JWT_SECRET. We verify it, mirror the identity into our own `users`
 * table (so orders/addresses/admin keep working), and read the app role from there.
 *
 * ADMIN IS GRANTED IN THE DATABASE, NOWHERE ELSE.
 *
 * There used to be ADMIN_EMAILS and ADMIN_PHONES allowlists that promoted anyone who logged in with
 * a matching address or number. Two problems with that: the answer to "who can administer this
 * shop" lived in an env var on each deploy rather than with the data, so it could differ per
 * environment and nothing in the app could show it; and promotion happened automatically on login,
 * so anyone who obtained that mailbox or SIM became an admin without a deliberate act by anyone.
 *
 * Every account is now created as CUSTOMER. To grant admin, set it on the row by hand:
 *
 *   UPDATE users SET role = 'ADMIN' WHERE email = 'someone@example.com';
 *
 * Nothing in the code path can raise a role, so an accidental deploy or a stray env var cannot
 * hand out access.
 */

// Supabase creates phone-OTP accounts under a synthetic email (so the always-on Email provider
// works without SMS config). We must never mirror that fake address into our users table.
const SYNTHETIC_EMAIL = /^phone_\d+@phone\.adccookies\.app$/i;

// Transfer all data from `fromId` into `intoId` and delete the `from` account.
// Used when two accounts (Google + phone-OTP) are identified as the same person.
async function absorbAccount(intoId, fromId) {
  await query('UPDATE orders       SET user_id = $1 WHERE user_id = $2', [intoId, fromId]);
  await query('UPDATE addresses    SET user_id = $1 WHERE user_id = $2', [intoId, fromId]);
  await query('UPDATE coupon_usage SET user_id = $1 WHERE user_id = $2', [intoId, fromId]);
  const keepCart = await getOne('SELECT id FROM cart WHERE user_id = $1', [intoId]);
  const fromCart = await getOne('SELECT id FROM cart WHERE user_id = $1', [fromId]);
  if (fromCart) {
    if (keepCart) {
      await query('UPDATE cart_items SET cart_id = $1 WHERE cart_id = $2', [keepCart.id, fromCart.id]);
      await query('DELETE FROM cart WHERE id = $1', [fromCart.id]);
    } else {
      await query('UPDATE cart SET user_id = $1 WHERE id = $2', [intoId, fromCart.id]);
    }
  }
  /* Take the auth id off the row before deleting it, so the now-orphaned Supabase account can
     still be removed afterwards. This used to re-find it with `SELECT id FROM auth.users WHERE
     email = ...`, which worked only while our tables and Supabase's managed auth schema shared
     one database — and it could not find a phone-OTP account by anything but the synthetic
     address we mint for it. */
  const fromUser = await getOne('SELECT supabase_user_id FROM users WHERE id = $1', [fromId]);
  await query('DELETE FROM users WHERE id = $1', [fromId]);
  if (fromUser?.supabase_user_id && supabaseConfigured()) {
    try {
      await adminClient().auth.admin.deleteUser(fromUser.supabase_user_id);
    } catch { /* non-critical */ }
  }
}

/*
 * A per-account identifier the client can key local state on — CartContext clears the basket when
 * it changes, and the Chatbot resets its thread.
 *
 * It has to stay STABLE across retiring Supabase Auth, which is the whole reason it is computed
 * here rather than read off a session. The frontend used session.user.id, the Supabase uuid, and
 * once our own sessions carry the login there is no Supabase session to read it from. Returning
 * users.supabase_user_id keeps that exact uuid for the 77 accounts the backfill linked, so nothing
 * on the client notices the change and nobody's cart is emptied by the migration.
 *
 * The 'local:' prefix is for accounts that never had a Supabase identity -- new sign-ups after the
 * cutover, and the imported contacts. Prefixed so the two kinds can never collide, and so a value
 * in a log says immediately which era it came from.
 */
const stableAuthId = (row: any) => row?.supabase_user_id || `local:${row?.id}`;

/*
 * Record which Supabase account this row belongs to, the first time we see it.
 *
 * The id is `claims.sub` off a token that has already been verified, which makes it a far better
 * source than the email string match this replaces: it is not writable by the caller, it does not
 * change when somebody edits their email address, and a phone-login user has one without us
 * having to reconstruct a synthetic address to go looking for it.
 *
 * Written once and then left alone. An existing value is never overwritten — that would let a
 * second Supabase account quietly take over a row that already belongs to another — so the WHERE
 * clause makes this a no-op on every request after the first.
 *
 * Failure is deliberately silent. Nothing in the request depends on the link being recorded; the
 * worst case is that a cosmetic metadata mirror is skipped and the next request tries again.
 */
async function linkAuthId(user, authId) {
  if (!user || user.supabase_user_id) return user;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(authId || ''))) return user;
  const row = await getOne(
    `UPDATE users SET supabase_user_id = $1
      WHERE id = $2 AND supabase_user_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM users x WHERE x.supabase_user_id = $1)
      RETURNING *`,
    [authId, user.id]
  ).catch(() => null);
  return row || user;
}

/*
 * Find-or-create the local user row for a proven identity — an email (Google) or a phone (OTP).
 *
 * Exported so the OTP route can call it directly rather than repeating the insert. It needs a
 * users.id to hang a session on, and a number logging in for the first time has no row yet. The
 * duplicated absorbAccount was the lesson here: two copies of identity logic drift, and the copy
 * nobody remembers is the one that keeps the bug.
 */
export async function syncUser({ email, phone, name, authId }: {
  email?: string; phone?: string; name?: string; authId?: string | null;
}) {
  // Email identity — keyed by email.
  if (email) {
    let user = await getOne('SELECT * FROM users WHERE email = $1', [email]);

    /*
     * Who already holds this number, asked BEFORE the insert rather than after it.
     *
     * users.phone is UNIQUE. A row can already exist under a verified number — a phone-OTP
     * account, or a customer seeded from the contact list kept before the site existed — and the
     * insert below would then raise a constraint violation, which parseAuth catches as a rejected
     * token. The customer would be signed in as far as Supabase is concerned and anonymous to us,
     * on every request, with nothing on screen to explain it.
     */
    const phoneAcct = phone ? await getOne('SELECT * FROM users WHERE phone = $1', [phone]) : null;

    if (!user) {
      const ts = nowIso();
      if (phoneAcct) {
        /* The same person, arriving by email for the first time: their row already exists under
           the number they verified. Claim it rather than opening a second one, so the orders and
           addresses already sitting on it stay theirs. A blank name does not overwrite a real one. */
        user = await getOne(
          `UPDATE users SET email = $1, name = COALESCE(NULLIF($2, ''), name), updated_at = $3
           WHERE id = $4 RETURNING *`,
          [email, name || '', ts, phoneAcct.id]
        );
      } else {
        // `password` is NOT NULL but unused for Supabase logins — store a placeholder.
        user = await getOne(
          `INSERT INTO users (name, email, phone, password, role, created_at, updated_at)
           VALUES ($1,$2,$3,'supabase-auth',$4,$5,$5)
           ON CONFLICT (email) DO UPDATE SET updated_at = $5 RETURNING *`,
          [name || email.split('@')[0], email, phone || null, 'CUSTOMER', ts]
        );
      }
    } else if (phone && !user.phone) {
      /* Known by email, and now carrying a verified number they had not given us. If a separate
         account already holds it, the two are one person — fold it in before taking the number,
         or the UPDATE hits the same UNIQUE constraint. */
      if (phoneAcct && phoneAcct.id !== user.id) await absorbAccount(user.id, phoneAcct.id);
      user = await getOne(
        'UPDATE users SET phone = $1, updated_at = $2 WHERE id = $3 RETURNING *',
        [phone, nowIso(), user.id]
      );
    }

    return linkAuthId(user, authId);
  }
  // Phone identity — keyed by phone. Email stays NULL: phone users have no email unless they
  // choose to add a real one later.
  if (phone) {
    let user = await getOne('SELECT * FROM users WHERE phone = $1', [phone]);
    if (!user) {
      const ts = nowIso();
      user = await getOne(
        `INSERT INTO users (name, email, phone, password, role, created_at, updated_at)
         VALUES ($1, NULL, $2, 'otp-auth', $3, $4, $4)
         ON CONFLICT (phone) DO UPDATE SET updated_at = $4 RETURNING *`,
        [name || '', phone, 'CUSTOMER', ts]
      );
    }
    return linkAuthId(user, authId);
  }
  return null;
}

/*
 * Why a bearer token did not become a req.user. Anonymous is a legitimate outcome here (plenty of
 * routes allow it), so this is a warning and never throws — but it has to be visible, because the
 * alternative is a 401 whose cause cannot be told apart from any other 401.
 * Never logs the token; the method and path are enough to correlate with the request.
 */
const authLog = (req, why) => console.warn(`[AUTH] ${req.method} ${req.originalUrl || req.url} — ${why}`);

// Reads the Supabase token (if any), verifies it, syncs the user, attaches req.user.
// Always calls next() — an invalid/missing token simply leaves req.user undefined.
export async function parseAuth(req, _res, next) {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    const bearer = header.substring(7).trim();

    /*
     * Our own session token, if that is what arrived.
     *
     * Both kinds ride in this one header so the frontend needs no second code path and so both
     * work at once while Supabase Auth is being retired — a customer holding either is signed in.
     * Anything that is not shaped like a JWT is treated as ours and looked up; an unknown value
     * simply resolves to nothing and the request continues anonymous, exactly as a bad JWT does.
     *
     * No syncUser here, unlike the Supabase branch below. A session row already names a real
     * users.id, so there is no identity to reconcile — which is the point of owning the session.
     */
    if (bearer && !looksLikeJwt(bearer)) {
      try {
        const row = await resolveUserSession(bearer);
        if (row) {
          req.user = { id: row.id, email: row.email, name: row.name, role: row.role, phone: row.phone, authId: stableAuthId(row) };
          touchSession(row.token_hash);
        } else {
          authLog(req, 'session token not found or expired');
        }
      } catch (e: any) {
        authLog(req, `session lookup failed: ${e.message}`);
      }
      return next();
    }

    try {
      const payload = await verifySupabaseToken(bearer);
      /* verifySupabaseToken can hand back a bare string for a non-JSON payload; only an
         object carries the claims we read. */
      const claims: any = typeof payload === 'object' && payload ? payload : {};
      const meta = claims.user_metadata || {};
      const rawEmail = String(claims.email || meta.email || '').toLowerCase();
      /*
       * claims.phone ONLY, and normalized — two fixes to one line, for two different reasons.
       *
       * NOT user_metadata.phone. That field is writable by the account holder (supabase.auth
       * .updateUser from the browser), which is the documented reason the admin gate refuses to
       * trust a phone claim — see initSchema.ts and adminAuth.service.ts. syncUser below does not
       * merely read this value: it resolves WHICH ACCOUNT the caller is and, on a match, absorbs
       * the other one. Sourcing that from a field the caller can write meant anybody could sign up
       * with their own email, set user_metadata.phone to somebody else's number, and have that
       * person's orders and saved addresses transferred onto their account. claims.phone is set by
       * Supabase from auth.users.phone, which only our OTP flow writes after Message Central has
       * confirmed the code, so it is the one form of this number the caller cannot author.
       *
       * The sign-up form's number is not lost: AuthContext.register now sends it to PATCH /me,
       * which validates it, and ProfileGate asks again if that did not land.
       *
       * Normalized because users.phone is the join key an OTP login is resolved by and it holds
       * 91XXXXXXXXXX. A bare digit-strip stored whatever shape the value arrived in, so one number
       * had two spellings and the ten-digit one matched no login and no merge ever again.
       */
      const claimed = claims.phone || '';
      const phone = normalizePhone(claimed)?.digits || '';
      if (claimed && !phone) authLog(req, `ignoring unusable phone claim (${String(claimed).replace(/\d/g, 'x')})`);
      // A synthetic phone-login email is NOT a real email — drop it so the phone branch handles it.
      const email = SYNTHETIC_EMAIL.test(rawEmail) ? '' : rawEmail;
      if (email || phone) {
        const name = meta.full_name || meta.name || (email ? email.split('@')[0] : '');
        const user = await syncUser({ email, phone, name, authId: claims.sub });
        if (user) req.user = { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone, authId: stableAuthId(user) };
        else authLog(req, 'syncUser returned no row');
      } else {
        // Verified, but carries no identity we can key on. Happens when a phone-login token has
        // only its synthetic email and no phone claim — the account then silently cannot act.
        authLog(req, `token has no usable identity (email=${rawEmail ? 'synthetic' : 'none'}, phone=none)`);
      }
    } catch (e: any) {
      // Still anonymous — but say WHY. This was a bare `catch {}`, which made an expired token, a
      // Supabase project mismatch and a database failure all look identical from outside: a bald
      // 401 "Authentication required" with nothing to diagnose from. The token itself is never
      // logged; only the reason it was rejected.
      authLog(req, `token rejected: ${e.message}`);
    }
  }
  next();
}

// Equivalent to Spring's anyRequest().authenticated()
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  next();
}

/* requireAdmin used to live here and gated /api/admin on users.role === 'ADMIN'. It is gone on
   purpose rather than left unused: it looks like the admin gate, and anything importing it would be
   protecting the dashboard with a customer session again. The real gate is requireAdminSession in
   adminAuth.js, which is keyed on an allowlisted phone and its own OTP session. */
