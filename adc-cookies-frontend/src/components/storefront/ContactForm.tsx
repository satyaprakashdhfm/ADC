'use client';
import { useState } from 'react';
import { Send, Check } from 'lucide-react';
import { submitContact } from '@/lib/api';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Quick-pick topics so people don't stare at a blank box — each drops in a starter line
// they can edit. (The full free-text box stays, so anything goes.)
const TOPIC_STARTERS: Record<string, string> = {
  'Bulk / corporate order': 'I’d like to place a bulk / corporate order for ',
  'Gifting order': 'I’d like to send cookies as a gift — ',
  'Franchise / partnership': 'I’m interested in a franchise / partnership. ',
  'Order or delivery help': 'I need help with my order / delivery. ',
  'Custom / theme cookies': 'I’d like custom / themed cookies for ',
  'Feedback': 'I’d like to share some feedback: ',
  'Something else': '',
};
const TOPICS = Object.keys(TOPIC_STARTERS);

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)',
  border: '1.5px solid var(--border-default)', background: '#FFF4DF',
  fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)',
};
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 };

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [hp, setHp] = useState(''); // honeypot — real visitors never see/fill this; bots that auto-fill every field do
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  // Picking a topic drops in a starter line — but never clobbers text the user has typed
  // themselves (only replaces an empty box or a previously-inserted starter).
  const pickTopic = (t: string) => {
    setTopic(t);
    const starters = Object.values(TOPIC_STARTERS);
    setForm(f => ({ ...f, message: (!f.message || starters.includes(f.message)) ? TOPIC_STARTERS[t] : f.message }));
  };

  const valid = form.name.trim() && isEmail(form.email.trim()) && form.message.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || status === 'sending') return;
    setStatus('sending'); setError('');
    try {
      await submitContact({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, message: form.message.trim(), company: hp });
      setStatus('done');
      setForm({ name: '', email: '', phone: '', message: '' });
      setTopic('');
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
      {/* Honeypot — invisible to real visitors, tabIndex -1 so keyboard users never land on it. */}
      <input
        type="text" name="company" value={hp} onChange={e => setHp(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
      <div>
        <label style={labelStyle} htmlFor="cf-name">Your name *</label>
        <input id="cf-name" style={inputStyle} placeholder="Your full name" value={form.name} onChange={set('name')} />
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {TOPICS.map(t => {
            const on = topic === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => pickTopic(t)}
                style={{
                  padding: '7px 13px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                  border: `1.5px solid ${on ? 'var(--brand-secondary)' : 'var(--border-default)'}`,
                  background: on ? 'var(--gradient-warm)' : '#FFF4DF',
                  color: on ? 'var(--white)' : 'var(--text-body)',
                  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)',
                  boxShadow: on ? 'var(--shadow-brand)' : 'none', transition: 'all .15s ease',
                }}
              >{t}</button>
            );
          })}
        </div>
        <textarea id="cf-message" rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Pick a topic above, or tell us about your order, gifting, or bulk request…" value={form.message} onChange={set('message')} />
      </div>
      {status === 'error' && <div style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{error}</div>}
      <button type="submit" disabled={!valid || status === 'sending'} style={{ padding: '15px', borderRadius: 'var(--radius-button)', border: 'none', background: valid && status !== 'sending' ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: valid && status !== 'sending' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Send size={18} /> {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textAlign: 'center', margin: 0 }}>We&apos;ll only use your details to respond to your enquiry.</p>
    </form>
  );
}
