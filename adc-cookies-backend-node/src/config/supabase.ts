import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';
import ws from 'ws';

/*
 * Server-side Supabase clients for the phone-OTP bridge.
 *
 *   adminClient — uses the SERVICE_ROLE key to create/confirm users (never expose to the browser).
 *   anonClient  — uses the public anon key to exchange credentials for a real Supabase session.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANON_KEY.
 * Clients are created lazily so the rest of the app boots even when these aren't set.
 */

const URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.ANON_KEY || '';

export const supabaseConfigured = (): boolean => !!(URL && SERVICE_ROLE_KEY && ANON_KEY);

let _admin: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

const serverClientOptions: SupabaseClientOptions<'public'> = {
  auth: { autoRefreshToken: false, persistSession: false },
  /*
   * Node has no global WebSocket on the versions we support, so supabase-js is handed `ws`.
   * Cast because their RealtimeClientOptions types `transport` as a narrower constructor than the
   * `ws` class declares — a types-only disagreement. This is the documented Node workaround and
   * has been running in production; nothing about the value changes here.
   */
  realtime: { transport: ws as unknown as NonNullable<SupabaseClientOptions<'public'>['realtime']>['transport'] },
};

export function adminClient(): SupabaseClient {
  if (!URL || !SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).');
  }
  if (!_admin) {
    _admin = createClient(URL, SERVICE_ROLE_KEY, serverClientOptions);
  }
  return _admin;
}

export function anonClient(): SupabaseClient {
  if (!URL || !ANON_KEY) {
    throw new Error('Supabase is not configured (set SUPABASE_URL and ANON_KEY).');
  }
  if (!_anon) {
    _anon = createClient(URL, ANON_KEY, serverClientOptions);
  }
  return _anon;
}

/*
 * The id of the Supabase auth account holding exactly this email, or null.
 *
 * Replaces `SELECT id FROM auth.users WHERE email = $1`, which only worked while Supabase's
 * managed auth schema shared a database with our own tables.
 *
 * GoTrue's admin list endpoint accepts a `filter`, verified against the live API rather than
 * assumed: filtering on one full synthetic address returns exactly that account, and on the
 * `phone_` prefix returns the 66 phone-login accounts out of 80. supabase-js does not expose the
 * parameter, so this calls the REST endpoint directly.
 *
 * The filter only narrows the page; the exact comparison below is what decides. So this stays
 * correct even if a future GoTrue loosens the parameter or ignores it altogether.
 */
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  if (!URL || !SERVICE_ROLE_KEY) return null;
  const target = email.trim().toLowerCase();
  try {
    const res = await fetch(
      `${URL}/auth/v1/admin/users?per_page=200&filter=${encodeURIComponent(target)}`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    );
    if (!res.ok) return null;
    const body: any = await res.json();
    const hit = (body?.users || []).find((u: any) => String(u?.email || '').toLowerCase() === target);
    return hit ? String(hit.id) : null;
  } catch {
    return null;   // best-effort: the caller falls back to creating the account
  }
}
