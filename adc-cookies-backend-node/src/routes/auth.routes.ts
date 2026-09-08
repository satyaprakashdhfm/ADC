/*
 * req.user / req.storeUser / req.admin are asserted non-null in the handlers below.
 *
 * Every route that reads them carries a require* gate in its own registration, which 401s
 * before the handler runs — verified route by route, not assumed. TypeScript cannot see
 * through middleware, so it has to be told. A NEW route here that reads them without that
 * gate would make the assertion false, and would be a 500 on an anonymous request.
 */
import { Router } from 'express';
/* crypto, anonClient and findAuthUserIdByEmail are all reachable only from the commented-out
   Supabase half of phone login. Kept imported so restoring it is a single uncomment. */
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { getOne, query, nowIso } from '../db/index.js';
import { requireAuth, syncUser } from '../middlewares/auth.middleware.js';
import { createUserSession, revokeUserSession } from '../services/userAuth.service.js';
import {
  googleConfigured, beginGoogleLogin, consumeState, exchangeCodeForIdentity,
  createHandoff, consumeHandoff, safeNextPath,
} from '../services/googleAuth.service.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizePhone, sendOtp, validateOtp, messageCentralConfigured } from '../services/messageCentral.client.js';
import { adminClient, anonClient, supabaseConfigured, findAuthUserIdByEmail } from '../config/supabase.js';
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

  await query('DELETE FROM users WHERE id = $1', [fromId]);
  /* COMMENTED OUT 2026-09-08 — see the identical block in auth.middleware.ts. Nothing signs in
     through Supabase, so an orphaned auth row grants nothing. Sessions still cascade away.
  const fromUser = await getOne('SELECT supabase_user_id FROM users WHERE id = $1', [fromId]);
  if (fromUser?.supabase_user_id && supabaseConfigured()) {
    try {
      await adminClient().auth.admin.deleteUser(fromUser.supabase_user_id);
    } catch { }
  } */
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
  res.json({ authId: req.user!.authId, email: req.user!.email, name: req.user!.name, role: req.user!.role, phone: req.user!.phone ?? null });
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
    if (taken) {
      /*
       * Refused, and deliberately NOT merged — even though the caller is almost always the same
       * person, as they were the day this message was first read in anger.
       *
       * Merging here would take an email address on nothing but the caller's word. Anyone who can
       * verify ANY phone number could then type somebody else's address and absorb their account,
       * orders and saved addresses included. That is the exact shape of the hole closed on
       * 2026-09-03, arriving from the opposite direction: there it was an unverified phone claim,
       * here it would be an unverified email one. The phone branch above demands an OTP before it
       * will move an account; nothing weaker belongs on this side.
       *
       * There IS a safe route, and it needs no new proof mechanism because they already hold the
       * proof: signing in with Google on that address demonstrates ownership. They then land on
       * the account that owns the email, ProfileGate asks for the number, and the phone branch
       * above merges the two — ungated, because the account being absorbed has no activity to
       * protect. So the fix is to say this, with a code the client can act on, rather than leaving
       * somebody staring at a mandatory email field they can never satisfy.
       */
      throw new ApiError(
        'You already have an account with that email. Sign in with Google using it and we will move this number across.',
        409, 'EMAIL_ON_ANOTHER_ACCOUNT',
      );
    }
    sets.push(`email = $${i++}`); params.push(email);
  }

  if (!sets.length) throw new ApiError('Nothing to update.');

  sets.push(`updated_at = $${i++}`); params.push(nowIso());
  params.push(req.user!.id);
  const row = await getOne(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params);

  /* COMMENTED OUT 2026-09-08 — mirrored the name and phone into Supabase user_metadata so a
     Supabase-hosted session would show the change. Nothing reads that copy now: the client gets
     its profile from GET /auth/me, which reads our own users table. */
  // /*
  // * Best-effort mirror into Supabase (never blocks the response), so the customer's own account
  // * page shows the change too.
  // *
  // * The account is addressed by the id stored on the row. This previously had to reconstruct a
  // * lookup address — the real email for Google users, and a synthetic `phone_…@phone.adccookies
  // * .app` one for phone-OTP users, who have no email at all. Missing that second case was a real
  // * bug: the name never synced, so the client fell back to a generic name on the next load and
  // * re-showed the "add your name" prompt forever. There is no address to reconstruct now.
  // */
  // try {
  // if (supabaseConfigured() && row!.supabase_user_id) {
  // const meta: Record<string, any> = {};
  // if (req.body?.name != null) meta.full_name = String(req.body.name).trim();
  // if (normalizedPhone) meta.phone = normalizedPhone;
  // await adminClient().auth.admin.updateUserById(row!.supabase_user_id, { user_metadata: meta });
  // }
  // } catch { /* metadata sync is non-critical */ }

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

  /*
   * 2) COMMENTED OUT 2026-09-08 — the Supabase half of phone login.
   *
   * This used to create or update a Supabase auth user under a synthetic address, reset its
   * password to one we generated, and exchange that for a Supabase session. All of it existed
   * only to borrow Supabase's session machinery; the identity was always the phone number, held
   * in our own users.phone.
   *
   * Commented rather than deleted so staging can be put back with one edit if these tests go
   * badly. It goes for good once production has run on our sessions for a while — and with it the
   * synthetic phone_<number>@phone.adccookies.app address, which existed for no other reason.
   *
   * NOTE: src/config/supabase.ts STAYS. Supabase Storage uses the very same adminClient() for the
   * adc-media bucket, so SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are still required — this
   * retires Supabase AUTH, not Supabase.
   */
  // // 2) Create/confirm the user in Supabase and (re)set a one-time password we control.
  // //    We key the Supabase login on a stable synthetic email so it works with the
  // //    always-on Email provider (no Supabase Phone provider/SMS config needed), while
  // //    still storing the real phone number on the record.
  // const admin = adminClient();
  // const email = `phone_${phone.digits}@phone.adccookies.app`;
  // const password = crypto.randomBytes(24).toString('base64url');
  //
  // /*
  // * Whether the UI should ask for a name, decided from our own users.name.
  // *
  // * This used to read Supabase's metadata copy of the name out of auth.users, which was one of
  // * the two things here requiring Supabase's managed schema to share our database. Ours is the
  // * authoritative copy anyway — every other route already treats it that way — and reading it
  // * fixes a small rudeness on the side: a customer seeded from the contact list we kept before
  // * the site existed is now greeted by the name we already have, instead of being asked to type
  // * it in again. users.phone holds 91XXXXXXXXXX, the same shape as phone.digits.
  // */
  // const local = await getOne(
  // 'SELECT id, name, supabase_user_id FROM users WHERE phone = $1',
  // [phone.digits]
  // ).catch(() => null);
  // const localName = String(local?.name || '').trim();
  // const needsName = !localName || localName === 'Guest';
  //
  // /*
  // * Which auth account this login is, resolved by the synthetic address.
  // *
  // * Deliberately NOT users.supabase_user_id, and the distinction is not academic: one local row
  // * can correspond to two auth accounts. Three customers in production hold both a Google account
  // * and a phone-OTP one, and the column keeps whichever they happened to sign in with first. Using
  // * it here would reset the password on their Google account and then try to sign in as the
  // * synthetic address — a login broken outright to save one HTTPS call. The synthetic address
  // * names exactly one account, always.
  // */
  // let supaUserId: any = await findAuthUserIdByEmail(email);
  //
  // if (supaUserId) {
  // const fields: Record<string, any> = { password, email_confirm: true, phone_confirm: true };
  // if (name) fields.user_metadata = { phone: phone.digits, full_name: name };
  // const { error } = await admin.auth.admin.updateUserById(supaUserId, fields);
  // if (error) throw new ApiError(error.message, 502);
  // } else {
  // const { data: created, error } = await admin.auth.admin.createUser({
  // email, phone: phone.e164, password,
  // email_confirm: true, phone_confirm: true,
  // user_metadata: { phone: phone.digits, full_name: name || '' },
  // });
  // if (error) {
  // /* The lookup above said there was no such account, so reaching here means one appeared in
  // between — a second OTP verify for the same number, in flight at the same time. Re-resolve
  // and reset the password on the account that won, rather than failing a login the customer
  // has already proved they own. */
  // const foundId = await findAuthUserIdByEmail(email);
  // if (!foundId) throw new ApiError(error.message, 502);
  // supaUserId = foundId;
  // const upd = await admin.auth.admin.updateUserById(foundId, { password, email_confirm: true, phone_confirm: true });
  // if (upd.error) throw new ApiError(upd.error.message, 502);
  // } else {
  // supaUserId = created?.user?.id || null;
  // }
  // }
  //
  // /* Record the link now that both ids are known. A number logging in for the very first time has
  // no local row yet — parseAuth's syncUser creates it, and links it, on the first request that
  // carries the token we are about to hand back. */
  // if (local && supaUserId && !local.supabase_user_id) {
  // await query(
  // `UPDATE users SET supabase_user_id = $1
  // WHERE id = $2 AND supabase_user_id IS NULL
  // AND NOT EXISTS (SELECT 1 FROM users x WHERE x.supabase_user_id = $1)`,
  // [supaUserId, local.id]
  // ).catch(() => null);
  // }

  /*
   * 2) Whether the UI should ask for a name, from our own users.name.
   *
   * Ours is the authoritative copy — every other route already treats it that way — and reading
   * it means a customer seeded from the contact list we kept before the site existed is greeted
   * by the name we already have, rather than asked to type it in again. users.phone holds
   * 91XXXXXXXXXX, the same shape as phone.digits.
   */
  const local = await getOne(
    'SELECT id, name FROM users WHERE phone = $1',
    [phone.digits],
  ).catch(() => null);
  const localName = String(local?.name || '').trim();
  const needsName = !localName || localName === 'Guest';

  /*
   * 3) Our own session.
   *
   * syncUser rather than a local INSERT: a number signing in for the first time has no users row
   * yet, and a session needs a users.id to belong to. Reusing it also means the account-claiming
   * rules -- adopting a row already held under this number -- apply here exactly as they do on
   * every other authenticated request, instead of being reimplemented.
   *
   * authId is null now: there is no Supabase account being created for this login, so there is no
   * auth id to link. supabase_user_id stays as the backfill left it for accounts that had one,
   * and stays NULL for anyone who signs up from here on.
   */
  const localUser = await syncUser({ phone: phone.digits, name: name || localName, authId: null });
  if (!localUser) throw new ApiError('Could not establish an account for this number.', 500);
  const ours = await createUserSession(localUser.id, req.headers['user-agent']);

  /* 4) Done. There is no Supabase session to mint any more, and no accessToken/refreshToken in
        the reply — the client has been reading sessionToken since the frontend switched over. */
  res.json({
    sessionToken: ours.token,
    sessionExpiresAt: ours.expiresAt,
    needsName,
  });
});

