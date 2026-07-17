import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { getOne, query, nowIso } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { normalizePhone, sendOtp, validateOtp, messageCentralConfigured } from '../messageCentral.js';
import { adminClient, anonClient, supabaseConfigured } from '../supabaseAdmin.js';

// Rejects junk like "123@gmail.com" (digits-only local part) — requires a real-looking local
// part (at least one letter, 2+ characters) and a proper domain/TLD.
const EMAIL_RE = /^(?=[^\s@]*[a-zA-Z])[^\s@]{2,}@[^\s@]+\.[a-zA-Z]{2,}$/;
const MIN_NAME_LEN = 5;

// Merge `fromId` (phone-OTP account) into `intoId` (Google/email account).
// Transfers all data, then deletes the phone account from our DB and Supabase.
async function mergeAccounts(intoId, fromId) {
  // Reparent all user data
  await query('UPDATE orders       SET user_id = $1 WHERE user_id = $2', [intoId, fromId]);
  await query('UPDATE addresses    SET user_id = $1 WHERE user_id = $2', [intoId, fromId]);
  await query('UPDATE coupon_usage SET user_id = $1 WHERE user_id = $2', [intoId, fromId]);

  // Cart — merge items into the keeper's cart, or re-own the whole cart
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

  // Grab the synthetic email before deletion so we can remove from Supabase
  const fromUser = await getOne('SELECT email FROM users WHERE id = $1', [fromId]);
  await query('DELETE FROM users WHERE id = $1', [fromId]);

  // Best-effort: remove the now-orphaned Supabase auth record for the phone account
  if (fromUser && supabaseConfigured()) {
    try {
      const supaRow = await getOne("SELECT id FROM auth.users WHERE email = $1", [fromUser.email]).catch(() => null);
      if (supaRow) await adminClient().auth.admin.deleteUser(supaRow.id);
    } catch { /* non-critical */ }
  }
}

const router = Router();

// Per-IP limits on the OTP endpoints (each OTP costs money, and verify must resist brute force).
// These complement the per-phone cooldown/cap below.
const sendLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many OTP requests', message: 'Too many OTP requests from your network. Try again later.' },
});
const verifyLimiter = rateLimit({
  windowMs: 10 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts', message: 'Too many attempts. Please try again later.' },
});

// Most auth (Google + email/password) runs through Supabase on the client. This endpoint
// lets the frontend resolve the app role (CUSTOMER/ADMIN) + canonical name after login.
router.get('/me', requireAuth, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name, role: req.user.role, phone: req.user.phone ?? null });
});

