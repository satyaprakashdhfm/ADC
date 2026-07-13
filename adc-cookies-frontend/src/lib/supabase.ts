import { createClient } from '@supabase/supabase-js';

// Public anon client for browser auth. URL + anon key come from NEXT_PUBLIC_* env vars, inlined
// into the browser bundle at build time. During static prerender (e.g. the 404 page) they can be
// absent — and createClient throws on an empty URL — so fall back to a harmless placeholder to keep
// module evaluation (and the production build) from crashing. Real values are used in the browser
// whenever they're configured; if they're genuinely unset, auth calls just fail at runtime.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-placeholder';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // completes the Google OAuth redirect back to the site
  },
});
