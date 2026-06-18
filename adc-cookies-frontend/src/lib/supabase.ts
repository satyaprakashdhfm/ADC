import { createClient } from '@supabase/supabase-js';

// Public anon client for browser auth. URL + anon key come from NEXT_PUBLIC_* env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // completes the Google OAuth redirect back to the site
  },
});
