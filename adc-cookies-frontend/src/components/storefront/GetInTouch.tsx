import { Mail, Phone, MessageCircle } from 'lucide-react';
import ContactForm from './ContactForm';
import { SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';

/** Home page "Get in touch" — collects the visitor's contact details via the shared form. */
export default function GetInTouch() {
  return (
    <section id="get-in-touch" style={{ padding: 'clamp(48px,7vw,88px) 0' }}>
      <div className="contact-layout" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)', display: 'grid', gridTemplateColumns: '1fr minmax(320px,460px)', gap: 'clamp(28px,4vw,52px)', alignItems: 'start' }}>
        <div>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 12px' }}>Get in Touch</p>
          <h2 style={{ font: '900 clamp(2rem,1.5rem + 2.6vw,3.2rem)/1 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 16px' }}>Leave your details and we&apos;ll reach out.</h2>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.7, color: 'var(--text-body)', margin: '0 0 24px', maxWidth: 520 }}>
            Have a bulk order, a gifting request, or a question about our cookies? Drop your details and our team will get back to you — fast.
          </p>
          <div style={{ display: 'grid', gap: 12, color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-base)' }}>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-strong)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--whatsapp-green)', color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}><MessageCircle size={19} /></span>
              Chat on WhatsApp
            </a>
            <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-strong)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}><Phone size={18} /></span>
              {SITE_PHONE}
            </a>
            <a href={`mailto:${SITE_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-strong)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}><Mail size={18} /></span>
              {SITE_EMAIL}
            </a>
          </div>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
