'use client';
import { useState } from 'react';
import { Send, Check } from 'lucide-react';
import { submitContact } from '@/lib/api';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)',
  border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)',
  fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)',
};
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 };

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const valid = form.name.trim() && isEmail(form.email.trim()) && form.message.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || status === 'sending') return;
    setStatus('sending'); setError('');
    try {
      await submitContact({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, message: form.message.trim() });
      setStatus('done');
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.');
    }
  };

  if (status === 'done') {
    return (
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 26, padding: '40px 28px', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}><Check size={32} strokeWidth={3} style={{ color: 'var(--white)' }} /></div>
        <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: 8 }}>Thanks — we&apos;ve got it!</h3>
        <p style={{ color: 'var(--text-body)', lineHeight: 1.7, marginBottom: 20 }}>Our team will reach out to you shortly at the details you shared.</p>
        <button onClick={() => setStatus('idle')} style={{ padding: '11px 22px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Send another message</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 26, padding: 24, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle} htmlFor="cf-name">Your name *</label>
        <input id="cf-name" style={inputStyle} placeholder="e.g. Satya Reddy" value={form.name} onChange={set('name')} />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={labelStyle} htmlFor="cf-email">Email *</label>
          <input id="cf-email" type="email" style={inputStyle} placeholder="you@email.com" value={form.email} onChange={set('email')} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle} htmlFor="cf-phone">Phone</label>
          <input id="cf-phone" style={inputStyle} placeholder="+91 …" value={form.phone} onChange={set('phone')} />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="cf-message">How can we help? *</label>
        <textarea id="cf-message" rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Tell us about your order, gifting, or bulk request…" value={form.message} onChange={set('message')} />
      </div>
      {status === 'error' && <div style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{error}</div>}
      <button type="submit" disabled={!valid || status === 'sending'} style={{ padding: '15px', borderRadius: 'var(--radius-button)', border: 'none', background: valid && status !== 'sending' ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: valid && status !== 'sending' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Send size={18} /> {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textAlign: 'center', margin: 0 }}>We&apos;ll only use your details to respond to your enquiry.</p>
    </form>
  );
}
