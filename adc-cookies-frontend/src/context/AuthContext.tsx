'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
/* Both of these now feed only the commented-out Supabase fallback below, along with
   fromSessionMeta and mergeSessionUser. Left in place so restoring that path is uncommenting it
   rather than reconstructing it; they and @supabase/supabase-js go from the frontend entirely once
   production has run on our own sessions long enough to trust. */
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  getMe, updateMe, logLoginLocation, sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp,
  exchangeGoogleCode, logoutSession, userSessionToken, type MeResponse,
} from '@/lib/api';
import { isValidName, isValidEmail } from '@/lib/profileValidation';

interface User { name: string; email: string; role: string; initials: string; phone?: string; }

interface AuthContextType {
  user: User | null;
  /* The Supabase auth user id — a stable identity for "which account is this", unlike anything on
     `user`, whose phone/email arrive at different moments and can each be the first one present.
     Use this to scope per-account client state (see CartContext); never a contact field. */
  authId: string | null;
  loading: boolean;
  profileLoaded: boolean;  // true once the authoritative /me profile has loaded (or there's no user)
  authModalOpen: boolean;          // true while a LoginModal instance is open anywhere in the app
  setAuthModalOpen: (open: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  sendOtp: (phone: string) => Promise<{ verificationId: string; timeout: number }>;
  verifyOtp: (phone: string, verificationId: string, code: string) => Promise<{ role: string; needsName: boolean }>;
  updateProfile: (patch: { name?: string; phone?: string; email?: string; verificationId?: string; code?: string }) => Promise<void>; // persists to the backend
  updateUser: (patch: Partial<Pick<User, 'name' | 'phone'>>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const initialsOf = (name: string) =>
  (name || '').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

// Phone-login accounts carry a synthetic Supabase email — never show it as the user's email.
const SYNTHETIC_EMAIL = /^phone_\d+@phone\.adccookies\.app$/i;
const cleanEmail = (e?: string | null) => (e && !SYNTHETIC_EMAIL.test(e) ? e : '');

const userFromMe = (me: MeResponse): User =>
  ({ name: me.name, email: cleanEmail(me.email), role: me.role, initials: initialsOf(me.name), phone: me.phone ?? undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Set only from the session, and deliberately NOT touched by refineFromBackend: that replaces
  // `user` wholesale on every page load and token refresh, which is exactly what made a
  // contact-field-derived identity change under its own feet.
  const [authId, setAuthId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // While any LoginModal is open, ProfileGate stays quiet — the OTP path already runs its own
  // mandatory name+email step in the same popup, so ProfileGate popping up at the same time
  // (it reacts to the same user/profileLoaded change) looked like two stacked, fighting popups.
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Instant user straight from the Supabase session (no network) so the UI reflects login
  // immediately. We never block the logged-in state on a backend round-trip.
  const fromSessionMeta = (session: Session | null): User | null => {
    if (!session) return null;
    const meta = (session.user.user_metadata || {}) as Record<string, string>;
    const email = cleanEmail(session.user.email);
    // No fabricated fallback name here: a generic placeholder ('You') is truthy, so it used to
    // overwrite the real backend name in mergeSessionUser on every token refresh/tab refocus —
    // which made ProfileGate think the name was missing and pop up again and again. Leaving it
    // empty lets `next.name || prev.name` keep the good name we already have.
    // Same issue with the literal 'Guest' placeholder a brand-new phone signup starts with: the
    // JWT keeps carrying it until the token naturally refreshes (up to ~1h) even after the real
    // name is saved — treat it as empty too so it can't clobber the saved name via that `||`.
    const rawName = meta.full_name || meta.name || '';
    const name = rawName.toLowerCase() === 'guest' ? '' : rawName || (email ? email.split('@')[0] : '');
    return { name, email, role: 'CUSTOMER', initials: initialsOf(name), phone: meta.phone };
  };

  // Session metadata often lacks the phone/email (those live in our DB, not Supabase),
  // so merging preserves contact details we already know instead of blanking them on every
  // token refresh / tab-refocus — which is what made the ProfileGate flash back up.
  const mergeSessionUser = (prev: User | null, next: User | null): User | null => {
    if (!next) return null;
    if (!prev) return next;
    return {
      ...next,
      phone: next.phone || prev.phone,
      email: next.email || prev.email,
      role: prev.role || next.role,
      name: next.name || prev.name,
      initials: initialsOf(next.name || prev.name),
    };
  };

  // Refine with the canonical name + role + contact from our backend (DB) in the background.
  // If it's slow or fails, the session-based user above stays — login never "lags".
  const refineFromBackend = async () => {
    try { const me = await getMe(); setUser(userFromMe(me)); } catch { /* keep session user */ }
    finally { setProfileLoaded(true); }
    logLoginLocationOnce();
  };

  // IP-based location capture, once per browser tab session — refineFromBackend fires on every
  // page load/token-refresh too, not just fresh logins, so this guards against re-logging that.
  const logLoginLocationOnce = () => {
    try {
      if (sessionStorage.getItem('adc_loc_logged')) return;
      sessionStorage.setItem('adc_loc_logged', '1');
    } catch { /* ignore */ }
    logLoginLocation().catch(() => {});
  };

  /*
   * Load the profile for one of our own sessions.
   *
   * There is no local copy of the identity to show instantly, the way fromSessionMeta could read a
   * decoded JWT — an opaque token says nothing about who it belongs to. That is the trade for the
   * server being the only authority: one request on load, and in exchange the name and role on
   * screen are never a stale copy of what the server actually thinks.
   */
  const loadOwnSession = async () => {
    try {
      const me = await getMe();
      setUser(userFromMe(me));
      setAuthId(me.authId ?? null);
      logLoginLocationOnce();
    } catch (e) {
      /*
       * ONLY a 401 throws the credential away.
       *
       * This used to clear on any failure at all, which quietly signed people out for reasons
       * that had nothing to do with their session: a dropped connection, a 500, a slow network,
       * or the server restarting mid-request — which is precisely what a deploy does. The token
       * was still perfectly valid; we discarded it and showed them the login sheet, and the only
       * way back was to sign in again.
       *
       * A 401 is the server actively saying "I do not honour this", and that is the one case
       * where holding on to it is pointless. Anything else is a failure to ASK, not an answer,
       * so the token stays and the next page load tries again.
       */
      const status = (e as { status?: number })?.status;
      if (status === 401) {
        userSessionToken.clear();
        setAuthId(null);
      }
      setUser(null);
    } finally {
      setProfileLoaded(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    /*
     * Coming home from Google.
     *
     * The callback redirected here with a single-use code rather than a session token, so that a
     * 60-day credential never appears in the address bar, in history, or in the Referer header of
     * whatever this page loads next. Spend it, then strip it from the URL with replaceState so a
     * reload or a shared link cannot try to spend it again.
     */
    const url = new URL(window.location.href);
    const handoff = url.searchParams.get('adc_code');
    const authError = url.searchParams.get('adc_auth_error');
    if (handoff || authError) {
      url.searchParams.delete('adc_code');
      url.searchParams.delete('adc_auth_error');
      window.history.replaceState({}, '', url.toString());
    }
    if (handoff) {
      exchangeGoogleCode(handoff)
        .then(({ sessionToken }) => { userSessionToken.set(sessionToken); return loadOwnSession(); })
        .catch(() => {
          /* The code is single-use and lives a minute, so a second attempt at the same one fails
             by design — a back button, a restored tab, or a refresh of the callback URL all do it.
             That is not a reason to appear signed out: if the first attempt already banked a
             token, use it. Only give up when there is genuinely nothing to fall back on. */
          if (userSessionToken.get()) return loadOwnSession();
          setProfileLoaded(true);
          setLoading(false);
        });
      return;
    }
    if (authError) console.warn('[auth] google sign-in did not complete:', authError);

    // Our session, if there is one.
    if (userSessionToken.get()) { loadOwnSession(); return; }

    /*
     * COMMENTED OUT 2026-09-08 — the Supabase fallback.
     *
     * It kept the switchover invisible: anyone already signed in stayed signed in. On staging that
     * same kindness hides what we are trying to measure, because a session test can pass through
     * this branch without ever exercising our own. Gone, so the tests mean something.
     *
     * Consequence, stated plainly: anybody holding a Supabase session is now signed out once.
     * Acceptable on staging. Expected, and worth announcing, whenever this reaches production.
     */
    // /*
    // * Otherwise fall back to Supabase. This branch is what keeps the migration invisible: anybody
    // * already signed in when this shipped stays signed in, and moves across only when they next
    // * log in. It goes when Supabase Auth is switched off for good.
    // */
    // supabase.auth.getSession().then(({ data }) => {
    // setUser(prev => mergeSessionUser(prev, fromSessionMeta(data.session)));   // instant — no waiting on the backend
    // setAuthId(data.session?.user?.id ?? null);
    // setLoading(false);
    // if (data.session) refineFromBackend(); else setProfileLoaded(true);
    // });
    //
    // const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    // if (userSessionToken.get()) return;   // ours wins; ignore Supabase's chatter
    // setUser(prev => mergeSessionUser(prev, fromSessionMeta(session)));         // instant on login / logout / token refresh
    // setAuthId(session?.user?.id ?? null);
    // if (session) refineFromBackend(); else setProfileLoaded(true);
    // });
    // return () => sub.subscription.unsubscribe();

    // Nothing else to try: no session of ours means signed out.
    setUser(null);
    setAuthId(null);
    setLoading(false);
    setProfileLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Hand the browser to our own start endpoint, which builds the Google URL with state and PKCE
   * and keeps the client secret server-side.
   *
   * A full page navigation rather than fetch: OAuth is a redirect chain the browser itself has to
   * follow. `next` is only ever a path — the server refuses anything that could change origin,
   * because an authenticated open redirect is a better phishing tool than a plain one.
   */
  const loginWithGoogle = async () => {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
  };

  // Phone OTP: our backend texts the code (Message Central). Verifying returns Supabase
  // session tokens, which we install so the rest of the app behaves like any other login.
  const sendOtp = (phone: string) => apiSendOtp(phone);

  const verifyOtp = async (phone: string, verificationId: string, code: string) => {
    const { sessionToken } = await apiVerifyOtp(phone, verificationId, code);
    /* The server no longer returns a Supabase pair at all, so there is nothing to fall back to:
       no session token means the login genuinely failed, and saying so beats appearing to succeed.
       (The old branch installed a Supabase session from accessToken/refreshToken.) */
    if (!sessionToken) throw new Error('Sign-in did not return a session. Please try again.');
    userSessionToken.set(sessionToken);
    const me = await getMe();
    setAuthId(me.authId ?? null);
    setUser(userFromMe(me));
    setProfileLoaded(true);
    // Mandatory, no-skip name + email: keep asking on every OTP login until both meet the real
    // bar (proper length/format) — not just "present", and not just for brand-new numbers.
    const needsName = me.name === 'Guest' || !isValidName(me.name) || !isValidEmail(cleanEmail(me.email));
    return { role: me.role, needsName };
  };

  // Persist name/phone to the backend (DB) and reflect it in the session.
  const updateProfile = async (patch: { name?: string; phone?: string; email?: string; verificationId?: string; code?: string }) => {
    const me = await updateMe(patch);
    setUser(userFromMe(me));
  };

  // Local-only profile patch (optimistic UI; not persisted).
  const updateUser = (patch: Partial<Pick<User, 'name' | 'phone'>>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next: User = { ...prev, ...patch };
      if (patch.name) next.initials = initialsOf(patch.name);
      return next;
    });
  };

  /*
   * Sign out on the server, not just in this tab.
   *
   * supabase.auth.signOut() only dropped the browser's copy, so a token already lifted from this
   * device stayed valid until it aged out. Revoking the row means the very next request carrying
   * it is anonymous.
   *
   * Local state is cleared whatever the network did. A sign-out that appears to fail is worse
   * than useless: the customer is left believing they are still signed in, quite possibly on a
   * shared machine. Supabase's signOut still runs, to clear a legacy session if one exists.
   */
  const logout = async () => {
    try { await logoutSession(); } catch { /* revoke best-effort; clear locally regardless */ }
    userSessionToken.clear();
    // try { await supabase.auth.signOut(); } catch { }   // no Supabase session exists any more
    setUser(null);
    setAuthId(null);
  };

  return (
    <AuthContext.Provider value={{ user, authId, loading, profileLoaded, authModalOpen, setAuthModalOpen, loginWithGoogle, sendOtp, verifyOtp, updateProfile, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
