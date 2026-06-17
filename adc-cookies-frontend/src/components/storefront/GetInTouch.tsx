import { Mail, Phone, MessageCircle } from 'lucide-react';
import ContactForm from './ContactForm';
import { SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';

/** Home page "Get in touch" — collects the visitor's contact details via the shared form. */
export default function GetInTouch() {
  return (
    <section id="get-in-touch" style={{ padding: 'clamp(32px,4.5vw,56px) 0', background: 'linear-gradient(180deg, var(--amber-100), var(--amber-50))', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
      <div className="contact-layout" style={{ maxWidth: 1180, margin: '0 auto', padding: '0 var(--gutter)', display: 'grid', gridTemplateColumns: '1fr minmax(320px,440px)', gap: 'clamp(22px,3.5vw,48px)', alignItems: 'start' }}>
        <div>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Get in Touch</p>
          <h2 style={{ font: '900 clamp(1.4rem,1.1rem + 1.4vw,2rem)/1.05 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 10px' }}>Leave your details and we&apos;ll reach out.</h2>
          <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--text-body)', margin: '0 0 18px', maxWidth: 480 }}>
            Have a bulk order, a gifting request, or a question about our cookies? Drop your details and our team will get back to you — fast.
          </p>
          <div style={{ display: 'grid', gap: 9, color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-strong)' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--whatsapp-green)', color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}><MessageCircle size={16} /></span>
              Chat on WhatsApp
            </a>
            <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-strong)' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}><Phone size={15} /></span>
              {SITE_PHONE}
            </a>
            <a href={`mailto:${SITE_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-strong)' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}><Mail size={15} /></span>
              {SITE_EMAIL}
            </a>
          </div>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
