import Link from 'next/link';
import { Mail, MapPin, Navigation, Phone, ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
import ContactForm from '@/components/storefront/ContactForm';

const STORES = [
  {
    city: 'Bengaluru',
    name: 'ADC Indiranagar',
    address: '12, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    phone: '+91 98765 43210',
    email: 'bengaluru@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Indiranagar+Bengaluru+Karnataka',
  },
  {
    city: 'Mumbai',
    name: 'ADC Bandra',
    address: 'Linking Road, Bandra West, Mumbai, Maharashtra 400050',
    phone: '+91 98765 43211',
    email: 'mumbai@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Bandra+West+Mumbai+Maharashtra',
  },
  {
    city: 'Delhi',
    name: 'ADC Connaught Place',
    address: 'Connaught Place, New Delhi, Delhi 110001',
    phone: '+91 98765 43212',
    email: 'delhi@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Connaught+Place+New+Delhi',
  },
  {
    city: 'Hyderabad',
    name: 'ADC Jubilee Hills',
    address: 'Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033',
    phone: '+91 98765 43213',
    email: 'hyderabad@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Jubilee+Hills+Hyderabad+Telangana',
  },
];

export const metadata = {
  title: 'Contact Us - a dough cookie',
  description: 'Contact ADC Cookies and find our four store locations in India.',
};

export default function ContactPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <section style={{ padding: '36px var(--gutter) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Contact Us</p>
          <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22 }}>Four ADC stores across India.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, maxWidth: 760, color: 'var(--text-body)' }}>Visit ADC for warm cookies, premium tins, gifting orders, and quick dessert pick-ups. Each store is positioned around busy neighborhoods so customers can order online, collect in person, or coordinate bulk boxes for events and celebrations.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            {['Store pickup', 'Bulk gifting', 'Fresh delivery', 'Custom notes'].map((item) => (
              <span key={item} style={{ padding: '10px 16px', borderRadius: 'var(--radius-pill)', background: 'rgba(244,234,214,.82)', border: '1px solid var(--border-default)', color: 'var(--text-strong)', fontWeight: 800 }}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(320px,460px)', gap: 28, alignItems: 'start' }} className="contact-layout">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }} className="store-grid">
            {STORES.map((store) => (
              <article key={store.city} style={{ background: 'rgba(244,234,214,.86)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>{store.city}</p>
                <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 10 }}>{store.name}</h2>
                <p style={{ color: 'var(--text-body)', lineHeight: 1.65, marginBottom: 16 }}>{store.address}</p>
                <div style={{ display: 'grid', gap: 7, marginBottom: 16, color: 'var(--text-body)', fontSize: 'var(--text-sm)', lineHeight: 1.55 }}>
                  <span>Fresh cookies and filled cookies available daily.</span>
                  <span>Gift tins and bulk orders can be coordinated with the store team.</span>
                  <span>Best for pickup, delivery support, and celebration boxes.</span>
                </div>
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

          <aside style={{ position: 'sticky', top: 24, background: 'rgba(244,234,214,.9)', border: '1px solid var(--border-default)', borderRadius: 26, padding: 22, boxShadow: 'var(--shadow-md)' }}>
            <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>Find ADC on the map</h2>
            <div style={{ borderRadius: 22, overflow: 'hidden', border: '1px solid var(--border-default)', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sm)' }}>
              <iframe
                title="ADC store locations map"
                src="https://www.google.com/maps?q=Indiranagar%20Bengaluru%20Bandra%20Mumbai%20Connaught%20Place%20Delhi%20Jubilee%20Hills%20Hyderabad&output=embed"
                width="100%"
                height="430"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{ display: 'block', border: 0 }}
              />
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {STORES.map((store) => (
                <Link key={store.city} href={store.map} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-strong)', fontWeight: 800 }}>
                  <Navigation size={16} color="var(--brand-secondary)" /> Directions to {store.city}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section id="get-in-touch" style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(320px,460px)', gap: 28, alignItems: 'start' }} className="contact-layout">
          <div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Get in Touch</p>
            <h2 style={{ font: '900 clamp(2.2rem,1.6rem + 3vw,3.4rem)/1 var(--font-display)', letterSpacing: '-.02em', marginBottom: 16 }}>Leave your details and we&apos;ll reach out.</h2>
            <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, color: 'var(--text-body)', marginBottom: 18 }}>Have a bulk order, a gifting request, or a question about our cookies? Share your details and our team will get back to you.</p>
            <div style={{ display: 'grid', gap: 7, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mail size={16} /> hello@adccookies.com</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Phone size={16} /> +91 98765 43210</span>
            </div>
          </div>
          <ContactForm />
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
