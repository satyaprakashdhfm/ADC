/*
 * Message Central — VerifyNow OTP (https://cpaas.messagecentral.com).
 *
 * Flow:
 *   1. Generate an auth token from customerId + base64(password)  (cached until it expires)
 *   2. POST /verification/v3/send        -> returns a verificationId
 *   3. POST /verification/v3/validateOtp -> confirms the code the user typed
 *
 * Credentials come from the environment. Two ways to authenticate:
 *   (A) Pre-generated token (simplest): set AUTH_KEY (or MC_AUTH_KEY) to the long-lived
 *       authToken from the Message Central dashboard — used directly, no generation call.
 *   (B) Generate on demand: set CUSTOMER_ID (or MC_CUSTOMER_ID) + MC_PASSWORD.
 * Optional: MC_BASE_URL (default https://cpaas.messagecentral.com), MC_COUNTRY (default 91),
 *           MC_EMAIL (sent during token generation in mode B).
 */

const BASE_URL = (process.env.MC_BASE_URL || 'https://cpaas.messagecentral.com').replace(/\/$/, '');
const COUNTRY = process.env.MC_COUNTRY || '91';

const staticToken = () => process.env.MC_AUTH_KEY || process.env.AUTH_KEY || '';

function creds() {
  const customerId = process.env.MC_CUSTOMER_ID || process.env.CUSTOMER_ID || '';
  const password = process.env.MC_PASSWORD || '';
  if (!customerId || !password) {
    throw new Error('Message Central is not configured (set AUTH_KEY, or CUSTOMER_ID + MC_PASSWORD).');
  }
  return { customerId, key: Buffer.from(password).toString('base64') };
}

// --- token cache (Railway runs a long-lived process, so an in-memory cache is fine) ---
let cached = { token: null, expMs: 0 };

function tokenExpiryMs(jwtToken) {
  try {
    const payload = JSON.parse(Buffer.from(jwtToken.split('.')[1], 'base64').toString('utf8'));
    if (payload.exp) return payload.exp * 1000;
  } catch { /* not a decodable JWT — fall through */ }
  return Date.now() + 50 * 60 * 1000; // assume ~50 min if we can't read exp
}

async function getAuthToken() {
  // (A) A pre-generated dashboard token wins — no generation request needed.
  const fixed = staticToken();
  if (fixed) return fixed;

  // (B) Otherwise generate one and reuse it until ~60s before it expires.
  if (cached.token && Date.now() < cached.expMs - 60_000) return cached.token;

  const { customerId, key } = creds();
  const qs = new URLSearchParams({ customerId, key, scope: 'NEW', country: COUNTRY });
  if (process.env.MC_EMAIL) qs.set('email', process.env.MC_EMAIL);

  const res = await fetch(`${BASE_URL}/auth/v1/authentication/token?${qs.toString()}`, {
    method: 'GET',
    headers: { accept: '*/*' },
  });
  const body = await res.json().catch(() => ({}));
  const token = body.token || body.authToken || body?.data?.token || body?.data?.authToken;
  if (!res.ok || !token) {
    throw new Error(body?.message || `Message Central token request failed (${res.status})`);
  }
  cached = { token, expMs: tokenExpiryMs(token) };
  return token;
}

// Normalise a user-entered Indian number to its 10-digit national form.
export function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  let national = digits;
  if (national.length === 12 && national.startsWith('91')) national = national.slice(2);
  else if (national.length === 11 && national.startsWith('0')) national = national.slice(1);
  if (!/^[6-9]\d{9}$/.test(national)) return null; // valid Indian mobile
  return { national, e164: `+${COUNTRY}${national}`, digits: `${COUNTRY}${national}` };
}

/** Send an OTP over SMS. Returns { ok, verificationId, timeout, message }. */
export async function sendOtp(national, otpLength = 4) {
  try {
    const token = await getAuthToken();
    const qs = new URLSearchParams({
      countryCode: COUNTRY, flowType: 'SMS', mobileNumber: national, otpLength: String(otpLength),
    });
    const res = await fetch(`${BASE_URL}/verification/v3/send?${qs.toString()}`, {
      method: 'POST',
      headers: { authToken: token, accept: '*/*' },
    });
    const body = await res.json().catch(() => ({}));
    const data = body?.data || {};
    if (res.ok && (body.responseCode === 200 || String(data.responseCode) === '200') && data.verificationId) {
      return { ok: true, verificationId: String(data.verificationId), timeout: data.timeout || 60 };
    }
    return { ok: false, message: data.errorMessage || body.message || 'Could not send the OTP. Please try again.' };
  } catch (e) {
    return { ok: false, message: e.message || 'Could not send the OTP. Please try again.' };
  }
}

/** Validate the code the user typed. Returns { ok, mobileNumber, message }. */
export async function validateOtp(verificationId, code) {
  try {
    const token = await getAuthToken();
    const qs = new URLSearchParams({ verificationId: String(verificationId), code: String(code) });
    // NOTE: validateOtp is a GET (the docs' heading says POST, but the working cURL — and
    // the live API — use GET; POST returns 401).
    const res = await fetch(`${BASE_URL}/verification/v3/validateOtp?${qs.toString()}`, {
      method: 'GET',
      headers: { authToken: token, accept: '*/*' },
    });
    const body = await res.json().catch(() => ({}));
    const data = body?.data || {};
    const completed =
      (body.responseCode === 200 || String(data.responseCode) === '200') &&
      (data.verificationStatus === 'VERIFICATION_COMPLETED' || data.verificationStatus === 'ALREADY_VERIFIED');
    if (res.ok && completed) {
      return { ok: true, mobileNumber: data.mobileNumber || null };
    }
    // Friendly messages for the common failure codes from the docs.
    const code2 = String(data.responseCode || body.responseCode || '');
    const friendly = { 702: 'Incorrect OTP. Please try again.', 705: 'This OTP has expired. Request a new one.', 800: 'Too many attempts. Please try again later.' }[code2];
    return { ok: false, message: friendly || data.errorMessage || body.message || 'OTP verification failed.' };
  } catch (e) {
    return { ok: false, message: e.message || 'OTP verification failed.' };
  }
}

export const messageCentralConfigured = () =>
  !!(staticToken() || ((process.env.MC_CUSTOMER_ID || process.env.CUSTOMER_ID) && process.env.MC_PASSWORD));
