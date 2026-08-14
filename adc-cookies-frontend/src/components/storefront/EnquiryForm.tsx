'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, Check } from 'lucide-react';
import { submitContact } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PHONE_RE } from '@/lib/indiaAddress';

/*
 * One enquiry form, three purposes: general contact, franchise/partnership, and bulk/corporate.
 * They share validation, honeypot, submit and success handling — only the extra fields, copy and
 * topic chips differ, which is what VARIANTS below describes.
 *
 * The backend /contact endpoint only accepts name/email/phone/message (`company` is the honeypot,
 * NOT a real field), so variant-specific answers are folded into the message under a clear header.
 * That keeps every enquiry in one inbox — which is the requirement — while still arriving readable.
 */

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export type EnquiryVariant = 'contact' | 'franchise' | 'bulk';

interface ExtraField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  /** Sits two-per-row on wide screens instead of full width. */
  half?: boolean;
  type?: 'text' | 'number' | 'date';
}

interface VariantConfig {
  /** Prefix line that makes the enquiry type obvious in the inbox. */
  heading: string;
  messageLabel: string;
  messagePlaceholder: string;
  submitLabel: string;
  successTitle: string;
  successBody: string;
  extras: ExtraField[];
  topics?: Record<string, string>;
}

const VARIANTS: Record<EnquiryVariant, VariantConfig> = {
  contact: {
    heading: 'GENERAL ENQUIRY',
    messageLabel: 'How can we help? *',
    messagePlaceholder: 'Pick a topic above, or tell us what you need…',
    submitLabel: 'Send message',
    successTitle: 'Thanks — we’ve got it!',
    successBody: 'Our team will reach out to you shortly at the details you shared.',
    extras: [],
    topics: {
      'Order or delivery help': 'I need help with my order / delivery. ',
      'Gifting order': 'I’d like to send cookies as a gift — ',
      'Custom / theme cookies': 'I’d like custom / themed cookies for ',
      'Feedback': 'I’d like to share some feedback: ',
      'Something else': '',
    },
  },
  franchise: {
    heading: 'FRANCHISE / PARTNERSHIP ENQUIRY',
    messageLabel: 'Tell us about yourself *',
    messagePlaceholder: 'Your background, why you’re interested in an ADC franchise, any retail or F&B experience…',
    submitLabel: 'Submit franchise enquiry',
    successTitle: 'Enquiry received — thank you!',
    successBody: 'Our franchise team will review your details and get back to you within 3–5 working days.',
    extras: [
      { key: 'City of interest', label: 'Preferred city / area *', placeholder: 'e.g. Bengaluru — Indiranagar', required: true, half: true },
      { key: 'Investment capacity', label: 'Investment capacity', placeholder: 'e.g. ₹15–25 lakhs', half: true },
      { key: 'Do you have a site', label: 'Do you already have a site?', placeholder: 'Yes / No — with details if yes', half: true },
      { key: 'F&B experience', label: 'Retail / F&B experience', placeholder: 'e.g. 3 years running a café', half: true },
    ],
  },
  bulk: {
    heading: 'BULK / CORPORATE ORDER ENQUIRY',
    messageLabel: 'Anything else we should know? *',
    messagePlaceholder: 'Flavours you have in mind, branding or custom packaging needs, budget, delivery address…',
    submitLabel: 'Request a quote',
    successTitle: 'Quote request received!',
    successBody: 'Our corporate team will send you a quote within one working day.',
    extras: [
      { key: 'Company / organisation', label: 'Company / organisation *', placeholder: 'Your company name', required: true, half: true },
      { key: 'Occasion', label: 'Occasion', placeholder: 'e.g. Diwali gifting, office event', half: true },
      { key: 'Approx quantity', label: 'Approx. cookies needed *', placeholder: 'e.g. 250 cookies', required: true, half: true, type: 'text' },
      { key: 'Needed by', label: 'Needed by', placeholder: '', half: true, type: 'date' },
    ],
  },
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)',
  border: '1.5px solid var(--border-default)', background: 'var(--surface-field)',
  fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)',
};
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 };

