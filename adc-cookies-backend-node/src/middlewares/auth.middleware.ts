import { verifySupabaseToken } from '../services/auth.service.js';
import { getOne, query, nowIso } from '../db/index.js';
import { adminClient, supabaseConfigured } from '../config/supabase.js';

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
  const fromUser = await getOne('SELECT email FROM users WHERE id = $1', [fromId]);
  await query('DELETE FROM users WHERE id = $1', [fromId]);
  if (fromUser && supabaseConfigured()) {
    try {
      const supaRow = await getOne('SELECT id FROM auth.users WHERE email = $1', [fromUser.email]).catch(() => null);
      if (supaRow) await adminClient().auth.admin.deleteUser(supaRow.id);
    } catch { /* non-critical */ }
  }
}

// Find-or-create the local user row for a Supabase-authenticated identity. The identity is
// either an email (Google / email-password) or a phone (phone-OTP login).
async function syncUser({ email, phone, name }) {
  // Email identity — keyed by email.
  if (email) {
    let user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) {
      const ts = nowIso();
      // `password` is NOT NULL but unused for Supabase logins — store a placeholder.
      user = await getOne(
        `INSERT INTO users (name, email, phone, password, role, created_at, updated_at)
         VALUES ($1,$2,$3,'supabase-auth',$4,$5,$5)
         ON CONFLICT (email) DO UPDATE SET updated_at = $5 RETURNING *`,
        [name || email.split('@')[0], email, phone || null, 'CUSTOMER', ts]
      );
    }

    /* INSERT ... RETURNING * above always yields a row, so user is non-null from here. Asserted
       rather than restructured: a thrown guard would change the error a caller sees. */
    // If this Google/email user has a phone number in their token metadata, and there's a
    // separate phone-OTP account for that number, silently absorb it so the person has one account.
    if (phone && !user!.phone) {
      const phoneAcct = await getOne('SELECT * FROM users WHERE phone = $1 AND id <> $2', [phone, user!.id]);
      if (phoneAcct) {
        await absorbAccount(user!.id, phoneAcct.id);
        user = await getOne('UPDATE users SET phone = $1, updated_at = $2 WHERE id = $3 RETURNING *', [phone, nowIso(), user!.id]);
      }
    }

    return user;
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
    return user;
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
    try {
      const payload = await verifySupabaseToken(header.substring(7));
      /* verifySupabaseToken can hand back a bare string for a non-JSON payload; only an
         object carries the claims we read. */
      const claims: any = typeof payload === 'object' && payload ? payload : {};
      const meta = claims.user_metadata || {};
      const rawEmail = String(claims.email || meta.email || '').toLowerCase();
      const phone = String(claims.phone || meta.phone || '').replace(/\D/g, '');
      // A synthetic phone-login email is NOT a real email — drop it so the phone branch handles it.
      const email = SYNTHETIC_EMAIL.test(rawEmail) ? '' : rawEmail;
      if (email || phone) {
        const name = meta.full_name || meta.name || (email ? email.split('@')[0] : '');
        const user = await syncUser({ email, phone, name });
        if (user) req.user = { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone };
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