/*
 * Google sign-in, ours end to end.
 *
 * Three endpoints because the flow crosses three trust boundaries: the browser leaves for Google,
 * Google returns to us, and then the finished session has to reach the frontend on another origin.
 *
 *   GET  /google/start     -> redirect the browser to Google
 *   GET  /google/callback  -> Google returns here; we finish and bounce back to the frontend
 *   POST /google/exchange  -> the frontend spends the one-time code for a session token
 *
 * FRONTEND_URL says where the browser goes home to. It is env-only, never taken from the request:
 * a sign-in endpoint that redirects wherever it is told is a phishing primitive, because the link
 * genuinely starts on our domain and really does authenticate before landing somewhere else.
 */
const FRONTEND_URL = () => (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

router.get('/google/start', async (req, res) => {
  if (!googleConfigured()) throw new ApiError('Google sign-in is not configured.', 503);
  const url = await beginGoogleLogin(safeNextPath(req.query?.next));
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const home = FRONTEND_URL() || '';
  /* Errors go back to the frontend as a query flag rather than rendering here. The browser is
     mid-navigation and the customer is looking at a blank tab: a JSON error body would be the
     end of the road, whereas the site can show the sign-in sheet again with a message. */
  const fail = (reason: string, nextPath = '/') =>
    res.redirect(`${home}${safeNextPath(nextPath)}?adc_auth_error=${encodeURIComponent(reason)}`);

  if (!googleConfigured()) return fail('not_configured');

  // Google reports a refusal by redirecting here with ?error=access_denied, not by failing.
  if (req.query?.error) return fail(String(req.query.error));

  const stored = await consumeState(String(req.query?.state || ''));
  /* An unknown or expired state. Ordinary causes: the sign-in was left open too long, the back
     button re-submitted a callback already spent, or two tabs raced. It is also exactly what
     login CSRF looks like, and there is no way to tell them apart, so it always fails. */
  if (!stored) return fail('expired_or_replayed');

  const code = String(req.query?.code || '');
  if (!code) return fail('no_code', stored.nextPath);

  let who;
  try {
    who = await exchangeCodeForIdentity(code, stored.verifier);
  } catch (e: any) {
    console.error('[GOOGLE] token exchange failed |', e.message);
    return fail('exchange_failed', stored.nextPath);
  }

  /* Refuse an address Google has not verified. Accounts here are keyed on email, so treating an
     unverified one as proof of identity would let anybody who can merely ASSERT an address take
     over the account already holding it. Rare with consumer Gmail, entirely possible on Workspace
     domains, and the consequence is total. */
  if (!who.emailVerified) {
    console.warn('[GOOGLE] refused unverified email |', who.email.replace(/(.).*(@.*)/, '$1***$2'));
    return fail('email_unverified', stored.nextPath);
  }

  const user = await syncUser({ email: who.email, name: who.name, authId: null });
  if (!user) return fail('account_failed', stored.nextPath);

  const handoff = await createHandoff(user.id);
  console.log(`[GOOGLE] signed in | user=${user.id}`);
  res.redirect(`${home}${stored.nextPath}?adc_code=${encodeURIComponent(handoff)}`);
});

/*
 * Spend the one-time code for a real session.
 *
 * This is the step that keeps a 60-day credential out of the address bar, out of browser history
 * and out of the Referer header of whatever the page loads next.
 */
router.post('/google/exchange', async (req, res) => {
  const userId = await consumeHandoff(String(req.body?.code || ''));
  if (!userId) throw new ApiError('That sign-in link has already been used or has expired.', 401);
  const row = await getOne('SELECT * FROM users WHERE id = $1', [userId]);
  if (!row) throw new ApiError('Account not found.', 404);
  const ours = await createUserSession(userId, req.headers['user-agent']);
  res.json({
    sessionToken: ours.token,
    sessionExpiresAt: ours.expiresAt,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone ?? null,
    /* Google gives us a name and an email but never a phone number, and checkout cannot dispatch
       an order without one. Same signal the OTP path returns, so ProfileGate behaves identically
       whichever way somebody signed in. */
    needsPhone: !row.phone,
  });
});

/*
 * Sign out, which for our own sessions has to reach the server.
 *
 * Supabase's signOut only cleared the browser's copy; a stolen token stayed valid until it aged
 * out because nothing server-side knew about it. Deleting the row means the very next request
 * carrying it is anonymous.
 *
 * Deliberately not behind requireAuth. The one moment you most need to sign out is when the
 * session is already broken, and demanding a valid session first would refuse exactly then.
 * Revoking an unknown token is a no-op, so this is safe to call blind, and it always answers 200
 * so a client can treat "signed out" as unconditional.
 */
router.post('/logout', async (req, res) => {
  const header = String(req.headers['authorization'] || '');
  if (header.startsWith('Bearer ')) await revokeUserSession(header.substring(7).trim());
  res.json({ ok: true });
});

export default router;
