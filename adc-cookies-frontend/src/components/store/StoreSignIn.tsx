'use client';
import { useState } from 'react';
import { Store } from 'lucide-react';
import { storeLogin, storeMe, setStoreToken, type StoreSession } from '@/lib/storeApi';

/*
 * Sign-in for store staff, used two ways: on its own at /store (staff who just want "the portal"),
 * and inside /store/<code> when a session has expired.
 *
 * THE ACCOUNT DECIDES THE STORE, NOT THE URL. Someone signing a Jayanagar login into /store/begur
 * is sent to Jayanagar rather than shown a Begur page whose every request then 404s. The URL is a
 * bookmark; the credential is the authority.
 */

const wrap: React.CSSProperties = { background: 'var(--surface-card, #fff)', border: '1px solid var(--border-default, #e5e0d5)', borderRadius: 14 };
const input: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 10, fontSize: 16,
  border: '1px solid var(--border-default, #e5e0d5)', background: 'var(--surface-card, #fff)',
  color: 'var(--text-strong, #2b2118)',
};

export default function StoreSignIn({ code, onSignedIn }: {
  /** Prefills the username and, when it matches the account, keeps the user on this page. */
  code?: string;
  /** Called only when the signed-in account belongs to `code`. Omit to always redirect. */
  onSignedIn?: (session: StoreSession) => void;
}) {
  const [username, setUsername] = useState(code || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await storeLogin(username.trim(), password);
      setStoreToken(r.storeCode, r.token);
      if (!onSignedIn || r.storeCode !== code) {
        // Hard navigation, not router.push: the portal reads its token on mount, and a client-side
        // transition can render the new route before storage settles on some mobile browsers.
        window.location.href = `/store/${r.storeCode}`;
        return;
      }
      onSignedIn(await storeMe(r.storeCode));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Sign-in failed');
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--cream-bg, #fdf7ee)', color: 'var(--text-strong, #2b2118)' }}>
      <form onSubmit={submit} style={{ ...wrap, padding: 28, width: 'min(420px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Store size={22} /><h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Store sign in</h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted, #7b6a58)', margin: '0 0 22px' }}>
          For counter staff. Ask the manager for your username and password.
        </p>
        <label htmlFor="store-user" style={{ fontSize: 13, fontWeight: 800, display: 'block', marginBottom: 6 }}>Username</label>
        <input id="store-user" value={username} onChange={e => setUsername(e.target.value)}
          autoCapitalize="none" autoCorrect="off" autoComplete="username" style={{ ...input, marginBottom: 14 }} />
        <label htmlFor="store-pw" style={{ fontSize: 13, fontWeight: 800, display: 'block', marginBottom: 6 }}>Password</label>
        <input id="store-pw" type="password" value={password} onChange={e => setPassword(e.target.value)}
          autoComplete="current-password" style={{ ...input, marginBottom: 20 }} />
        {err && <p style={{ color: '#a4231d', fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>{err}</p>}
        <button type="submit" disabled={busy || !password || !username.trim()}
          style={{
            width: '100%', padding: '14px 22px', borderRadius: 10, border: '1px solid transparent',
            background: 'var(--brand-orange, #e8641c)', color: '#fff', fontSize: 16, fontWeight: 800,
            cursor: 'pointer', opacity: busy || !password || !username.trim() ? 0.6 : 1,
          }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
