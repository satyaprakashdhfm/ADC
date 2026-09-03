/*
 * req.user / req.storeUser / req.admin are asserted non-null in the handlers below.
 *
 * Every route that reads them carries a require* gate in its own registration, which 401s
 * before the handler runs — verified route by route, not assumed. TypeScript cannot see
 * through middleware, so it has to be told. A NEW route here that reads them without that
 * gate would make the assertion false, and would be a 500 on an anonymous request.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { getOne, query, nowIso } from '../db/index.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizePhone, sendOtp, validateOtp, messageCentralConfigured } from '../services/messageCentral.client.js';
import { adminClient, anonClient, supabaseConfigured } from '../config/supabase.js';
import { linkEmailClaimsToUser } from '../services/coupon.service.js';

// Rejects junk like "123@gmail.com" (digits-only local part) — requires a real-looking local
// part (at least one letter, 2+ characters) and a proper domain/TLD.
const EMAIL_RE = /^(?=[^\s@]*[a-zA-Z])[^\s@]{2,}@[^\s@]+\.[a-zA-Z]{2,}$/;
/*
 * Two, not five — kept in step with the frontend's profileValidation.ts.
 *
 * Five turned away anybody called Ram, Raj, Anu, Om or Dev. It was standing in for "give us your
 * full name", which it never enforced anyway: "Ramaa" passed and "Ram K" passed, so it rejected
 * real single names while admitting the half-names it was meant to stop. If these two numbers ever
 * drift apart the customer gets the worst of both — a form that accepts a name and an API that
 * refuses it.
 */
const MIN_NAME_LEN = 2;
/** Names are for addressing people, so they must contain letters. Mirrors HAS_LETTER on the client. */
const NAME_HAS_LETTER = /\p{L}/u;

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
router.get('/me', requireAuth, async (req, res) => {
  // Attach any email-subscribe spin reward won before this account existed (best-effort, never
  // blocks the profile response) — this is what makes an emailed coupon usable at checkout.
  if (req.user!.email) { try { await linkEmailClaimsToUser(req.user!.id, req.user!.email); } catch { /* ignore */ } }
  res.json({ email: req.user!.email, name: req.user!.name, role: req.user!.role, phone: req.user!.phone ?? null });
});

