'use client';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isValidName, isValidEmail } from '@/lib/profileValidation';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { Divider, GoogleG, authInput, authLabel, authPrimaryBtn, authLinkBtn, authErrorBox } from './authUi';

/*
 * Phone-OTP + Google sign-in, with no chrome of its own so it can be dropped into any host.
 *
 * Extracted from LoginModal so the Spin & Win wheel can sign people in inside its own popup
 * instead of stacking a second modal on top of itself. Both hosts therefore run one
 * implementation of the OTP flow — a copy would have drifted the moment either changed.
 *
 * Deliberately does NOT include the email + password path. That belongs to LoginModal alone: the
 * wheel asks a shopper mid-celebration to sign in, and a password field is the fastest way to
 * lose them.
 */

interface AuthPanelProps {
  /** Sign-in finished AND the profile is complete. `role` is 'ADMIN' for staff accounts. */
  onSuccess: (role: string) => void;
  /** True while the mandatory name/email step is showing — the host must not allow dismissal. */
  onLockChange?: (locked: boolean) => void;
  /** Change this to reset the flow back to the phone step (hosts pass their `open` flag). */
  resetKey?: unknown;
  /** Force the tighter sizing even on desktop, for hosts that are already tall. */
  compact?: boolean;
  /** Focus the phone field on mount. Off by default: in a host that scrolls (the wheel) an
   *  autofocus drags the popup down to the field and past the prize the shopper just won. */
  autoFocusPhone?: boolean;
}

