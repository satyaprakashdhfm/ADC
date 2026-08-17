import Image from 'next/image';
import Link from 'next/link';
import { Gift, Building2, Truck, BadgeCheck, Mail, Phone, MessageCircle, ArrowRight } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
import EnquiryForm from '@/components/storefront/EnquiryForm';
import { SITE_EMAIL, SITE_PHONE, whatsappLink } from '@/lib/site';

export const metadata = {
  title: 'Corporate & Bulk Orders — a dough cookie',
  description: 'Cookie hampers for teams, clients and celebrations — custom branding, volume pricing and pan-India delivery. Request a quote from A Dough Cookie.',
};

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 };
const h2: React.CSSProperties = { font: '900 clamp(1.6rem,1.2rem + 1.8vw,2.4rem)/1.08 var(--font-display)', letterSpacing: '-.02em', marginBottom: 16, color: 'var(--text-strong)' };
const para: React.CSSProperties = { fontSize: 'var(--text-base)', lineHeight: 1.8, color: 'var(--text-body)', marginBottom: 18 };
/* On the peach band the standard orange eyebrow drops to ~2.2:1 against #FFCD90. Same label, a
   darker orange, so small uppercase type stays readable where the background is not cream. */
const eyebrowOnBand: React.CSSProperties = { ...eyebrow, color: 'var(--orange-800)' };
/* Cards on the peach band cannot use --surface-card: on .adc-pattern-page that token IS #FFCD90,
   the very colour of the band, so card and background rendered identically. Cream inverts the
   pairing — peach cards on cream above, cream cards on peach here. */
const onBandCard: React.CSSProperties = { background: 'var(--peach-100)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-md)' };

const PERKS = [
  { icon: Building2, title: 'Custom branding', text: 'Your logo on sleeves, tins and gift notes — so the box looks like it came from you, not from us.' },
  { icon: Gift, title: 'Curated hampers', text: 'Mix flavours, tin sizes and add-ons to land on any budget, from a modest thank-you to a flagship client gift.' },
  { icon: Truck, title: 'Pan-India delivery', text: 'One bulk despatch to your office, or individual parcels to a list of addresses across the country.' },
  { icon: BadgeCheck, title: 'Volume pricing', text: 'Rates improve as quantities grow. Tell us the number and we will quote it properly.' },
];

const OCCASIONS = ['Diwali & festive gifting', 'Client thank-yous', 'Employee onboarding kits', 'Office celebrations', 'Weddings & functions', 'Conferences & events'];

const STEPS = [
  { n: '01', title: 'Tell us what you need', text: 'Company, rough quantity, the occasion and when you need it by. The form below covers it.' },
  { n: '02', title: 'We send a quote', text: 'Within one working day, with flavour and packaging options at your quantity.' },
  { n: '03', title: 'We bake and deliver', text: 'Baked fresh close to your date — never pulled from a freezer — and despatched to wherever it needs to go.' },
];

