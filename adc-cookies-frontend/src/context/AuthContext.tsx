'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getMe, updateMe, sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp, type MeResponse } from '@/lib/api';

interface User { name: string; email: string; role: string; initials: string; phone?: string; }

interface AuthContextType {
  user: User | null;
  loading: boolean;
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

  // Instant user straight from the Supabase session (no network) so the UI reflects login
  // immediately. We never block the logged-in state on a backend round-trip.
  const fromSessionMeta = (session: Session | null): User | null => {
    if (!session) return null;
    const meta = (session.user.user_metadata || {}) as Record<string, string>;
    const email = cleanEmail(session.user.email);
    const name = meta.full_name || meta.name || (email ? email.split('@')[0] : 'You');
    return { name, email, role: 'CUSTOMER', initials: initialsOf(name), phone: meta.phone };
  };

  // Refine with the canonical name + role from our backend (DB) in the background.
  // If it's slow or fails, the session-based user above stays — login never "lags".
  const refineFromBackend = async () => {
    try { const me = await getMe(); setUser(userFromMe(me)); } catch { /* keep session user */ }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(fromSessionMeta(data.session));   // instant — no waiting on the backend
      setLoading(false);
      if (data.session) refineFromBackend();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(fromSessionMeta(session));         // instant on login / logout / token refresh
      if (session) refineFromBackend();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    const me = await getMe();
    setUser(userFromMe(me));
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
    const { accessToken, refreshToken, needsName } = await apiVerifyOtp(phone, verificationId, code);
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw new Error(error.message);
    const me = await getMe();
    setUser(userFromMe(me));
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
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, resetPassword, sendOtp, verifyOtp, updateProfile, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
