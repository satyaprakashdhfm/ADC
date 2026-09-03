'use client';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatPhone } from '@/lib/phone';
import { authInput, authPrimaryBtn, authLinkBtn, authErrorBox } from './authUi';

/*
 * Prove a number is yours before an existing account is moved onto it.
 *
 * The server merges accounts when you claim a number somebody else's row already holds — that is
 * how a customer who ordered by phone-OTP keeps their history after signing in with Google. When
 * that other row has orders or addresses on it, PATCH /me refuses with PHONE_VERIFICATION_REQUIRED
 * rather than handing over a stranger's order history to whoever typed their number. This is the
 * step that answers it.
 *
 * Not the sign-in OTP panel. That one calls verifyOtp, which mints a session and would switch the
 * person to the very account they are trying to absorb. This sends the code and hands the
 * verificationId back to the caller, who replays it with the original save.
 */
export default function PhoneClaimVerify({ phone, onVerified, onCancel }: {
  phone: string;
  onVerified: (verificationId: string, code: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { sendOtp } = useAuth();
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setErr(''); setBusy(true);
    try {
      const { verificationId: vid } = await sendOtp(phone);
      setVerificationId(vid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the code.');
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    setErr(''); setBusy(true);
    try {
      await onVerified(verificationId, code);
    } catch (e) {
      // Left on screen with the code still typed — a wrong digit should cost one keystroke.
      setErr(e instanceof Error ? e.message : 'That code did not work.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 14, marginTop: 10, background: 'var(--surface-raised)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={16} style={{ color: 'var(--brand-secondary)', flexShrink: 0 }} />
        <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>Confirm this number is yours</strong>
      </div>
      <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {formatPhone(phone)} already has an account with orders on it. We&rsquo;ll text a code to that
        number so your past orders move across to this account.
      </p>

      {err && <div style={{ ...authErrorBox, marginBottom: 10 }}>{err}</div>}

      {!verificationId ? (
        <button onClick={send} disabled={busy} style={authPrimaryBtn(false, !busy)}>
          {busy ? 'Sending…' : 'Text me a code'}
        </button>
      ) : (
        <>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => { if (e.key === 'Enter' && code.length >= 4 && !busy) void confirm(); }}
            placeholder="Enter the code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            style={{ ...authInput(false), marginBottom: 10, letterSpacing: '.3em', textAlign: 'center' }}
          />
          <button onClick={() => void confirm()} disabled={busy || code.length < 4} style={authPrimaryBtn(false, !busy && code.length >= 4)}>
            {busy ? 'Checking…' : 'Confirm'}
          </button>
          <button onClick={send} disabled={busy} style={{ ...authLinkBtn, marginTop: 8 }}>
            Send it again
          </button>
        </>
      )}

      <button onClick={onCancel} disabled={busy} style={{ ...authLinkBtn, marginTop: 8 }}>
        Use a different number
      </button>
    </div>
  );
}
