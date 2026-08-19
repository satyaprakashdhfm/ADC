'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminMe, adminLogout, adminSessionToken, type AdminSession } from '@/lib/api';

export interface AdminIdentity { phone: string; name: string | null; expiresAt: string; sessionDays: number }

/*
 * The admin's own session, entirely separate from useAuth().
 *
 * The dashboard used to read `user.role === 'ADMIN'` off the customer session, which meant admin was
 * something a Google or email/password login could hold. It is now a phone allowlist with its own
 * OTP login and its own token (see adminAuth.js) — a customer session grants nothing here, and
 * signing out of one does not sign you out of the other.
 *
 * The stored token is always re-checked against the server on load rather than trusted: it may have
 * expired, or the account may have been switched off, and only the server knows.
 */
export function useAdminSession() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!adminSessionToken.get()) {
      // Nothing stored, so there is nothing to verify. Deferred by a microtask rather than set
      // straight away: a synchronous setState inside an effect cascades an extra render.
      Promise.resolve().then(() => { if (!cancelled) setChecking(false); });
      return () => { cancelled = true; };
    }
    adminMe()
      .then(me => { if (!cancelled) setAdmin(me); })
      // request() has already dropped the token for any of the admin-auth failure codes, so there
      // is nothing to clean up here — this just falls through to the sign-in.
      .catch(() => { if (!cancelled) setAdmin(null); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  /** Called by the sign-in once an OTP has been verified and a session issued. */
  const signIn = useCallback((s: AdminSession) => {
    adminSessionToken.set(s.token);
    setAdmin({ phone: s.phone, name: s.name, expiresAt: s.expiresAt, sessionDays: s.sessionDays });
  }, []);

  const signOut = useCallback(async () => {
    // Tell the server first, so the row goes rather than lingering until it expires. The local
    // token is cleared either way: a failed call must not leave someone stuck signed in.
    await adminLogout().catch(() => {});
    adminSessionToken.clear();
    setAdmin(null);
  }, []);

  return { admin, checking, signIn, signOut };
}
