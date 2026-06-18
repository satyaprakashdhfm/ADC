'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getMe, sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp } from '@/lib/api';

interface User { name: string; email: string; role: string; initials: string; phone?: string; }

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string>;            // returns role
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendOtp: (phone: string) => Promise<{ verificationId: string; timeout: number }>;
  verifyOtp: (phone: string, verificationId: string, code: string) => Promise<string>; // returns role
  updateUser: (patch: Partial<Pick<User, 'name' | 'phone'>>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const initialsOf = (name: string) =>
  (name || '').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Build our app user from the backend (canonical name + role), falling back to the
  // Supabase session metadata if the backend is briefly unreachable.
  const fromSession = async (session: Session | null): Promise<User | null> => {
    if (!session) return null;
    try {
      const me = await getMe();
      return { name: me.name, email: me.email, role: me.role, initials: initialsOf(me.name) };
    } catch {
      const meta = (session.user.user_metadata || {}) as Record<string, string>;
      const email = session.user.email || '';
      const name = meta.full_name || meta.name || email.split('@')[0] || 'You';
      return { name, email, role: 'CUSTOMER', initials: initialsOf(name) };
    }
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => fromSession(data.session))
      .then(setUser)
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(await fromSession(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    const me = await getMe();
    setUser({ name: me.name, email: me.email, role: me.role, initials: initialsOf(me.name) });
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
    setUser({ name: me.name, email: me.email, role: me.role, initials: initialsOf(me.name) });
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) throw new Error(error.message);
    // Browser redirects to Google and back; onAuthStateChange picks up the session on return.
  };

  // Phone OTP: our backend texts the code (Message Central). Verifying returns Supabase
  // session tokens, which we install so the rest of the app behaves like any other login.
  const sendOtp = (phone: string) => apiSendOtp(phone);

  const verifyOtp = async (phone: string, verificationId: string, code: string) => {
    const { accessToken, refreshToken } = await apiVerifyOtp(phone, verificationId, code);
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw new Error(error.message);
    const me = await getMe();
    setUser({ name: me.name, email: me.email, role: me.role, initials: initialsOf(me.name) });
    return me.role;
  };

  // Local profile edit only (no backend update-profile endpoint yet).
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
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, sendOtp, verifyOtp, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
