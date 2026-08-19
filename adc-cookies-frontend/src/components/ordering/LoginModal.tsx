'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isValidName, isValidEmail } from '@/lib/profileValidation';
import { useIsDesktop } from '@/lib/useIsDesktop';
import AuthPanel from '@/components/auth/AuthPanel';
import { Divider, authInput, authLinkBtn } from '@/components/auth/authUi';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/*
 * The full sign-in modal: phone OTP + Google (via AuthPanel, shared with the Spin & Win wheel),
 * with email + password kept underneath as the last resort. The OTP flow used to live inline
 * here; it moved out so the wheel could offer the same sign-in without stacking a second modal.
 */
export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Raised by AuthPanel while its mandatory name/email step is showing — see `dismissible`.
  const [locked, setLocked] = useState(false);
  const { login, register, resetPassword, setAuthModalOpen } = useAuth();
  // Compact sizing is for mobile only — desktop gets the roomier layout back.
  const desktop = useIsDesktop();

  useEffect(() => {
    if (open) {
      setError(''); setEmail(''); setPassword(''); setName(''); setPhone(''); setLoading(false);
      setResetSent(false); setLocked(false);
    }
  }, [open]);

  // Tells ProfileGate (a separate, globally-mounted component) to stay quiet while this modal is
  // open — otherwise it can pop up at the same time as AuthPanel's own mandatory name+email step
  // (both react to the same user/profileLoaded change right after OTP verification), looking like
  // two stacked popups fighting over the same job.
  useEffect(() => {
    if (open) { setAuthModalOpen(true); return () => setAuthModalOpen(false); }
  }, [open, setAuthModalOpen]);

  // Name + phone are mandatory on sign-up, same as the OTP path — no skipping either flow.
  const submitValid = mode === 'login'
    ? !!email.trim() && !!password.trim()
    : isValidName(name) && !!phone.trim() && isValidEmail(email) && !!password.trim();

  /* No admin redirect. This modal signs customers in, full stop — the dashboard is reached only
     through its own phone-OTP sign-in at /admin. */
  const finishLogin = () => {
    onSuccess?.();
    onClose();
  };

  const handleSubmit = async () => {
    if (!submitValid) return;
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, phone, password);
      finishLogin();
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

  const inputStyle = authInput(desktop);

  if (!open) return null;

  // Mandatory, no-skip: once AuthPanel is asking for the missing name/email, the modal can't be
  // dismissed via backdrop or the X — closing it any other way would let them in without either.
  const dismissible = !locked;
  const dismiss = () => { if (dismissible) onClose(); };

  return (
    <div onClick={dismiss} style={{
      position: 'fixed', inset: 0, zIndex: 120, background: 'var(--espresso-50)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        zIndex: 121, width: desktop ? '460px' : 'min(420px,92vw)', maxHeight: desktop ? '92vh' : '88vh', background: 'var(--surface-page)',
        borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'riseIn .3s var(--ease-spring) both',
      }}>
        {/* Header — cookie photo kept faint in the background, big logo on top */}
        <div style={{ height: desktop ? 190 : 120, position: 'relative', overflow: 'hidden', background: 'var(--ink-950)', flex: 'none' }}>
          <Image src="/assets/login-bg.jpg" alt="" fill priority sizes="460px" style={{ objectFit: 'cover', opacity: 0.4 }} />
          {dismissible && (
          <button onClick={dismiss} style={{ position: 'absolute', top: desktop ? 14 : 10, right: desktop ? 14 : 10, zIndex: 2, width: desktop ? 38 : 32, height: desktop ? 38 : 32, borderRadius: '50%', border: 'none', background: 'var(--white-90)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <X size={desktop ? 18 : 16} color="var(--text-strong)" />
          </button>
          )}
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Image src="/assets/adc-logo.png" width={232} height={168} alt="a dough cookie" priority style={{ height: desktop ? 150 : 90, width: 'auto', maxWidth: '82%', objectFit: 'contain', filter: 'drop-shadow(0 4px 16px var(--black-55))' }} />
          </div>
        </div>

        <div className="hide-sb" style={{ padding: desktop ? '26px 28px 30px' : '16px 20px 18px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* While the panel is locked it owns the whole body — its own heading, and nothing else
              competing for the tap. */}
          {!locked && (
            <>
              <h2 style={{ font: `var(--weight-bold) var(${desktop ? '--text-h3' : '--text-h4'})/1.1 var(--font-display)`, color: 'var(--text-strong)', margin: '0 0 4px' }}>Log in or sign up</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: `0 0 ${desktop ? 20 : 12}px` }}>Order and track your fresh cookies.</p>
            </>
          )}

          <AuthPanel onSuccess={finishLogin} onLockChange={setLocked} resetKey={open} autoFocusPhone />

          {!locked && (
            <>
              <Divider label="or use email" />

              {/* Email + password (last) */}
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
                  ? <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)', fontWeight: 700, margin: '0 2px 12px' }}>Reset link sent. Check your email to set a new password.</p>
                  : <button onClick={handleForgot} disabled={loading} style={{ ...authLinkBtn, display: 'block', margin: '0 2px 12px', fontSize: 'var(--text-xs)' }}>Forgot password?</button>
              )}

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>{error}</div>
              )}

              <button onClick={handleSubmit} disabled={loading || !submitValid} style={{
                width: '100%', padding: '14px', borderRadius: 'var(--radius-button)', border: 'none',
                background: (loading || !submitValid) ? 'var(--border-default)' : 'var(--gradient-warm)', color: 'var(--white)',
                fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: (loading || !submitValid) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12,
              }}>
                {loading ? 'Please wait…' : (mode === 'login' ? 'Log in with email' : 'Create account')}
                {!loading && submitValid && <ArrowRight size={18} />}
              </button>

              <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', textAlign: 'center' }}>
                {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