export default function CorporatePage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />

      {/* ── Hero ── */}
      <section style={{ padding: '36px var(--gutter) 64px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(280px,440px)', gap: 'clamp(28px,4vw,56px)', alignItems: 'center' }} className="product-doc-hero">
          <div>
            <p style={eyebrow}>Corporate &amp; Bulk</p>
            <h1 style={{ font: '900 clamp(2.2rem,1.7rem + 3vw,4rem)/.98 var(--font-display)', letterSpacing: '-.02em', marginBottom: 20, color: 'var(--text-strong)' }}>
              Cookies by the hundred, done properly.
            </h1>
            <p style={{ ...para, fontSize: 'var(--text-lg)', maxWidth: 620 }}>
              Client gifting, office celebrations, weddings and events — handmade in small batches,
              packed to travel, and branded as yours. Tell us the number and we&apos;ll send a quote
              within one working day.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <a href="#quote" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 26px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-brand)' }}>
                Request a quote <ArrowRight size={18} />
              </a>
              <a href={whatsappLink('Hi! I’d like a quote for a bulk / corporate cookie order.')} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--whatsapp-green)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>
                <MessageCircle size={16} /> Or message us on WhatsApp
              </a>
            </div>
          </div>
          <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', aspectRatio: '4 / 5', position: 'relative' }}>
            <Image src="/assets/gallery/ADC5.jpeg" alt="A Dough Cookie gift tins" fill sizes="(max-width:760px) 100vw, 440px" priority style={{ objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      {/* ── What you get ── */}
      <section style={{ padding: 'clamp(30px,5vw,72px) 0', background: 'var(--gold)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <div style={{ maxWidth: 640, marginBottom: 'clamp(22px,3vw,40px)' }}>
            <p style={eyebrow}>What you get</p>
            <h2 style={h2}>Built around your order, not a fixed catalogue.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'clamp(14px,1.8vw,22px)' }}>
            {PERKS.map(({ icon: Icon, title, text }) => (
              <article key={title} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', padding: 'clamp(20px,2.2vw,28px)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                  <Icon size={21} />
                </span>
                <h3 style={{ font: 'var(--weight-extra) var(--text-lg)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 8px' }}>{title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--text-body)', margin: 0 }}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Occasions + how it works ── */}
      <section style={{ padding: 'clamp(30px,5vw,72px) 0', background: 'var(--band-ivory)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <div style={{ maxWidth: 640, marginBottom: 'clamp(18px,2.5vw,30px)' }}>
            <p style={eyebrowOnBand}>Popular for</p>
            <h2 style={h2}>Whatever the occasion.</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 'clamp(28px,4vw,52px)' }}>
            {OCCASIONS.map(o => (
              <span key={o} style={{ padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--peach-100)', border: '1px solid var(--border-strong)', color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{o}</span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'clamp(14px,1.8vw,22px)' }}>
            {STEPS.map(s => (
              <article key={s.n} style={{ ...onBandCard, padding: 'clamp(18px,2vw,26px)' }}>
                {/* Numeral paired with a rule that runs to the card edge — reads as an ordered
                    sequence rather than three unrelated boxes that happen to start with a digit. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ font: '900 clamp(1.5rem,1.1rem + 1vw,2.1rem)/1 var(--font-display)', color: 'var(--orange-600)', letterSpacing: '-.02em' }}>{s.n}</span>
                  <span aria-hidden style={{ flex: 1, height: 2, borderRadius: 2, background: 'var(--border-default)' }} />
                </div>
                <h3 style={{ font: 'var(--weight-extra) var(--text-lg)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 8px' }}>{s.title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.65, color: 'var(--text-body)', margin: 0 }}>{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── The quote form ── */}
      <section id="quote" style={{ padding: 'clamp(34px,5vw,80px) var(--gutter)', scrollMarginTop: 90 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(320px,520px)', gap: 'clamp(28px,4vw,48px)', alignItems: 'start' }} className="contact-layout">
          <div>
            <p style={eyebrow}>Request a quote</p>
            <h2 style={h2}>Tell us the number, we&apos;ll do the rest.</h2>
            <p style={para}>
              The more you can share — quantity, occasion, when you need it — the more precise the
              quote. Prefer to talk it through? Reach us directly:
            </p>
            <div style={{ display: 'grid', gap: 12, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
              <a href={whatsappLink('Hi! I’d like a quote for a bulk / corporate cookie order.')} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--whatsapp-green)', fontWeight: 800 }}><MessageCircle size={17} /> WhatsApp us</a>
              <a href={`mailto:${SITE_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-muted)' }}><Mail size={17} /> {SITE_EMAIL}</a>
              <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--text-muted)' }}><Phone size={17} /> {SITE_PHONE}</a>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '22px 0 0' }}>
              Looking to open a store instead? <Link href="/franchise" style={{ color: 'var(--brand-secondary)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Franchise enquiry <ArrowRight size={14} /></Link>
            </p>
          </div>
          <EnquiryForm variant="bulk" />
        </div>
      </section>

      <Footer />
    </main>
  );
}
