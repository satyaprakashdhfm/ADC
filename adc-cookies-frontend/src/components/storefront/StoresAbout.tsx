import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Mail, Phone, MessageCircle } from 'lucide-react';
import { STORES } from '@/lib/stores';
import ContactForm from './ContactForm';
import { SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' };
const heading: React.CSSProperties = { font: '900 clamp(1.5rem,1.1rem + 1.7vw,2.25rem)/1.08 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 12px', color: 'var(--text-strong)' };
const subhead: React.CSSProperties = { font: '900 clamp(1.3rem,1rem + 1.3vw,1.85rem)/1.1 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 10px', color: 'var(--text-strong)' };
const body: React.CSSProperties = { fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--text-body)', margin: '0 0 16px', maxWidth: 600 };
const link: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)' };

const band = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({ padding: 'clamp(36px,5vw,72px) 0', background: bg, ...extra });
const inner: React.CSSProperties = { maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter)' };
const split: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px,4vw,56px)', alignItems: 'center' };
const col: React.CSSProperties = { flex: '1 1 320px', minWidth: 0 };
const imgWrap: React.CSSProperties = { position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' };
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 12, color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-sm)' };
const chipIcon: React.CSSProperties = { width: 38, height: 38, borderRadius: 11, background: 'var(--surface-card)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none', border: '1px solid var(--border-default)' };

/** Home page "About Us" — three alternating full-width bands (sand · cream · sand): story, our stores, get in touch. */
export default function StoresAbout() {
  return (
    <>
      {/* ── About us — sand band · text left, image right ── */}
      <section id="about" style={band('var(--band-sand)', { borderTop: '1px solid var(--border-default)' })}>
        <div style={inner}>
          <div style={split}>
            <div style={col}>
              <p style={eyebrow}>About Us</p>
              <h2 style={heading}>A Dough Cookie — baked fresh, served warm.</h2>
              <p style={body}>
                Warm, soft-centre cookies with premium fillings and gift-ready packaging — baked small in small batches so every centre stays soft and every bite smells like the oven.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {['Baked fresh daily', 'Premium fillings', 'Gift-ready tins', 'Bulk & corporate'].map(t => (
                  <span key={t} style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--orange-800)', fontWeight: 700, fontSize: 'var(--text-xs)' }}>{t}</span>
                ))}
              </div>
              <Link href="/about" style={link}>Read our full story <ArrowRight size={15} /></Link>
            </div>
            <div style={col}>
              <div style={imgWrap}>
                <Image src="/assets/cookies_new_images/cookie-sundae.jpeg" alt="A dough cookie sundae with warm cookies" fill sizes="(max-width:860px) 100vw, 540px" style={{ objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our stores — cream band · image left, details right ── */}
      <section id="stores" style={band('var(--cream-50)')}>
        <div style={inner}>
          <div style={split}>
            <div style={col}>
              <div style={imgWrap}>
                <Image src="/assets/gallery/ADC1.jpeg" alt="Inside a dough cookie store" fill sizes="(max-width:860px) 100vw, 540px" style={{ objectFit: 'cover' }} />
              </div>
            </div>
            <div style={col}>
              <p style={eyebrow}>Our Stores</p>
              <h3 style={subhead}>Find ADC across India</h3>
              <p style={{ ...body, marginBottom: 14 }}>Walk in for warm cookies, or order online for delivery from your nearest store.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {STORES.map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-image)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 1px' }}>{s.city}</p>
                      <h4 style={{ font: 'var(--weight-bold) var(--text-sm)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 2px' }}>{s.name}</h4>
                      <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</p>
                    </div>
                    <Link href={`/order?store=${encodeURIComponent(s.city.toLowerCase())}`} aria-label={`Order from ${s.name}`} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontWeight: 800, fontSize: 'var(--text-2xs)' }}><ShoppingBag size={12} /> Order</Link>
                  </div>
                ))}
              </div>
              <Link href="/locations" style={link}>View all locations <ArrowRight size={15} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Get in touch — sand band · contact left, form right ── */}
      <section id="get-in-touch" style={band('var(--band-sand)', { borderBottom: '1px solid var(--border-default)' })}>
        <div style={inner}>
          <div style={split}>
            <div style={col}>
              <p style={eyebrow}>Get in Touch</p>
              <h3 style={subhead}>Bulk orders, gifting or a question?</h3>
              <p style={{ ...body, marginBottom: 18 }}>Drop your details and our team will get back to you — fast. Or reach us directly:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={chip}>
                  <span style={{ ...chipIcon, background: 'var(--whatsapp-green)', color: '#fff', border: 'none' }}><MessageCircle size={17} /></span>
                  WhatsApp us
                </a>
                <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={chip}>
                  <span style={chipIcon}><Phone size={16} /></span>
                  {SITE_PHONE}
                </a>
                <a href={`mailto:${SITE_EMAIL}`} style={chip}>
                  <span style={chipIcon}><Mail size={16} /></span>
                  {SITE_EMAIL}
                </a>
              </div>
            </div>
            <div style={col}>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
