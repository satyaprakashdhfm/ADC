import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Phone, ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';

const STORES = [
  {
    city: 'Bengaluru',
    name: 'ADC Indiranagar',
    address: '12, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    phone: '+91 98765 43210',
    email: 'bengaluru@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Indiranagar+Bengaluru+Karnataka',
    pin: { left: '38%', top: '70%' },
  },
  {
    city: 'Mumbai',
    name: 'ADC Bandra',
    address: 'Linking Road, Bandra West, Mumbai, Maharashtra 400050',
    phone: '+91 98765 43211',
    email: 'mumbai@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Bandra+West+Mumbai+Maharashtra',
    pin: { left: '25%', top: '55%' },
  },
  {
    city: 'Delhi',
    name: 'ADC Connaught Place',
    address: 'Connaught Place, New Delhi, Delhi 110001',
    phone: '+91 98765 43212',
    email: 'delhi@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Connaught+Place+New+Delhi',
    pin: { left: '39%', top: '30%' },
  },
  {
    city: 'Hyderabad',
    name: 'ADC Jubilee Hills',
    address: 'Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033',
    phone: '+91 98765 43213',
    email: 'hyderabad@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Jubilee+Hills+Hyderabad+Telangana',
    pin: { left: '43%', top: '61%' },
  },
];

export const metadata = {
  title: 'Contact Us - a dough cookie',
  description: 'Contact ADC Cookies and find our four store locations in India.',
};

export default function ContactPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <section style={{ padding: '36px var(--gutter) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Link href="/" aria-label="a dough cookie home" style={{ display: 'inline-block', marginBottom: 32 }}>
            <Image src="/assets/adc-logo.png" height={86} width={128} alt="a dough cookie" style={{ objectFit: 'contain' }} />
          </Link>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Contact Us</p>
          <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22 }}>Four ADC stores across India.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, maxWidth: 720, color: 'var(--text-body)' }}>Dummy store details for now. Replace these addresses, phone numbers, and emails with final branch information before publishing.</p>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(320px,460px)', gap: 28, alignItems: 'start' }} className="contact-layout">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }} className="store-grid">
            {STORES.map((store) => (
              <article key={store.city} style={{ background: 'rgba(255,252,248,.86)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>{store.city}</p>
                <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 10 }}>{store.name}</h2>
                <p style={{ color: 'var(--text-body)', lineHeight: 1.65, marginBottom: 16 }}>{store.address}</p>
                <div style={{ display: 'grid', gap: 9, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 18 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Phone size={16} /> {store.phone}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mail size={16} /> {store.email}</span>
                </div>
                <Link href={store.map} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--brand-secondary)', fontWeight: 900 }}>
                  <MapPin size={17} /> Open map
                </Link>
              </article>
            ))}
          </div>

          <aside style={{ position: 'sticky', top: 24, background: 'rgba(255,252,248,.9)', border: '1px solid var(--border-default)', borderRadius: 26, padding: 22, boxShadow: 'var(--shadow-md)' }}>
            <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>India store map</h2>
            <div style={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(160deg,#FDEBC2,#E3F8F9)', border: '1px solid var(--border-default)' }}>
              <div style={{ position: 'absolute', inset: '9% 16% 10% 20%', borderRadius: '45% 45% 38% 42%', background: 'rgba(255,252,248,.72)', border: '2px solid rgba(43,29,18,.16)', boxShadow: 'inset 0 0 40px rgba(239,117,7,.12)' }} />
              {STORES.map((store) => (
                <Link key={store.city} href={store.map} target="_blank" rel="noreferrer" aria-label={`${store.city} map`} style={{ position: 'absolute', left: store.pin.left, top: store.pin.top, transform: 'translate(-50%,-100%)', display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: '50%', background: 'var(--gradient-warm)', color: '#fff', boxShadow: '0 10px 24px rgba(239,117,7,.36)', border: '3px solid #fff' }}>
                  <MapPin size={22} fill="currentColor" />
                </Link>
              ))}
            </div>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 16 }}>Pins link to Google Maps searches for each dummy location.</p>
          </aside>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--surface-inverse)', color: 'var(--cream-100)' }}>
          <h2 style={{ color: '#fff', fontSize: 'var(--text-h2)', marginBottom: 12 }}>Need cookies delivered?</h2>
          <p style={{ color: 'rgba(255,248,241,.68)', marginBottom: 26 }}>Order online or contact the nearest ADC store for bulk and gifting requests.</p>
          <Link href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <ShoppingBag size={19} /> Order Now
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
