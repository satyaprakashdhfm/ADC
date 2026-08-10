'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { submitContact } from '@/lib/api';

const CORP_PACKAGES = [
  { name: 'Office Box', qty: '25 cookies', price: 'from ₹1,400', desc: 'A shareable mixed box for small teams and client desks.' },
  { name: 'Festive Hamper', qty: '50 cookies + tins', price: 'from ₹3,200', desc: 'Premium tins and assorted cookies, gift-wrapped with your note.' },
  { name: 'Custom Bulk', qty: '100+ cookies', price: 'Custom quote', desc: 'Branded packaging, logo cards, and tiered pricing for large orders.' },
];

export default function CorporatePanel() {
  const [f, setF] = useState({ name: '', company: '', email: '', phone: '', qty: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && f.qty.trim();
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
  const submit = async () => {
    if (!valid || status === 'sending') return;
    setStatus('sending');
    const message = `CORPORATE ENQUIRY\nCompany: ${f.company}\nApprox quantity: ${f.qty}\n\n${f.message}`;
    try { await submitContact({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || undefined, message }); } catch {}
    setStatus('done');
  };

  return (
    <div>
      <div style={{ background: 'var(--surface-inverse)', borderRadius: 'var(--radius-card)', padding: '26px 24px', color: 'var(--cream-100)', marginBottom: 18 }}>
        <div style={{ font: 'var(--weight-extra) var(--text-h3)/1.1 var(--font-display)', color: 'var(--white)', marginBottom: 8 }}>Corporate &amp; bulk gifting</div>
        <p style={{ color: 'var(--cream-100-72)', lineHeight: 1.6, margin: 0, fontSize: 'var(--text-sm)' }}>Cookies for teams, clients, and celebrations — freshly baked, neatly packed, and delivered together. Pick a package below or request a custom quote for large or branded orders.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
        {CORP_PACKAGES.map(p => (
          <div key={p.name} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: 18, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-base)' }}>{p.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 800, margin: '2px 0 8px' }}>{p.qty} · {p.price}</div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{p.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: 22, boxShadow: 'var(--shadow-sm)' }}>
        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Check size={28} strokeWidth={3} style={{ color: 'var(--white)' }} /></div>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', marginBottom: 4 }}>Request received!</div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>Our team will reach out with a custom quote shortly.</p>
          </div>
        ) : (
          <>
            <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)', marginBottom: 14 }}>Request a bulk quote</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input style={{ ...inp, flex: '1 1 160px' }} placeholder="Your name *" value={f.name} onChange={set('name')} />
                <input style={{ ...inp, flex: '1 1 160px' }} placeholder="Company" value={f.company} onChange={set('company')} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input style={{ ...inp, flex: '1 1 160px' }} type="email" placeholder="Email *" value={f.email} onChange={set('email')} />
                <input style={{ ...inp, flex: '1 1 160px' }} placeholder="Phone" value={f.phone} onChange={set('phone')} />
              </div>
              <input style={inp} placeholder="Approx quantity (e.g. 80 boxes) *" value={f.qty} onChange={set('qty')} />
              <textarea rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Occasion, branding, delivery date…" value={f.message} onChange={set('message')} />
              <button disabled={!valid || status === 'sending'} onClick={submit} style={{ padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: valid && status !== 'sending' ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: valid && status !== 'sending' ? 'pointer' : 'not-allowed' }}>{status === 'sending' ? 'Sending…' : 'Request quote'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Main App ---- */
