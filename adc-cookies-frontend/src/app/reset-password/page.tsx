'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Landing page for the Supabase password-reset email link. detectSessionInUrl establishes a
// recovery session on arrival; we then let the user set a new password via updateUser().
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);   // recovery session present
  const [checked, setChecked] = useState(false); // finished the initial session check
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); setChecked(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) { setReady(true); setChecked(true); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setErr(''); setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => router.push('/'), 2200);
  };

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', background: 'var(--surface-raised)', outline: 'none', marginBottom: 12 };
  const btn: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer' };

  return (
    <main className="adc-pattern-page" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: 'min(420px, 94vw)', background: 'var(--surface-card)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '28px 26px' }}>
        <h1 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>Set a new password</h1>

        {done ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--status-success)', fontWeight: 700, marginTop: 8 }}>Password updated! Taking you to the home page…</p>
        ) : !checked ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 8 }}>Checking your reset link…</p>
        ) : !ready ? (
          <>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 16px' }}>This reset link is invalid or has expired. Please request a new one from the login screen.</p>
            <button onClick={() => router.push('/')} style={btn}>Back to home</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 16px' }}>Choose a new password for your account.</p>
            <input value={pw} onChange={e => setPw(e.target.value)} placeholder="New password" type="password" autoFocus style={inp} />
            <input value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} placeholder="Confirm new password" type="password" style={inp} />
            {err && <div style={{ padding: '9px 13px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>{err}</div>}
            <button onClick={submit} disabled={saving} style={{ ...btn, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}>{saving ? 'Saving…' : 'Update password'}</button>
          </>
        )}
      </div>
    </main>
  );
}
