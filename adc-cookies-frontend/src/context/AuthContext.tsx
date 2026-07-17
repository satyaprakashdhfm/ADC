'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getMe, updateMe, logLoginLocation, sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp, type MeResponse } from '@/lib/api';
import { isValidName, isValidEmail } from '@/lib/profileValidation';

interface User { name: string; email: string; role: string; initials: string; phone?: string; }

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileLoaded: boolean;  // true once the authoritative /me profile has loaded (or there's no user)
  authModalOpen: boolean;          // true while a LoginModal instance is open anywhere in the app
  setAuthModalOpen: (open: boolean) => void;
  login: (email: string, password: string) => Promise<string>;            // returns role
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;                          // emails a reset link
  sendOtp: (phone: string) => Promise<{ verificationId: string; timeout: number }>;
  verifyOtp: (phone: string, verificationId: string, code: string) => Promise<{ role: string; needsName: boolean }>;
  updateProfile: (patch: { name?: string; phone?: string; email?: string }) => Promise<void>; // persists to the backend
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(prev => mergeSessionUser(prev, fromSessionMeta(data.session)));   // instant — no waiting on the backend
      setLoading(false);
      if (data.session) refineFromBackend(); else setProfileLoaded(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(prev => mergeSessionUser(prev, fromSessionMeta(session)));         // instant on login / logout / token refresh
      if (session) refineFromBackend(); else setProfileLoaded(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    const me = await getMe();
    setUser(userFromMe(me));
    setProfileLoaded(true);
    return me.role;
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim(), phone: phone.trim() } },
    });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Account created — please check your email to confirm, then log in.');
    const me = await getMe();
    setUser(userFromMe(me));
    setProfileLoaded(true);
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) throw new Error(error.message);
    // Browser redirects to Google and back; onAuthStateChange picks up the session on return.
  };

  // Email a password-reset link (Supabase native). The link returns to /reset-password,
  // where detectSessionInUrl establishes a recovery session and the user sets a new password.
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) throw new Error(error.message);
  };

  // Phone OTP: our backend texts the code (Message Central). Verifying returns Supabase
  // session tokens, which we install so the rest of the app behaves like any other login.
  const sendOtp = (phone: string) => apiSendOtp(phone);

  const verifyOtp = async (phone: string, verificationId: string, code: string) => {
    const { accessToken, refreshToken } = await apiVerifyOtp(phone, verificationId, code);
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw new Error(error.message);
    const me = await getMe();
    setUser(userFromMe(me));
    setProfileLoaded(true);
    // Mandatory, no-skip name + email: keep asking on every OTP login until both meet the real
    // bar (proper length/format) — not just "present", and not just for brand-new numbers.
    const needsName = me.name === 'Guest' || !isValidName(me.name) || !isValidEmail(cleanEmail(me.email));
    return { role: me.role, needsName };
  };

  // Persist name/phone to the backend (DB) and reflect it in the session.
  const updateProfile = async (patch: { name?: string; phone?: string; email?: string }) => {
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

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, profileLoaded, authModalOpen, setAuthModalOpen, login, register, loginWithGoogle, resetPassword, sendOtp, verifyOtp, updateProfile, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