export default function EnquiryForm({ variant = 'contact', bare = false }: { variant?: EnquiryVariant; bare?: boolean }) {
  const cfg = VARIANTS[variant];
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [hp, setHp] = useState(''); // honeypot — real visitors never see/fill this; bots that auto-fill every field do
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');

  /*
   * Fill in what we already know about a signed-in visitor, and let them change any of it.
   *
   * Only ever writes into a field that is still EMPTY, and only once per account — otherwise
   * clearing a box to correct it would refill itself under the cursor, and an enquiry sent on
   * someone else's behalf could not be addressed to them. `prefilledFor` is what makes it once:
   * AuthContext re-renders on refresh and refocus, and without it every one of those would reapply.
   */
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    const who = user ? (user.email || user.phone || '') : '';
    if (!who || prefilledFor.current === who) return;
    prefilledFor.current = who;
    setForm(f => ({
      ...f,
      name: f.name || user?.name || '',
      email: f.email || user?.email || '',
      phone: f.phone || user?.phone || '',
    }));
  }, [user]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const setExtra = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setExtras(x => ({ ...x, [k]: e.target.value }));

  // Picking a topic drops in a starter line — but never clobbers text the user has typed
  // themselves (only replaces an empty box or a previously-inserted starter).
  const pickTopic = (t: string) => {
    if (!cfg.topics) return;
    setTopic(t);
    const starters = Object.values(cfg.topics);
    setForm(f => ({ ...f, message: (!f.message || starters.includes(f.message)) ? cfg.topics![t] : f.message }));
  };

  const missingExtra = cfg.extras.some(f => f.required && !(extras[f.key] || '').trim());
  // A phone number is required, not optional. Every one of these enquiries — a bulk order, a
  // franchise question, a problem with a delivery — is answered by calling somebody back, and an
  // email address alone turns a two-minute call into a thread.
  const phoneOk = PHONE_RE.test(form.phone.replace(/\D/g, ''));
  const valid = !!form.name.trim() && isEmail(form.email.trim()) && phoneOk && !!form.message.trim() && !missingExtra;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || status === 'sending') return;
    setStatus('sending'); setError('');
    const answered = cfg.extras
      .map(f => [f.label.replace(/\s*\*$/, ''), (extras[f.key] || '').trim()] as const)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    const message = [cfg.heading, ...answered, '', form.message.trim()].join('\n');
    try {
      await submitContact({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), message, company: hp });
      setStatus('done');
      // Clear what they wrote, keep who they are — a signed-in visitor sending a second
      // enquiry should not retype their own details.
      setForm({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', message: '' });
      setExtras({}); setTopic('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.');
    }
  };

  const shell: React.CSSProperties = bare
    ? { display: 'flex', flexDirection: 'column', gap: 14 }
    : { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 26, padding: 24, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 14 };

  if (status === 'done') {
    return (
      <div style={bare ? { textAlign: 'center', padding: '20px 0' } : { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 26, padding: '40px 28px', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}><Check size={32} strokeWidth={3} style={{ color: 'var(--white)' }} /></div>
        <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: 8 }}>{cfg.successTitle}</h3>
        <p style={{ color: 'var(--text-body)', lineHeight: 1.7, marginBottom: 20 }}>{cfg.successBody}</p>
        <button onClick={() => setStatus('idle')} style={{ padding: '11px 22px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Send another</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={shell}>
      {/* Honeypot — invisible to real visitors, tabIndex -1 so keyboard users never land on it. */}
      <input
        type="text" name="company" value={hp} onChange={e => setHp(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
      <div>
        <label style={labelStyle} htmlFor={`ef-${variant}-name`}>Your name *</label>
        <input id={`ef-${variant}-name`} style={inputStyle} placeholder="Your full name" value={form.name} onChange={set('name')} autoComplete="name" />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={labelStyle} htmlFor={`ef-${variant}-email`}>Email *</label>
          <input id={`ef-${variant}-email`} type="email" style={inputStyle} placeholder="you@email.com" value={form.email} onChange={set('email')} autoComplete="email" />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle} htmlFor={`ef-${variant}-phone`}>Phone *</label>
          <input id={`ef-${variant}-phone`} type="tel" inputMode="tel" style={inputStyle} placeholder="+91 …" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          {form.phone.trim().length > 0 && !phoneOk && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 600, marginTop: 5 }}>Enter a valid 10-digit mobile number.</div>
          )}
        </div>
      </div>

      {cfg.extras.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {cfg.extras.map(f => (
            <div key={f.key} style={{ flex: f.half ? '1 1 200px' : '1 1 100%', minWidth: 0 }}>
              <label style={labelStyle} htmlFor={`ef-${variant}-${f.key}`}>{f.label}</label>
              <input id={`ef-${variant}-${f.key}`} type={f.type || 'text'} style={inputStyle} placeholder={f.placeholder} value={extras[f.key] || ''} onChange={setExtra(f.key)} />
            </div>
          ))}
        </div>
      )}

      <div>
        <label style={labelStyle} htmlFor={`ef-${variant}-message`}>{cfg.messageLabel}</label>
        {cfg.topics && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {Object.keys(cfg.topics).map(t => {
              const on = topic === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickTopic(t)}
                  style={{
                    padding: '7px 13px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                    border: `1.5px solid ${on ? 'var(--brand-secondary)' : 'var(--border-default)'}`,
                    background: on ? 'var(--gradient-warm)' : 'var(--surface-field)',
                    color: on ? 'var(--white)' : 'var(--text-body)',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)',
                    boxShadow: on ? 'var(--shadow-brand)' : 'none', transition: 'all .15s ease',
                  }}
                >{t}</button>
              );
            })}
          </div>
        )}
        <textarea id={`ef-${variant}-message`} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder={cfg.messagePlaceholder} value={form.message} onChange={set('message')} />
      </div>

      {status === 'error' && <div style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{error}</div>}
      <button type="submit" disabled={!valid || status === 'sending'} style={{ padding: '15px', borderRadius: 'var(--radius-button)', border: 'none', background: valid && status !== 'sending' ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: valid && status !== 'sending' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Send size={18} /> {status === 'sending' ? 'Sending…' : cfg.submitLabel}
      </button>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textAlign: 'center', margin: 0 }}>We&apos;ll only use your details to respond to your enquiry.</p>
    </form>
  );
}
