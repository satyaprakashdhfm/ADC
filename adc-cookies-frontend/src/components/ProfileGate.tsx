'use client';
import { useState, useEffect } from 'react';
import { ArrowRight, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isValidName, isValidEmail } from '@/lib/profileValidation';

/*
 * Catches everyone the OTP flow's own mandatory step doesn't: Google and email/password
 * logins never go through that step, so this is their one chance to be asked for whatever's
 * missing or below the bar — name, email, and (for Google/email users) phone. Mandatory, no
 * skip: an OTP login that already completed its own step arrives here with nothing left to
 * ask, so this simply stays quiet for them.
 */
export default function ProfileGate() {
  const { user, loading, profileLoaded, authModalOpen, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [needs, setNeeds] = useState<{ name: boolean; email: boolean; phone: boolean } | null>(null);

  useEffect(() => {
    // Wait for the authoritative /me profile before deciding — the instant session-metadata
    // user often lacks the phone/email, and acting on it made the prompt flash up then vanish.
    // Also stay quiet while a LoginModal is open: the phone-OTP path runs its own mandatory
    // name+email step inside that same popup right after verifying, and `user`/`profileLoaded`
    // update at that exact moment too — without this guard, this gate popped up underneath it
    // at the same time asking for the same details a second time.
    if (loading || !profileLoaded || !user || authModalOpen) { setNeeds(null); return; }
    const need = { name: !isValidName(user.name), email: !isValidEmail(user.email), phone: !user.phone };
    setNeeds(need.name || need.email || need.phone ? need : null);
    setName(''); setEmail(''); setPhone(''); setErr('');
  }, [user, loading, profileLoaded, authModalOpen]);

  if (!needs || !user) return null;

  const nameOk = !needs.name || isValidName(name);
  const emailOk = !needs.email || isValidEmail(email);
  const phoneOk = !needs.phone || phone.length === 10;
  const valid = nameOk && emailOk && phoneOk;

  const save = async () => {
    if (!valid) return;
    setErr(''); setSaving(true);
    try {
      const patch: { name?: string; email?: string; phone?: string } = {};
      if (needs.name) patch.name = name.trim();
      if (needs.email) patch.email = email.trim();
      if (needs.phone) patch.phone = phone;
      await updateProfile(patch);
      setNeeds(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 15px', marginBottom: 12,
    borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)',
    background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)',
    color: 'var(--text-strong)', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700,
    color: 'var(--text-muted)', letterSpacing: '.02em', margin: '0 0 6px 2px',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--espresso-50)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(420px,94vw)', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '26px 24px', animation: 'riseIn .3s var(--ease-spring) both' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--amber-50)', display: 'grid', placeItems: 'center', color: 'var(--brand-secondary)', marginBottom: 14 }}>
          <UserIcon size={24} />
        </div>
        <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>
          Almost there!
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 18px' }}>
          A couple of details so we can keep you posted on your order.
        </p>

        {needs.name && (
          <>
            <label style={labelStyle}>Full name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" autoFocus style={inputStyle} />
          </>
        )}
        {needs.email && (
          <>
            <label style={labelStyle}>Email address</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" autoFocus={!needs.name} style={inputStyle} />
          </>
        )}
        {needs.phone && (
          <>
            <label style={labelStyle}>Mobile number</label>
            <div style={{ ...inputStyle, padding: '0 14px', height: 50, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-base)' }}>+91</span>
              <span style={{ width: 1, height: 22, background: 'var(--border-default)' }} />
              <input
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={e => { if (e.key === 'Enter' && valid) save(); }}
                placeholder="Mobile number" inputMode="numeric" autoComplete="tel" autoFocus={!needs.name && !needs.email}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', minWidth: 0, letterSpacing: '.04em' }}
              />
            </div>
          </>
        )}
        {err && <div style={{ marginBottom: 10, fontSize: 'var(--text-sm)', color: 'var(--status-error)' }}>{err}</div>}

        <button onClick={save} disabled={saving || !valid}
          style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: (saving || !valid) ? 'var(--border-default)' : 'var(--gradient-warm)', color: (saving || !valid) ? 'var(--text-subtle)' : 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: (saving || !valid) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? 'Saving…' : 'Continue'}{!saving && valid && <ArrowRight size={18} />}
        </button>
      </div>
    </div>
  );
}
