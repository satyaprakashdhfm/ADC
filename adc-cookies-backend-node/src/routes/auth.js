import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { getOne } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { normalizePhone, sendOtp, validateOtp, messageCentralConfigured } from '../messageCentral.js';
import { adminClient, anonClient, supabaseConfigured } from '../supabaseAdmin.js';

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
  res.json({ email: req.user.email, name: req.user.name, role: req.user.role });
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
  try {
    const row = await getOne('SELECT id FROM auth.users WHERE email = $1 OR phone = $2', [email, phone.digits]);
    if (row) supaUserId = row.id;
  } catch { /* no access to the auth schema — fall back to create-then-recover below */ }

  if (supaUserId) {
    const { error } = await admin.auth.admin.updateUserById(supaUserId, { password, email_confirm: true, phone_confirm: true });
    if (error) throw new ApiError(error.message, 502);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email, phone: phone.e164, password,
      email_confirm: true, phone_confirm: true,
      user_metadata: { phone: phone.digits, full_name: 'Guest' },
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
  });
});

export default router;
