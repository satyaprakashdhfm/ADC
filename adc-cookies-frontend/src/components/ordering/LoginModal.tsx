'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (open) { setError(''); setEmail(''); setPassword(''); setName(''); setPhone(''); }
  }, [open]);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      let role = 'CUSTOMER';
      if (mode === 'login') {
        role = await login(email, password);
      } else {
        await register(name, email, phone, password);
      }
      onSuccess?.();
      onClose();
      // Admins belong in the dashboard, not the storefront.
      if (role === 'ADMIN') router.push('/admin');
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
        <div style={{ height: 230, position: 'relative', overflow: 'hidden', background: '#160D06' }}>
          <Image src="/assets/login-bg.jpg" alt="" fill priority sizes="440px" style={{ objectFit: 'cover', opacity: 0.4 }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.9)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <X size={18} color="var(--text-strong)" />
          </button>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Image src="/assets/adc-logo.png" width={232} height={168} alt="a dough cookie" priority style={{ height: 188, width: 'auto', maxWidth: '84%', objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.55))' }} />
          </div>
        </div>

        <div style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 20px' }}>
            {mode === 'login' ? 'Log in to order and track cookies.' : 'Join to start ordering premium cookies.'}
          </p>

          {mode === 'register' && (
            <>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" style={inputStyle} />
            </>
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" style={inputStyle} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" style={inputStyle} />

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>{error}</div>
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
            {loading ? 'Please wait...' : (mode === 'login' ? 'Log in' : 'Create account')}
            {!loading && <ArrowRight size={18} />}
          </button>

          <button
            onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', textAlign: 'center' }}
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>

          {/* Demo account (customer only — admin signs in at /admin) */}
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-body)' }}>Demo account:</strong><br />
            priya@example.com / priya123
          </div>
        </div>
      </div>
    </div>
  );
}
