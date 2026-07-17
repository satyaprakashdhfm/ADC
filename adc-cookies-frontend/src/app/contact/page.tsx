import Link from 'next/link';
import { Mail, MapPin, Phone, ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
import ContactForm from '@/components/storefront/ContactForm';
import StoreMap from '@/components/storefront/StoreMap';
import { STORES } from '@/lib/stores';

export const metadata = {
  title: 'Contact Us - a dough cookie',
  description: 'Contact A Dough Cookie and find our four store locations in India.',
};

export default function ContactPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <section style={{ padding: '36px var(--gutter) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Contact Us</p>
          <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22 }}>Four A Dough Cookie stores across India.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, maxWidth: 760, color: 'var(--text-body)' }}>Visit A Dough Cookie for warm cookies, premium tins, gifting orders, and quick dessert pick-ups. Each store is positioned around busy neighborhoods so customers can order online, collect in person, or coordinate bulk boxes for events and celebrations.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            {['Store pickup', 'Bulk gifting', 'Fresh delivery', 'Custom notes'].map((item) => (
              <span key={item} style={{ padding: '10px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--panel-82)', border: '1px solid var(--border-default)', color: 'var(--text-strong)', fontWeight: 800 }}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(320px,460px)', gap: 28, alignItems: 'start' }} className="contact-layout contact-stores">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }} className="store-grid">
            {STORES.map((store) => (
              <article key={store.name} style={{ background: 'var(--panel-86)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
                <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>{store.city}</p>
                <h2 style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', marginBottom: 6 }}>{store.name}</h2>
                <p style={{ color: 'var(--text-body)', lineHeight: 1.5, marginBottom: 12, fontSize: 'var(--text-xs)' }}>{store.address}</p>
                <div style={{ display: 'grid', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-xs)', marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Phone size={14} /> {store.phone}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Mail size={14} /> {store.email}</span>
                </div>
                <Link href={store.map} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>
                  <MapPin size={15} /> Open map
                </Link>
              </article>
            ))}
          </div>

          <aside style={{ position: 'sticky', top: 24, background: 'var(--panel-90)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 16, boxShadow: 'var(--shadow-md)' }}>
            <h2 style={{ fontSize: 'var(--text-h4)', marginBottom: 12 }}>Find A Dough Cookie on the map</h2>
            {/* Real interactive map of our 4 stores (Bengaluru ×3 + Chennai) — no wrong pins, no API key */}
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-default)', minHeight: 360 }}>
              <StoreMap />
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Mail size={16} /> satyaprakashreddy6789@gmail.com</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Phone size={16} /> +91 93815 02998</span>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--surface-inverse)', color: 'var(--cream-100)' }}>
          <h2 style={{ color: 'var(--white)', fontSize: 'var(--text-h2)', marginBottom: 12 }}>Need cookies delivered?</h2>
          <p style={{ color: 'var(--cream-100-68)', marginBottom: 26 }}>Order online or contact the nearest A Dough Cookie store for bulk and gifting requests.</p>
          <Link href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <ShoppingBag size={19} /> Order Now
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