// Update the signed-in user's profile. Phone-OTP users fill in their name here; Google /
// email users add a phone. Persists to our users table (authoritative for the app) and
// best-effort syncs the display name + phone into Supabase user_metadata.
router.patch('/me', requireAuth, async (req, res) => {
  const sets: any[] = [];
  const params: any[] = [];
  let i = 1;

  if (req.body?.name != null) {
    const name = String(req.body.name).trim();
    /* Say which rule failed. "Invalid name" leaves somebody retyping the same thing. */
    if (!NAME_HAS_LETTER.test(name)) throw new ApiError('Please enter your name using letters.');
    if (name.length < MIN_NAME_LEN) throw new ApiError(`Please enter at least ${MIN_NAME_LEN} letters.`);
    if (name.toLowerCase() === 'guest') throw new ApiError('Please enter your own name so we know who to hand the order to.');
    sets.push(`name = $${i++}`); params.push(name);
  }

  let normalizedPhone: any = null;
  if (req.body?.phone != null && String(req.body.phone).trim() !== '') {
    const p = normalizePhone(req.body.phone);
    if (!p) throw new ApiError('Enter a valid 10-digit mobile number.');
    normalizedPhone = p.digits;
    /*
     * Claiming a number that belongs to another account.
     *
     * Merging is the RIGHT behaviour — it is how somebody who ordered by phone-OTP keeps their
     * history when they later sign in with Google, and how a customer we knew before the website
     * inherits the row seeded from the old contact list. But it moves orders, saved addresses,
     * coupon usage and the cart onto the caller and DELETES the other row, and it used to do that
     * on nothing more than the caller typing the number. Anyone could take a stranger's order
     * history and home address by entering their mobile number here.
     *
     * So it now turns on what is actually at stake:
     *
     *   Nothing on the other row  → merge, no questions. A seeded contact or an account that never
     *                               got past sign-in has nothing to steal, and this is the common
     *                               case by a wide margin — gating it behind an SMS would charge us
     *                               for every one of them and make people verify a number to claim
     *                               an empty record.
     *   Orders or addresses on it → prove the number is yours. The client sends the verificationId
     *                               and code from /auth/otp/send, and Message Central has to agree.
     *
     * The email branch below refuses outright on a conflict rather than merging. That asymmetry is
     * deliberate: an email is not something we can put an OTP through here.
     */
    const taken = await getOne('SELECT * FROM users WHERE phone = $1 AND id <> $2', [normalizedPhone, req.user!.id]);
    if (taken) {
      const { c: activity } = (await getOne(
        `SELECT (SELECT COUNT(*) FROM orders    WHERE user_id = $1)
              + (SELECT COUNT(*) FROM addresses WHERE user_id = $1) AS c`,
        [taken.id]
      ))!;

      if (Number(activity) > 0) {
        const { verificationId, code } = req.body || {};
        if (!verificationId || !code) {
          throw new ApiError(
            'That number is already on an account with orders on it. Send yourself a code to confirm it is yours.',
            409, 'PHONE_VERIFICATION_REQUIRED',
          );
        }
        if (!messageCentralConfigured()) throw new ApiError('Phone verification is not configured yet.', 503);

        const v = await validateOtp(verificationId, code);
        if (!v.ok) throw new ApiError(v.message, 401);

        /*
         * The verification has to be FOR THIS NUMBER. Without this check the gate is decorative:
         * anyone can request a code to their own phone, enter it correctly, and send that
         * verificationId along with somebody else's number.
         *
         * Compared on the last ten digits rather than through normalizePhone, because the exact
         * shape Message Central echoes back is not documented and we have no recorded response to
         * check against — they are sent `national`, but a reply of "+919876543210", "0091..." or
         * "919876543210" would all be reasonable. Ten significant digits is what identifies an
         * Indian mobile, so this is tolerant of the wrapper and still exact on the number.
         *
         * A reply naming no number, or a different one, is refused rather than assumed good: the
         * whole point is that the caller does not get to assert this. If a legitimate merge ever
         * fails here, the log line below is the answer — last four digits only, since the two
         * numbers being compared are the sensitive part.
         */
        const ten = (x: unknown) => String(x ?? '').replace(/\D/g, '').slice(-10);
        const verifiedTen = ten(v.mobileNumber);
        if (verifiedTen.length !== 10 || verifiedTen !== ten(normalizedPhone)) {
          console.warn(
            `[AUTH] phone claim refused | user=${req.user!.id} | claimed=…${ten(normalizedPhone).slice(-4)} `
            + `| provider verified=${verifiedTen ? `…${verifiedTen.slice(-4)}` : 'no number in response'}`,
          );
          throw new ApiError('That code was not for this number. Request a new one.', 401);
        }
      }

      await mergeAccounts(req.user!.id, taken.id);
      console.log(`[AUTH] accounts merged | into=${req.user!.id} | from=${taken.id} | activity=${activity} | verified=${Number(activity) > 0}`);
      // Fall through — we still set the phone on the current account below.
    }
    sets.push(`phone = $${i++}`); params.push(normalizedPhone);
  }

  // Phone-OTP users can optionally add a real email as contact info. We only store it in our
  // users table (their Supabase login stays keyed on the synthetic address) — never fabricated.
  if (req.body?.email != null && String(req.body.email).trim() !== '') {
    const email = String(req.body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new ApiError('Enter a proper email address.');
    const taken = await getOne('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, req.user!.id]);
    if (taken) throw new ApiError('That email is already linked to another account.');
    sets.push(`email = $${i++}`); params.push(email);
  }

  if (!sets.length) throw new ApiError('Nothing to update.');

  sets.push(`updated_at = $${i++}`); params.push(nowIso());
  params.push(req.user!.id);
  const row = await getOne(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params);

  // Best-effort mirror into Supabase (never blocks the response). CRITICAL for phone-OTP users:
  // they have no real email, so looking up auth.users by req.user!.email found nothing and the
  // name never synced — which made the client fall back to a generic name on the next load and
  // re-show the "add your name" prompt forever. Resolve their auth row by the synthetic phone
  // email (or the current email for email/Google users) so the name actually persists.
  try {
    if (supabaseConfigured()) {
      const meta: Record<string, any> = {};
      if (req.body?.name != null) meta.full_name = String(req.body.name).trim();
      if (normalizedPhone) meta.phone = normalizedPhone;
      const effectivePhone = normalizedPhone || row!.phone;
      const lookupEmail = req.user!.email || (effectivePhone ? `phone_${effectivePhone}@phone.adccookies.app` : null);
      const su = lookupEmail ? await getOne('SELECT id FROM auth.users WHERE email = $1', [lookupEmail]).catch(() => null) : null;
      if (su) await adminClient().auth.admin.updateUserById(su.id, { user_metadata: meta });
    }
  } catch { /* metadata sync is non-critical */ }

  res.json({ email: row!.email, name: row!.name, role: row!.role, phone: row!.phone ?? null });
});

// Best-effort city/region for wherever this login is coming from (IP-based — no browser
// permission prompt, so it never interrupts the login flow). The frontend calls this once per
// fresh login, not on every page load. Never throws: a lookup failure just leaves the column
// as it was.
router.post('/log-location', requireAuth, async (req, res) => {
  try {
    // The LEFTMOST address in X-Forwarded-For is the original client — each proxy hop appends
    // its own address to the right, per HTTP convention. This is more reliable here than req.ip,
    // which depends on exactly how many hops `trust proxy` is configured to peel back — and we
    // don't want to raise that globally just to fix this, since it also governs per-IP rate
    // limiting (trusting too many hops there would let X-Forwarded-For be spoofed to bypass it).
    const xff = String(req.headers['x-forwarded-for'] || '');
    const ip = (xff.split(',')[0] || req.ip || '').trim().replace(/^::ffff:/, '');
    console.log(`[AUTH] log-location | user=${req.user!.id} | xff="${xff}" | resolved_ip=${ip || 'none'}`);

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const r = await fetch(`https://ipapi.co/${ip}/json/`);
      const j: any = await r.json().catch(() => null);
      if (!r.ok) {
        console.log(`[AUTH] log-location | user=${req.user!.id} | ✗ ipapi.co status=${r.status} | ${JSON.stringify(j).slice(0, 200)}`);
      } else {
        const location = [j?.city, j?.region, j?.country_name].filter(Boolean).join(', ');
        if (location) {
          await query('UPDATE users SET last_login_location = $1 WHERE id = $2', [location, req.user!.id]);
          console.log(`[AUTH] log-location | user=${req.user!.id} | ✓ ${location}`);
        } else {
          console.log(`[AUTH] log-location | user=${req.user!.id} | ✗ no usable location in response | ${JSON.stringify(j).slice(0, 200)}`);
        }
      }
    } else {
      console.log(`[AUTH] log-location | user=${req.user!.id} | skip — no usable ip`);
    }
  } catch (e: any) {
    console.log(`[AUTH] log-location | user=${req.user?.id} | ✗ ${e.message}`);
  }
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

  let supaUserId: any = null;
  let existingName: any = null;
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
    const fields: Record<string, any> = { password, email_confirm: true, phone_confirm: true };
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