export default function AuthPanel({ onSuccess, onLockChange, resetKey, compact = false, autoFocusPhone = false }: AuthPanelProps) {
  const { loginWithGoogle, sendOtp, verifyOtp, updateProfile } = useAuth();
  // Compact sizing is for mobile only — desktop gets the roomier layout back, unless the host
  // (the wheel) is already tall enough that the roomier one would push the button off-screen.
  const desktop = useIsDesktop() && !compact;

  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [otpPhone, setOtpPhone] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState(''); // asked alongside name — mandatory, no skip
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0); // seconds until "Resend OTP" re-enables

  // Reset when the host reopens. Skips the very first run so a host that never changes resetKey
  // still starts clean rather than being reset out from under itself.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setStep('phone'); setOtpPhone(''); setProfileName(''); setProfileEmail('');
    setVerificationId(''); setCode(''); setLoading(false); setGoogleLoading(false);
    setError(''); setResendIn(0);
  }, [resetKey]);

  // The name step is mandatory and no-skip, so the host has to disable its close affordances
  // for as long as it is showing.
  useEffect(() => { onLockChange?.(step === 'name'); }, [step, onLockChange]);

  // Resend countdown — ticks down to 0, then "Resend OTP" becomes tappable again.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const handleSendOtp = async () => {
    setError(''); setLoading(true);
    try {
      const { verificationId: vid, timeout } = await sendOtp(otpPhone);
      setVerificationId(vid);
      setStep('code');
      setCode('');
      setResendIn(Math.min(60, Math.max(15, Math.round(Number(timeout)) || 30)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(''); setLoading(true);
    try {
      const { role, needsName } = await verifyOtp(otpPhone, verificationId, code);
      // Missing name and/or email → ask now, mandatory, no skip; only a fully-complete profile
      // goes straight in.
      if (needsName) { setProfileName(''); setProfileEmail(''); setStep('name'); }
      else onSuccess(role);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const profileValid = isValidName(profileName) && isValidEmail(profileEmail);

  const handleSaveProfile = async () => {
    if (!profileValid) return;
    setError(''); setLoading(true);
    try {
      await updateProfile({ name: profileName.trim(), email: profileEmail.trim() });
      onSuccess('CUSTOMER'); // a brand-new phone signup is always a customer
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your details');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(''); setGoogleLoading(true);
    try {
      await loginWithGoogle(); // redirects to Google; page navigates away on success
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Google sign-in');
      setGoogleLoading(false);
    }
  };

  const inputStyle = authInput(desktop);

  /* Post-verify profile capture — mandatory, no skip: we need a real name + email on every
     account regardless of how they signed in, so this keeps showing until both are on file. */
  if (step === 'name') {
    return (
      <div style={{ textAlign: 'left' }}>
        <h2 style={{ font: `var(--weight-bold) var(${desktop ? '--text-h3' : '--text-h4'})/1.1 var(--font-display)`, color: 'var(--text-strong)', margin: '0 0 4px' }}>Almost there!</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: `0 0 ${desktop ? 20 : 12}px` }}>A couple of details so we can keep you posted on your order.</p>
        <label style={authLabel}>Full name</label>
        <input
          value={profileName}
          onChange={e => setProfileName(e.target.value)}
          placeholder="Your name" autoComplete="name" autoFocus
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <label style={authLabel}>Email address</label>
        <input
          value={profileEmail}
          onChange={e => setProfileEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && profileValid) handleSaveProfile(); }}
          placeholder="you@example.com" type="email" autoComplete="email"
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <button onClick={handleSaveProfile} disabled={loading || !profileValid} style={authPrimaryBtn(desktop, !loading && profileValid)}>
          {loading ? 'Saving…' : 'Continue'}{!loading && profileValid && <ArrowRight size={18} />}
        </button>
        {error && <div style={authErrorBox}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'left' }}>
      {/* 1) Phone OTP */}
      {step === 'phone' ? (
        <div>
          <label style={authLabel}>Mobile number</label>
          <div style={{ ...inputStyle, marginBottom: 8, padding: '0 14px', height: 46, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Phone size={17} color="var(--text-subtle)" />
            <span style={{ color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-base)' }}>+91</span>
            <span style={{ width: 1, height: 22, background: 'var(--border-default)' }} />
            <input
              value={otpPhone}
              onChange={e => setOtpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={e => { if (e.key === 'Enter' && otpPhone.length === 10) handleSendOtp(); }}
              placeholder="Mobile number" inputMode="numeric" autoComplete="tel" autoFocus={autoFocusPhone}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', minWidth: 0, letterSpacing: '.04em' }}
            />
          </div>
          <button onClick={handleSendOtp} disabled={loading || otpPhone.length !== 10} style={authPrimaryBtn(desktop, !loading && otpPhone.length === 10)}>
            {loading ? 'Sending…' : 'Send OTP'}{!loading && otpPhone.length === 10 && <ArrowRight size={18} />}
          </button>
          <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '6px 2px 0' }}>We&rsquo;ll text you a one-time code.</p>
        </div>
      ) : (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>Enter the code</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
              Sent to +91 {otpPhone}{' · '}
              <button onClick={() => { setStep('phone'); setCode(''); setError(''); setResendIn(0); }} style={authLinkBtn}>Change</button>
            </div>
          </div>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => { if (e.key === 'Enter' && code.length >= 4) handleVerifyOtp(); }}
            placeholder="••••" inputMode="numeric" autoComplete="one-time-code" autoFocus
            style={{ ...inputStyle, marginBottom: 10, textAlign: 'center', fontSize: '1.55rem', fontWeight: 800, letterSpacing: '.4em', textIndent: '.4em', padding: '10px 15px' }}
          />
          <button onClick={handleVerifyOtp} disabled={loading || code.length < 4} style={authPrimaryBtn(desktop, !loading && code.length >= 4)}>
            {loading ? 'Verifying…' : 'Verify & continue'}{!loading && code.length >= 4 && <ArrowRight size={18} />}
          </button>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            {resendIn > 0
              ? <span>Didn&rsquo;t get it? Resend in {resendIn}s</span>
              : <button onClick={handleSendOtp} disabled={loading} style={authLinkBtn}>Didn&rsquo;t get it? Resend OTP</button>}
          </div>
        </div>
      )}
      {error && <div style={authErrorBox}>{error}</div>}

      <Divider label="or" />

      {/* 2) Google */}
      <button onClick={handleGoogle} disabled={googleLoading} style={{ width: '100%', padding: '13px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-strong)', background: 'var(--surface-card)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', cursor: googleLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <GoogleG /> {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>
    </div>
  );
}
