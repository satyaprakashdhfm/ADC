'use client';
import { useState, useEffect } from 'react';
import { Phone, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/*
 * After login, if the signed-in user has no phone number on file (Google / email sign-ups),
 * prompt once for it so we can send order updates. Phone-OTP users already have one, so they
 * never see this. Dismissible per browser session.
 */
const DISMISS_KEY = 'adc_phone_prompt_dismissed';

export default function ProfileGate() {
  const { user, loading, updateProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (loading) { setHidden(true); return; }
    const dismissed = typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1';
    setHidden(!user || !!user.phone || dismissed);
  }, [user, loading]);

  if (hidden || !user) return null;

  const save = async () => {
    setErr(''); setSaving(true);
    try {
      await updateProfile({ phone });
      setHidden(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const skip = () => { try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {} setHidden(true); };

  const inputWrap: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '0 14px', height: 50, marginBottom: 12,
    borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)',
    background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', gap: 10,
  };

  return (
    <div onClick={skip} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(20,12,4,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px,94vw)', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '26px 24px', animation: 'riseIn .3s var(--ease-spring) both' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--amber-50)', display: 'grid', placeItems: 'center', color: 'var(--brand-secondary)', marginBottom: 14 }}>
          <Phone size={24} />
        </div>
        <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>Add your phone number</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 18px' }}>So we can text you order updates and delivery alerts.</p>

        <div style={inputWrap}>
          <span style={{ color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-base)' }}>+91</span>
          <span style={{ width: 1, height: 22, background: 'var(--border-default)' }} />
          <input
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={e => { if (e.key === 'Enter' && phone.length === 10) save(); }}
            placeholder="Mobile number" inputMode="numeric" autoComplete="tel" autoFocus
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', minWidth: 0, letterSpacing: '.04em' }}
          />
        </div>
        {err && <div style={{ marginBottom: 10, fontSize: 'var(--text-sm)', color: 'var(--status-error)' }}>{err}</div>}

        <button onClick={save} disabled={saving || phone.length !== 10}
          style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: (saving || phone.length !== 10) ? 'var(--border-default)' : 'var(--gradient-warm)', color: (saving || phone.length !== 10) ? 'var(--text-subtle)' : '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: (saving || phone.length !== 10) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? 'Saving…' : 'Save number'}{!saving && phone.length === 10 && <ArrowRight size={18} />}
        </button>
        <button onClick={skip} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
