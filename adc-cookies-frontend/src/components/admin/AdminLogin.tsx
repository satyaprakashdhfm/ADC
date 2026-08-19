'use client';
import { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, Phone } from 'lucide-react';
import { adminOtpSend, adminOtpVerify, type AdminSession } from '@/lib/api';
import { authInput, authLabel, authPrimaryBtn, authLinkBtn, authErrorBox } from '@/components/auth/authUi';
import { card } from './shared/ui';

/*
 * Admin sign-in. Phone OTP and nothing else.
 *
 * Deliberately NOT the customer LoginModal, and deliberately not AuthPanel either: those offer
 * Google and email/password, and this dashboard can cancel orders and move money. One way in is one
 * way to get wrong. It issues no Supabase session — the token it stores is only good for /api/admin.
 *
 * There is no "create an account" path on purpose. Admin numbers are added to the allowlist in the
 * database; nothing on the web can grant itself admin.
 */
export default function AdminLogin({ onSignedIn, notice }: { onSignedIn: (s: AdminSession) => void; notice?: string }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const send = async () => {
    setBusy(true); setErr(''); setInfo('');
    try {
      const r = await adminOtpSend(phone);
      /* No verificationId means the server did not text anything — the number is not on the
         allowlist. It answers the same way either way so this cannot be used to discover who the
         admins are, so all this can honestly do is repeat what it said. */
      if (!r.verificationId) { setInfo(r.message); return; }
      setVerificationId(r.verificationId);
      setStep('code');
      setCode('');
      setResendIn(Math.min(60, Math.max(15, Math.round(Number(r.timeout)) || 30)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the code.');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setErr('');
    try {
      onSignedIn(await adminOtpVerify(phone, verificationId, code));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That code did not work.');
    } finally { setBusy(false); }
  };

  const input = authInput(true);

  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ ...card, padding: '34px 30px', maxWidth: 420, width: '100%' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: 'var(--white)', margin: '0 auto 18px' }}>
          <ShieldCheck size={26} />
        </div>
        <h1 style={{ fontSize: 'var(--text-h3)', marginBottom: 8, textAlign: 'center' }}>Admin sign-in</h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
          Authorised mobile numbers only. We text a one-time code.
        </p>

        {notice && (
          <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--amber-50)', color: 'var(--orange-800)', fontSize: 'var(--text-sm)', fontWeight: 700, textAlign: 'center' }}>
            {notice}
          </div>
        )}

        {step === 'phone' ? (
          <div>
            <label style={authLabel}>Admin mobile number</label>
            <div style={{ ...input, marginBottom: 10, padding: '0 14px', height: 48, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Phone size={17} color="var(--text-subtle)" />
              <span style={{ color: 'var(--text-strong)', fontWeight: 700 }}>+91</span>
              <span style={{ width: 1, height: 22, background: 'var(--border-default)' }} />
              <input
                value={phone}
                onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setInfo(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && phone.length === 10 && !busy) send(); }}
                placeholder="Mobile number" inputMode="numeric" autoComplete="tel" autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', minWidth: 0, letterSpacing: '.04em' }}
              />
            </div>
            <button onClick={send} disabled={busy || phone.length !== 10} style={authPrimaryBtn(true, !busy && phone.length === 10)}>
              {busy ? 'Sending…' : 'Send code'}{!busy && phone.length === 10 && <ArrowRight size={18} />}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Sent to +91 {phone}{' · '}
                <button onClick={() => { setStep('phone'); setCode(''); setErr(''); setResendIn(0); }} style={authLinkBtn}>Change</button>
              </div>
            </div>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter' && code.length >= 4 && !busy) verify(); }}
              placeholder="••••" inputMode="numeric" autoComplete="one-time-code" autoFocus
              style={{ ...input, marginBottom: 10, textAlign: 'center', fontSize: '1.55rem', fontWeight: 800, letterSpacing: '.4em', textIndent: '.4em', padding: '10px 15px' }}
            />
            <button onClick={verify} disabled={busy || code.length < 4} style={authPrimaryBtn(true, !busy && code.length >= 4)}>
              {busy ? 'Checking…' : 'Verify & open dashboard'}{!busy && code.length >= 4 && <ArrowRight size={18} />}
            </button>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {resendIn > 0
                ? <span>Didn&rsquo;t get it? Resend in {resendIn}s</span>
                : <button onClick={send} disabled={busy} style={authLinkBtn}>Didn&rsquo;t get it? Resend code</button>}
            </div>
          </div>
        )}

        {info && <div style={{ ...authErrorBox, background: 'var(--surface-raised)', color: 'var(--text-body)' }}>{info}</div>}
        {err && <div style={authErrorBox}>{err}</div>}
      </div>
    </main>
  );
}
