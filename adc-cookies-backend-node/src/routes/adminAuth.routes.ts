/*
 * req.user / req.storeUser / req.admin are asserted non-null in the handlers below.
 *
 * Every route that reads them carries a require* gate in its own registration, which 401s
 * before the handler runs — verified route by route, not assumed. TypeScript cannot see
 * through middleware, so it has to be told. A NEW route here that reads them without that
 * gate would make the assertion false, and would be a 500 on an anonymous request.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';
import { normalizePhone, sendOtp, validateOtp, messageCentralConfigured } from '../services/messageCentral.client.js';
import {
  findAdminAccount, createAdminSession, revokeAdminSession, readAdminToken,
  requireAdminSession, ADMIN_SESSION_DAYS,
} from '../services/adminAuth.service.js';

/*
 * Admin sign-in. Mounted at /api/admin-auth, deliberately OUTSIDE /api/admin — everything under
 * that prefix is behind requireAdminSession, and the login cannot require the session it issues.
 *
 * Phone OTP only. No password, no Google, no email: the dashboard can cancel orders and move money,
 * and the fewer ways in it has, the fewer there are to get wrong. It shares no code path with the
 * customer login in routes/auth.js beyond the SMS helper itself, and issues no Supabase session.
 */
const router = Router();

/*
 * Tighter than the customer limiter. This endpoint exists for a handful of numbers, so anything
 * approaching a normal rate is somebody probing it.
 *
 * It carries more weight now than it used to. /otp/send says plainly when a number is not an admin
 * (see below), so this limiter is the only thing left making it expensive to discover which numbers
 * are — eight tries per ten minutes per IP against a ten-digit space.
 */
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
 * A number that is not an admin is refused, and told so. This used to answer "if that number is an
 * admin, a code has been sent to it" whatever was typed, so that the endpoint could not be used to
 * work out who the admins are. That protection cost more than it bought: an admin who mistyped their
 * own number was told a code was on its way and then waited for a text that was never sent, with
 * nothing on screen to suggest they had got it wrong. Being told plainly is the whole point of a
 * sign-in screen.
 *
 * What is given up, stated honestly: somebody probing this can now learn which numbers are admins.
 * That alone grants nothing — the code still goes to the physical phone, and /otp/verify checks the
 * allowlist again — but it does make an admin's number discoverable, which is worth knowing if this
 * is ever revisited. The rate limiter above is what keeps that expensive.
 *
 * Still true, and the more important half: a code is only ever sent to a number ON the allowlist, so
 * this cannot be used to spend our SMS credit texting strangers.
 */
router.post('/otp/send', otpLimiter, async (req, res) => {
  if (!messageCentralConfigured()) throw new ApiError('Admin phone sign-in is not configured yet.', 503);
  const phone = normalizePhone(req.body?.phone);
  if (!phone) throw new ApiError('Enter a valid 10-digit mobile number.');

  const account = await findAdminAccount(phone.national);
  if (!account) {
    console.warn(`[ADMIN-AUTH] rejected a non-admin number (last 4: ${String(phone.national).slice(-4)})`);
    throw new ApiError('That number is not an admin.', 403);
  }

  const r = await sendOtp(phone.national);
  if (!r.ok) throw new ApiError(r.message, 502);
  res.json({ sent: true, message: 'A code has been sent to that number.', verificationId: r.verificationId, timeout: r.timeout });
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
  res.json({ phone: req.admin!.phone, name: req.admin!.name, expiresAt: req.admin!.expiresAt, sessionDays: ADMIN_SESSION_DAYS });
});

/** Sign out. Deletes the row, so the token is dead immediately rather than at its expiry. */
router.post('/logout', async (req, res) => {
  await revokeAdminSession(readAdminToken(req));
  res.json({ ok: true });
});

export default router;
