'use client';
import { useState, useEffect } from 'react';
import { Phone, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/*
 * After login, prompt once (per browser session) for a missing contact detail:
 *   - Google / email users with no phone → ask for a phone (delivery SMS).
 *   - Phone-OTP users with no email      → ask for an email (optional).
 * We never fabricate either value — skipping simply leaves it blank. Each field is
 * dismissed independently so skipping one doesn't suppress the other.
 */
const DISMISS_KEY = 'adc_profile_prompt_dismissed'; // comma list of skipped fields

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfileGate() {
  const { user, loading, updateProfile } = useAuth();
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [field, setField] = useState<'phone' | 'email' | null>(null);

  useEffect(() => {
    if (loading || !user) { setField(null); return; }
    let skipped: string[] = [];
    try { skipped = (sessionStorage.getItem(DISMISS_KEY) || '').split(',').filter(Boolean); } catch {}
    // Phone first (needed for delivery), then email.
    const need: 'phone' | 'email' | null =
      !user.phone && !skipped.includes('phone') ? 'phone'
      : !user.email && !skipped.includes('email') ? 'email'
      : null;
    setField(need); setValue(''); setErr('');
  }, [user, loading]);

  if (!field || !user) return null;

  const isPhone = field === 'phone';
  const valid = isPhone ? value.length === 10 : EMAIL_RE.test(value.trim());

  const save = async () => {
    if (!valid) return;
    setErr(''); setSaving(true);
    try {
      await updateProfile(isPhone ? { phone: value } : { email: value.trim() });
      setField(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };
  const skip = () => {
    try {
      const cur = (sessionStorage.getItem(DISMISS_KEY) || '').split(',').filter(Boolean);
      sessionStorage.setItem(DISMISS_KEY, [...new Set([...cur, field])].join(','));
    } catch {}
    setField(null);
  };

  const Icon = isPhone ? Phone : Mail;
  const inputWrap: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '0 14px', height: 50, marginBottom: 12,
    borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)',
    background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', gap: 10,
  };

  return (
    <div onClick={skip} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--espresso-50)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px,94vw)', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '26px 24px', animation: 'riseIn .3s var(--ease-spring) both' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--amber-50)', display: 'grid', placeItems: 'center', color: 'var(--brand-secondary)', marginBottom: 14 }}>
          <Icon size={24} />
        </div>
        <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>
          {isPhone ? 'Add your phone number' : 'Add your email'}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 18px' }}>
          {isPhone ? 'So we can text you order updates and delivery alerts.' : 'Optional — for order confirmations and receipts by email.'}
        </p>

        <div style={inputWrap}>
          {isPhone && <>
            <span style={{ color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-base)' }}>+91</span>
            <span style={{ width: 1, height: 22, background: 'var(--border-default)' }} />
          </>}
          <input
            value={value}
            onChange={e => setValue(isPhone ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            placeholder={isPhone ? 'Mobile number' : 'you@example.com'}
            inputMode={isPhone ? 'numeric' : 'email'} type={isPhone ? 'text' : 'email'}
            autoComplete={isPhone ? 'tel' : 'email'} autoFocus
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', minWidth: 0, letterSpacing: isPhone ? '.04em' : 'normal' }}
          />
        </div>
        {err && <div style={{ marginBottom: 10, fontSize: 'var(--text-sm)', color: 'var(--status-error)' }}>{err}</div>}

        <button onClick={save} disabled={saving || !valid}
          style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: (saving || !valid) ? 'var(--border-default)' : 'var(--gradient-warm)', color: (saving || !valid) ? 'var(--text-subtle)' : 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: (saving || !valid) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? 'Saving…' : (isPhone ? 'Save number' : 'Save email')}{!saving && valid && <ArrowRight size={18} />}
        </button>
        <button onClick={skip} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
