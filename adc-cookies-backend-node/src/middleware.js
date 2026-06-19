import { verifySupabaseToken } from './supabaseJwt.js';
import { getOne, query, nowIso } from './db.js';
import { adminClient, supabaseConfigured } from './supabaseAdmin.js';

/*
 * Auth now runs on Supabase. The frontend sends the Supabase session access token as
 * "Authorization: Bearer <token>" — a JWT signed (HS256) with the project's JWT secret,
 * which we keep in JWT_SECRET. We verify it, mirror the identity into our own `users`
 * table (so orders/addresses/admin keep working), and read the app role from there.
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

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
    const isAdmin = ADMIN_EMAILS.includes(email);
    let user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) {
      const ts = nowIso();
      // `password` is NOT NULL but unused for Supabase logins — store a placeholder.
      user = await getOne(
        `INSERT INTO users (name, email, phone, password, role, created_at, updated_at)
         VALUES ($1,$2,$3,'supabase-auth',$4,$5,$5)
         ON CONFLICT (email) DO UPDATE SET updated_at = $5 RETURNING *`,
        [name || email.split('@')[0], email, phone || null, isAdmin ? 'ADMIN' : 'CUSTOMER', ts]
      );
    } else if (isAdmin && user.role !== 'ADMIN') {
      user = await getOne('UPDATE users SET role = $2, updated_at = $3 WHERE email = $1 RETURNING *', [email, 'ADMIN', nowIso()]);
    }

    // If this Google/email user has a phone number in their token metadata, and there's a
    // separate phone-OTP account for that number, silently absorb it so the person has one account.
    if (phone && !user.phone) {
      const phoneAcct = await getOne('SELECT * FROM users WHERE phone = $1 AND id <> $2', [phone, user.id]);
      if (phoneAcct) {
        await absorbAccount(user.id, phoneAcct.id);
        user = await getOne('UPDATE users SET phone = $1, updated_at = $2 WHERE id = $3 RETURNING *', [phone, nowIso(), user.id]);
      }
    }

    return user;
  }
  // Phone identity — keyed by phone, with a synthetic email so the rest of the app
  // (which looks users up by email) keeps working unchanged.
  if (phone) {
    let user = await getOne('SELECT * FROM users WHERE phone = $1', [phone]);
    if (!user) {
      const ts = nowIso();
      const synthetic = `phone_${phone}@phone.adccookies.app`;
      user = await getOne(
        `INSERT INTO users (name, email, phone, password, role, created_at, updated_at)
         VALUES ($1,$2,$3,'otp-auth','CUSTOMER',$4,$4)
         ON CONFLICT (phone) DO UPDATE SET updated_at = $4 RETURNING *`,
        [name || 'Guest', synthetic, phone, ts]
      );
    }
    return user;
  }
  return null;
}

// Reads the Supabase token (if any), verifies it, syncs the user, attaches req.user.
// Always calls next() — an invalid/missing token simply leaves req.user undefined.
export async function parseAuth(req, _res, next) {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = await verifySupabaseToken(header.substring(7));
      const meta = payload.user_metadata || {};
      const email = String(payload.email || meta.email || '').toLowerCase();
      const phone = String(payload.phone || meta.phone || '').replace(/\D/g, '');
      if (email || phone) {
        const name = meta.full_name || meta.name || (email ? email.split('@')[0] : 'Guest');
        const user = await syncUser({ email, phone, name });
        if (user) req.user = { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone };
      }
    } catch { /* invalid/expired token — treat as anonymous */ }
  }
  next();
}

// Equivalent to Spring's anyRequest().authenticated()
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  next();
}

// Equivalent to .requestMatchers("/api/admin/**").hasRole("ADMIN")
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  next();
}

// Lets services throw new ApiError(msg) to produce a 400, like Spring's RuntimeException handler.
export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