// Update the signed-in user's profile. Phone-OTP users fill in their name here; Google /
// email users add a phone. Persists to our users table (authoritative for the app) and
// best-effort syncs the display name + phone into Supabase user_metadata.
router.patch('/me', requireAuth, async (req, res) => {
  const sets = [];
  const params = [];
  let i = 1;

  if (req.body?.name != null) {
    const name = String(req.body.name).trim();
    if (name.length < MIN_NAME_LEN) throw new ApiError(`Please enter your full name (at least ${MIN_NAME_LEN} characters).`);
    sets.push(`name = $${i++}`); params.push(name);
  }

  let normalizedPhone = null;
  if (req.body?.phone != null && String(req.body.phone).trim() !== '') {
    const p = normalizePhone(req.body.phone);
    if (!p) throw new ApiError('Enter a valid 10-digit mobile number.');
    normalizedPhone = p.digits;
    // If the phone belongs to another account (phone-OTP), merge that account into this one
    // instead of rejecting. The user can then log in either way.
    const taken = await getOne('SELECT * FROM users WHERE phone = $1 AND id <> $2', [normalizedPhone, req.user.id]);
    if (taken) {
      await mergeAccounts(req.user.id, taken.id);
      // Fall through — we still set the phone on the current account below.
    }
    sets.push(`phone = $${i++}`); params.push(normalizedPhone);
  }

  // Phone-OTP users can optionally add a real email as contact info. We only store it in our
  // users table (their Supabase login stays keyed on the synthetic address) — never fabricated.
  if (req.body?.email != null && String(req.body.email).trim() !== '') {
    const email = String(req.body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new ApiError('Enter a proper email address.');
    const taken = await getOne('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, req.user.id]);
    if (taken) throw new ApiError('That email is already linked to another account.');
    sets.push(`email = $${i++}`); params.push(email);
  }

  if (!sets.length) throw new ApiError('Nothing to update.');

  sets.push(`updated_at = $${i++}`); params.push(nowIso());
  params.push(req.user.id);
  const row = await getOne(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params);

  // Best-effort mirror into Supabase (never blocks the response). CRITICAL for phone-OTP users:
  // they have no real email, so looking up auth.users by req.user.email found nothing and the
  // name never synced — which made the client fall back to a generic name on the next load and
  // re-show the "add your name" prompt forever. Resolve their auth row by the synthetic phone
  // email (or the current email for email/Google users) so the name actually persists.
  try {
    if (supabaseConfigured()) {
      const meta = {};
      if (req.body?.name != null) meta.full_name = String(req.body.name).trim();
      if (normalizedPhone) meta.phone = normalizedPhone;
      const effectivePhone = normalizedPhone || row.phone;
      const lookupEmail = req.user.email || (effectivePhone ? `phone_${effectivePhone}@phone.adccookies.app` : null);
      const su = lookupEmail ? await getOne('SELECT id FROM auth.users WHERE email = $1', [lookupEmail]).catch(() => null) : null;
      if (su) await adminClient().auth.admin.updateUserById(su.id, { user_metadata: meta });
    }
  } catch { /* metadata sync is non-critical */ }

  res.json({ email: row.email, name: row.name, role: row.role, phone: row.phone ?? null });
});

// Best-effort city/region for wherever this login is coming from (IP-based — no browser
// permission prompt, so it never interrupts the login flow). The frontend calls this once per
// fresh login, not on every page load. Never throws: a lookup failure just leaves the column
// as it was.
router.post('/log-location', requireAuth, async (req, res) => {
  try {
    const ip = String(req.ip || '').replace(/^::ffff:/, '');
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const r = await fetch(`https://ipapi.co/${ip}/json/`);
      if (r.ok) {
        const j = await r.json();
        const location = [j.city, j.region, j.country_name].filter(Boolean).join(', ');
        if (location) await query('UPDATE users SET last_login_location = $1 WHERE id = $2', [location, req.user.id]);
      }
    }
  } catch { /* best-effort only */ }
  res.json({ ok: true });
});

/* ---------------- Phone OTP login (Message Central + Supabase) ----------------
 * Message Central owns the OTP lifecycle, so we drive it from the server and, on
 * success, create/confirm the user in Supabase and mint a real Supabase session.
 * That keeps Supabase as the single source of truth and the frontend session model
 * unchanged (it just calls supabase.auth.setSession with the tokens we return).
 */

// Per-phone guard so one number can't be spammed (and to cap SMS cost): a 30s cooldown
// between texts and at most 5 sends per rolling hour.
const otpHits = new Map(); // national number -> epoch ms[]
const RESEND_COOLDOWN_MS = 30_000;
const HOURLY_CAP = 5;
function phoneGate(national) {
  const now = Date.now();
  const recent = (otpHits.get(national) || []).filter((t) => now - t < 60 * 60_000);
  if (recent.length && now - recent[recent.length - 1] < RESEND_COOLDOWN_MS) {
    return 'Please wait a moment before requesting another OTP.';
  }
  if (recent.length >= HOURLY_CAP) {
    return 'Too many OTP requests for this number. Please try again later.';
  }
  recent.push(now);
  otpHits.set(national, recent);
  return null;
}

router.post('/otp/send', sendLimiter, async (req, res) => {
  if (!messageCentralConfigured()) throw new ApiError('Phone login is not configured yet.', 503);
  const phone = normalizePhone(req.body?.phone);
  if (!phone) throw new ApiError('Enter a valid 10-digit mobile number.');

  const blocked = phoneGate(phone.national);
  if (blocked) throw new ApiError(blocked, 429);

  const r = await sendOtp(phone.national);
  if (!r.ok) throw new ApiError(r.message, 502);
  res.json({ verificationId: r.verificationId, timeout: r.timeout });
});

router.post('/otp/verify', verifyLimiter, async (req, res) => {
  if (!messageCentralConfigured()) throw new ApiError('Phone login is not configured yet.', 503);
  if (!supabaseConfigured()) throw new ApiError('Phone login is not fully configured (Supabase admin missing).', 503);

  const { verificationId, code } = req.body || {};
  const name = String(req.body?.name || '').trim();
  const phone = normalizePhone(req.body?.phone);
  if (!verificationId || !code) throw new ApiError('verificationId and code are required.');
  if (!phone) throw new ApiError('Enter a valid 10-digit mobile number.');

  // 1) Confirm the code with Message Central.
  const v = await validateOtp(verificationId, code);
  if (!v.ok) throw new ApiError(v.message, 401);

  // 2) Create/confirm the user in Supabase and (re)set a one-time password we control.
  //    We key the Supabase login on a stable synthetic email so it works with the
  //    always-on Email provider (no Supabase Phone provider/SMS config needed), while
  //    still storing the real phone number on the record.
  const admin = adminClient();
  const email = `phone_${phone.digits}@phone.adccookies.app`;
  const password = crypto.randomBytes(24).toString('base64url');

  let supaUserId = null;
  let existingName = null;
  try {
    const row = await getOne(
      "SELECT id, raw_user_meta_data->>'full_name' AS full_name FROM auth.users WHERE email = $1 OR phone = $2",
      [email, phone.digits]
    );
    if (row) { supaUserId = row.id; existingName = row.full_name; }
  } catch { /* no access to the auth schema — fall back to create-then-recover below */ }
  // New number, or an existing account that never set a real name → the UI should ask for it.
  const needsName = supaUserId == null || !existingName || existingName === 'Guest';

  if (supaUserId) {
    const fields = { password, email_confirm: true, phone_confirm: true };
    if (name) fields.user_metadata = { phone: phone.digits, full_name: name };
    const { error } = await admin.auth.admin.updateUserById(supaUserId, fields);
    if (error) throw new ApiError(error.message, 502);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email, phone: phone.e164, password,
      email_confirm: true, phone_confirm: true,
      user_metadata: { phone: phone.digits, full_name: name || '' },
    });
    if (error) {
      // Most likely already exists — recover the id and reset the password.
      const row = await getOne('SELECT id FROM auth.users WHERE email = $1 OR phone = $2', [email, phone.digits]).catch(() => null);
      if (!row) throw new ApiError(error.message, 502);
      const upd = await admin.auth.admin.updateUserById(row.id, { password, email_confirm: true, phone_confirm: true });
      if (upd.error) throw new ApiError(upd.error.message, 502);
    }
  }

  // 3) Exchange the credentials for a real Supabase session and hand it to the client.
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data?.session) throw new ApiError(error?.message || 'Could not establish a session.', 502);

  res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    needsName,
  });
});

export default router;
