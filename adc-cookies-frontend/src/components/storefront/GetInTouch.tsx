'use client';
import { useState } from 'react';
import { Mail, Phone, MessageCircle, ChevronDown } from 'lucide-react';
import ContactForm from './ContactForm';
import { SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-strong)',
  fontWeight: 700, fontSize: 'var(--text-sm)',
};

/** "Get in touch" — rendered as a block inside the home About section (contact links + toggle form). */
export default function GetInTouch() {
  const [open, setOpen] = useState(false);
  return (
    <div id="get-in-touch" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Get in Touch</p>
      <h3 style={{ font: '900 clamp(1.2rem,1rem + 1vw,1.65rem)/1.1 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 8px', color: 'var(--text-strong)' }}>Bulk orders, gifting or a question?</h3>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', lineHeight: 1.6, margin: '0 auto 18px', maxWidth: 520 }}>Drop your details and our team will get back to you — fast.</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(16px,2.4vw,32px)', flexWrap: 'wrap', marginBottom: 18 }}>
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={chip}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--whatsapp-green)', color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}><MessageCircle size={16} /></span>
          WhatsApp
        </a>
        <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={chip}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface-card)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none', border: '1px solid var(--border-default)' }}><Phone size={15} /></span>
          {SITE_PHONE}
        </a>
        <a href={`mailto:${SITE_EMAIL}`} style={chip}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface-card)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none', border: '1px solid var(--border-default)' }}><Mail size={15} /></span>
          Email
        </a>
      </div>

      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 24px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-brand)' }}
      >
        {open ? 'Close' : 'Leave your details'} <ChevronDown size={17} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{ maxWidth: 460, margin: '20px auto 0', textAlign: 'left' }}>
          <ContactForm />
        </div>
      )}
    </div>
  );
}
