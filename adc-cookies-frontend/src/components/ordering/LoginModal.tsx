'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { forgotPassword, resetPassword } from '@/lib/api';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Mode = 'login' | 'register' | 'forgot' | 'reset';

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setError(''); setSuccess('');
      setEmail(''); setPassword(''); setName(''); setPhone('');
      setOtp(''); setNewPassword('');
      setMode('login');
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const role = await login(email, password);
        onSuccess?.();
        onClose();
        if (role === 'ADMIN') router.push('/admin');
      } else if (mode === 'register') {
        await register(name, email, phone, password);
        onSuccess?.();
        onClose();
      } else if (mode === 'forgot') {
        await forgotPassword(email);
        setSuccess('OTP sent! Check your email.');
        setMode('reset');
      } else if (mode === 'reset') {
        await resetPassword(email, otp, newPassword);
        setSuccess('Password reset! You can now log in.');
        setMode('login');
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px',
    borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)',
    fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)',
    background: 'var(--surface-raised)', outline: 'none', marginBottom: 12,
  };

  const headings: Record<Mode, string> = {
    login: 'Welcome back',
    register: 'Create account',
    forgot: 'Forgot password',
    reset: 'Reset password',
  };
  const subheadings: Record<Mode, string> = {
    login: 'Log in to order and track cookies.',
    register: 'Join to start ordering premium cookies.',
    forgot: 'Enter your email and we\'ll send you an OTP.',
    reset: 'Enter the OTP from your email and a new password.',
  };
  const buttonLabels: Record<Mode, string> = {
    login: 'Log in',
    register: 'Create account',
    forgot: 'Send OTP',
    reset: 'Reset password',
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
        {/* Header image */}
        <div style={{ height: 200, background: 'var(--gradient-hero)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -20, top: 20, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(130% 130% at 34% 26%,#F8C24D,#EF7507)', boxShadow: 'var(--shadow-lg)' }} />
          <div style={{ position: 'absolute', right: 120, top: 120, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(130% 130% at 34% 26%,#FBD98A,#F29F05)', boxShadow: 'var(--shadow-md)' }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.8)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={18} />
          </button>
          <div style={{ position: 'absolute', left: 20, bottom: 16 }}>
            <Image src="/assets/adc-logo.png" width={120} height={60} alt="a dough cookie" style={{ objectFit: 'contain' }} />
          </div>
        </div>

        <div style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column' }}>
          {/* Back button for forgot/reset modes */}
          {(mode === 'forgot' || mode === 'reset') && (
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 12, padding: 0 }}
            >
              <ArrowLeft size={14} /> Back to login
            </button>
          )}

          <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>
            {headings[mode]}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 20px' }}>
            {subheadings[mode]}
          </p>

          {/* Register fields */}
          {mode === 'register' && (
            <>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" style={inputStyle} />
            </>
          )}

          {/* Email — shown for login, register, forgot, reset */}
          {(mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'reset') && (
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              style={{ ...inputStyle, ...(mode === 'reset' ? { background: 'var(--surface-sunken)', color: 'var(--text-muted)' } : {}) }}
              readOnly={mode === 'reset'}
            />
          )}

          {/* Password — login and register only */}
          {(mode === 'login' || mode === 'register') && (
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" style={inputStyle} />
          )}

          {/* OTP + new password — reset mode */}
          {mode === 'reset' && (
            <>
              <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="Enter OTP" style={{ ...inputStyle, letterSpacing: 4, fontWeight: 700 }} maxLength={6} />
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" type="password" style={inputStyle} />
            </>
          )}

          {/* Forgot password link — login mode only */}
          {mode === 'login' && (
            <button
              onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary, #EF7507)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, textAlign: 'right', marginBottom: 4, padding: 0 }}
            >
              Forgot password?
            </button>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>{error}</div>
          )}
          {success && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--status-success-bg, #f0fdf4)', color: 'var(--status-success, #16a34a)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>{success}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '15px', borderRadius: 'var(--radius-button)', border: 'none',
              background: loading ? 'var(--border-default)' : 'var(--gradient-warm)', color: '#fff',
              fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14,
            }}
          >
            {loading ? 'Please wait...' : buttonLabels[mode]}
            {!loading && <ArrowRight size={18} />}
          </button>

          {/* Toggle login/register */}
          {(mode === 'login' || mode === 'register') && (
            <button
              onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', textAlign: 'center' }}
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>
          )}

          {/* Demo account (customer only — admin signs in at /admin) */}
          {mode === 'login' && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-body)' }}>Demo account:</strong><br />
              priya@example.com / priya123
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
