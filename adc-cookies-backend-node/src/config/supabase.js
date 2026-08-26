import { createClient } from '@supabase/supabase-js';
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

export const supabaseConfigured = () => !!(URL && SERVICE_ROLE_KEY && ANON_KEY);

let _admin = null;
let _anon = null;

const serverClientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
};

export function adminClient() {
  if (!URL || !SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).');
  }
  if (!_admin) {
    _admin = createClient(URL, SERVICE_ROLE_KEY, serverClientOptions);
  }
  return _admin;
}

export function anonClient() {
  if (!URL || !ANON_KEY) {
    throw new Error('Supabase is not configured (set SUPABASE_URL and ANON_KEY).');
  }
  if (!_anon) {
    _anon = createClient(URL, ANON_KEY, serverClientOptions);
  }
  return _anon;
}
