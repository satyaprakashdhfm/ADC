import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError } from '../middleware.js';
import { normalizePhone, sendOtp, validateOtp, messageCentralConfigured } from '../messageCentral.js';
import {
  findAdminAccount, createAdminSession, revokeAdminSession, readAdminToken,
  requireAdminSession, ADMIN_SESSION_DAYS,
} from '../adminAuth.js';

/*
 * Admin sign-in. Mounted at /api/admin-auth, deliberately OUTSIDE /api/admin — everything under
 * that prefix is behind requireAdminSession, and the login cannot require the session it issues.
 *
 * Phone OTP only. No password, no Google, no email: the dashboard can cancel orders and move money,
 * and the fewer ways in it has, the fewer there are to get wrong. It shares no code path with the
 * customer login in routes/auth.js beyond the SMS helper itself, and issues no Supabase session.
 */
const router = Router();

// Tighter than the customer limiter. This endpoint exists for one number, so anything approaching a
// normal rate is somebody probing it.
const otpLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts', message: 'Too many sign-in attempts. Try again in a few minutes.' },
});

/*
 * Step 1 — send a code, but only to a number on the allowlist.
 *
 * Two things this deliberately does NOT do. It does not say whether the number is an admin: the
 * reply is identical either way, so this cannot be used to discover who the admins are. And it does
 * not send to anything else, so it cannot be used to spend our SMS credit texting strangers.
 */
router.post('/otp/send', otpLimiter, async (req, res) => {
  if (!messageCentralConfigured()) throw new ApiError('Admin phone sign-in is not configured yet.', 503);
  const phone = normalizePhone(req.body?.phone);
  const generic = { sent: true, message: 'If that number is an admin, a code has been sent to it.' };
  if (!phone) throw new ApiError('Enter a valid 10-digit mobile number.');

  const account = await findAdminAccount(phone.national);
  if (!account) {
    console.warn(`[ADMIN-AUTH] OTP requested for a non-admin number (last 4: ${String(phone.national).slice(-4)})`);
    return res.json(generic);
  }

  const r = await sendOtp(phone.national);
  if (!r.ok) throw new ApiError(r.message, 502);
  res.json({ ...generic, verificationId: r.verificationId, timeout: r.timeout });
});

/*
 * Step 2 — confirm the code and open a session.
 *
 * The allowlist is checked again here, not just in step 1: the two calls are minutes apart and the
 * account can be switched off in between, and a client can call this one directly regardless.
 */
router.post('/otp/verify', otpLimiter, async (req, res) => {
  if (!messageCentralConfigured()) throw new ApiError('Admin phone sign-in is not configured yet.', 503);
  const { verificationId, code } = req.body || {};
  const phone = normalizePhone(req.body?.phone);
  if (!phone) throw new ApiError('Enter a valid 10-digit mobile number.');
  if (!verificationId || !code) throw new ApiError('verificationId and code are required.');

  const account = await findAdminAccount(phone.national);
  if (!account) throw new ApiError('That number is not an admin.', 403);

  const v = await validateOtp(verificationId, code);
  if (!v.ok) throw new ApiError(v.message, 401);

  const { token, expiresAt } = await createAdminSession(phone.national, req.headers['user-agent']);
  console.log(`[ADMIN-AUTH] signed in (last 4: ${String(phone.national).slice(-4)}), valid until ${expiresAt}`);
  res.json({ token, expiresAt, name: account.name, phone: account.phone, sessionDays: ADMIN_SESSION_DAYS });
});

/** Who is this token, and how long has it got? The dashboard calls this on load. */
router.get('/me', requireAdminSession, (req, res) => {
  res.json({ phone: req.admin.phone, name: req.admin.name, expiresAt: req.admin.expiresAt, sessionDays: ADMIN_SESSION_DAYS });
});

/** Sign out. Deletes the row, so the token is dead immediately rather than at its expiry. */
router.post('/logout', async (req, res) => {
  await revokeAdminSession(readAdminToken(req));
  res.json({ ok: true });
});

export default router;
