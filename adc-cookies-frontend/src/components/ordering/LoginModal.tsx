'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, ArrowRight, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Phone OTP flow
  const [otpStep, setOtpStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [otpPhone, setOtpPhone] = useState('');
  const [profileName, setProfileName] = useState(''); // collected only for brand-new accounts
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendIn, setResendIn] = useState(0); // seconds until "Resend OTP" re-enables
  const [resetSent, setResetSent] = useState(false);
  const { login, register, loginWithGoogle, resetPassword, sendOtp, verifyOtp, updateProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setError(''); setEmail(''); setPassword(''); setName(''); setPhone(''); setLoading(false); setGoogleLoading(false);
      setOtpStep('phone'); setOtpPhone(''); setProfileName(''); setVerificationId(''); setCode(''); setOtpLoading(false); setOtpError(''); setResendIn(0);
      setResetSent(false);
    }
  }, [open]);

  // Resend countdown — ticks down to 0, then "Resend OTP" becomes tappable again.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      let role = 'CUSTOMER';
      if (mode === 'login') role = await login(email, password);
      else await register(name, email, phone, password);
      onSuccess?.();
      onClose();
      if (role === 'ADMIN') router.push('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError('Enter your email above, then tap “Forgot password?”'); return; }
    setError(''); setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset email.');
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

  const handleSendOtp = async () => {
    setOtpError(''); setOtpLoading(true);
    try {
      const { verificationId: vid, timeout } = await sendOtp(otpPhone);
      setVerificationId(vid);
      setOtpStep('code');
      setCode('');
      setResendIn(Math.min(60, Math.max(15, Math.round(Number(timeout)) || 30)));
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const finishLogin = (role: string) => {
    onSuccess?.();
    onClose();
    if (role === 'ADMIN') router.push('/admin');
  };

  const handleVerifyOtp = async () => {
    setOtpError(''); setOtpLoading(true);
    try {
      const { role, needsName } = await verifyOtp(otpPhone, verificationId, code);
      // New number (or no name yet) → ask the name now; returning users go straight in.
      if (needsName) { setProfileName(''); setOtpStep('name'); }
      else finishLogin(role);
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSaveName = async () => {
    setOtpError(''); setOtpLoading(true);
    try {
      await updateProfile({ name: profileName.trim() });
      finishLogin('CUSTOMER'); // a brand-new phone signup is always a customer
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : 'Could not save your name');
    } finally {
      setOtpLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 15px',
    borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)',
    fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)',
    background: 'var(--surface-raised)', outline: 'none', marginBottom: 10,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700,
    color: 'var(--text-muted)', letterSpacing: '.02em', margin: '0 0 6px 2px',
  };
  const primaryBtn = (enabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '14px', borderRadius: 'var(--radius-button)', border: 'none',
    background: enabled ? 'var(--gradient-warm)' : 'var(--border-default)',
    color: enabled ? '#fff' : 'var(--text-subtle)',
    fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  });
  const linkBtn: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, color: '#b4561f',
    fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,12,4,.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        zIndex: 91, width: 'min(440px,94vw)', maxHeight: '92vh', background: 'var(--surface-page)',
        borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'riseIn .3s var(--ease-spring) both',
      }}>
        {/* Header — cookie photo kept faint in the background, big logo on top */}
        <div style={{ height: 190, position: 'relative', overflow: 'hidden', background: '#160D06', flex: 'none' }}>
          <Image src="/assets/login-bg.jpg" alt="" fill priority sizes="440px" style={{ objectFit: 'cover', opacity: 0.4 }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.9)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <X size={18} color="var(--text-strong)" />
          </button>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Image src="/assets/adc-logo.png" width={232} height={168} alt="a dough cookie" priority style={{ height: 150, width: 'auto', maxWidth: '82%', objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.55))' }} />
          </div>
        </div>

        <div className="hide-sb" style={{ padding: '22px 24px 26px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {otpStep === 'name' ? (
            /* Post-verify name capture — only shown for a brand-new phone signup. */
            <div>
              <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>Almost there!</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 18px' }}>What should we call you?</p>
              <label style={labelStyle}>Full name</label>
              <input
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && profileName.trim()) handleSaveName(); }}
                placeholder="Your name" autoComplete="name" autoFocus
                style={{ ...inputStyle, marginBottom: 14 }}
              />
              <button onClick={handleSaveName} disabled={otpLoading || !profileName.trim()} style={primaryBtn(!otpLoading && !!profileName.trim())}>
                {otpLoading ? 'Saving…' : 'Continue'}{!otpLoading && !!profileName.trim() && <ArrowRight size={18} />}
              </button>
              {otpError && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>{otpError}</div>
              )}
            </div>
          ) : (
          <>
          <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>Log in or sign up</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 18px' }}>Order and track your fresh cookies.</p>

          {/* 1) Phone OTP */}
          {otpStep === 'phone' ? (
            <div>
              <label style={labelStyle}>Mobile number</label>
              <div style={{ ...inputStyle, marginBottom: 12, padding: '0 14px', height: 50, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Phone size={17} color="var(--text-subtle)" />
                <span style={{ color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-base)' }}>+91</span>
                <span style={{ width: 1, height: 22, background: 'var(--border-default)' }} />
                <input
                  value={otpPhone}
                  onChange={e => setOtpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={e => { if (e.key === 'Enter' && otpPhone.length === 10) handleSendOtp(); }}
                  placeholder="Mobile number" inputMode="numeric" autoComplete="tel" autoFocus
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', minWidth: 0, letterSpacing: '.04em' }}
                />
              </div>
              <button onClick={handleSendOtp} disabled={otpLoading || otpPhone.length !== 10} style={primaryBtn(!otpLoading && otpPhone.length === 10)}>
                {otpLoading ? 'Sending…' : 'Send OTP'}{!otpLoading && otpPhone.length === 10 && <ArrowRight size={18} />}
              </button>
              <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '8px 2px 0' }}>We’ll text you a one-time code.</p>
            </div>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)' }}>Enter the code</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
                  Sent to +91 {otpPhone}{' · '}
                  <button onClick={() => { setOtpStep('phone'); setCode(''); setOtpError(''); setResendIn(0); }} style={linkBtn}>Change</button>
                </div>
              </div>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => { if (e.key === 'Enter' && code.length >= 4) handleVerifyOtp(); }}
                placeholder="••••" inputMode="numeric" autoComplete="one-time-code" autoFocus
                style={{ ...inputStyle, marginBottom: 14, textAlign: 'center', fontSize: '1.55rem', fontWeight: 800, letterSpacing: '.4em', textIndent: '.4em', padding: '12px 15px' }}
              />
              <button onClick={handleVerifyOtp} disabled={otpLoading || code.length < 4} style={primaryBtn(!otpLoading && code.length >= 4)}>
                {otpLoading ? 'Verifying…' : 'Verify & continue'}{!otpLoading && code.length >= 4 && <ArrowRight size={18} />}
              </button>
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                {resendIn > 0
                  ? <span>Didn’t get it? Resend in {resendIn}s</span>
                  : <button onClick={handleSendOtp} disabled={otpLoading} style={linkBtn}>Didn’t get it? Resend OTP</button>}
              </div>
            </div>
          )}
          {otpError && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>{otpError}</div>
          )}

          <Divider label="or" />

          {/* 2) Google */}
          <button onClick={handleGoogle} disabled={googleLoading} style={{ width: '100%', padding: '13px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-strong)', background: 'var(--surface-card)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', cursor: googleLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <GoogleG /> {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <Divider label="or use email" />

          {/* 3) Email + password (last) */}
          {mode === 'register' && (
            <>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" style={inputStyle} />
            </>
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" style={inputStyle} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" style={inputStyle} />

          {/* Reset is only relevant to the email/password login path (Google & OTP users never set one). */}
          {mode === 'login' && (
            resetSent
              ? <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)', fontWeight: 700, margin: '0 2px 12px' }}>Reset link sent — check your email to set a new password.</p>
              : <button onClick={handleForgot} disabled={loading} style={{ ...linkBtn, display: 'block', margin: '0 2px 12px', fontSize: 'var(--text-xs)' }}>Forgot password?</button>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', padding: '14px', borderRadius: 'var(--radius-button)', border: 'none',
            background: loading ? 'var(--border-default)' : 'var(--gradient-warm)', color: '#fff',
            fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12,
          }}>
            {loading ? 'Please wait…' : (mode === 'login' ? 'Log in with email' : 'Create account')}
            {!loading && <ArrowRight size={18} />}
          </button>

          <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', textAlign: 'center' }}>
            {mode === 'login' ? "New here? Create an account" : 'Already have an account? Log in'}
          </button>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
