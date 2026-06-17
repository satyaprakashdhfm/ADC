import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Phone } from 'lucide-react';
import { STORES } from '@/lib/stores';

/** Home page About + Stores — who we are, and where to find every ADC outlet. */
export default function StoresAbout() {
  return (
    <section id="about" style={{ padding: 'clamp(48px,7vw,90px) 0' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' }}>
        {/* About */}
        <div className="product-doc-hero" style={{ display: 'grid', gridTemplateColumns: '1fr minmax(280px,440px)', gap: 'clamp(28px,4vw,52px)', alignItems: 'center', marginBottom: 'clamp(40px,5vw,64px)' }}>
          <div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 12px' }}>About Us</p>
            <h2 style={{ font: '900 clamp(2rem,1.5rem + 2.6vw,3.2rem)/1 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 18px' }}>A Dough Cookie — baked fresh, served warm.</h2>
            <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, color: 'var(--text-body)', margin: '0 0 18px' }}>
              ADC is built around warm, soft-centre cookies, premium fillings and gift-ready packaging — made for everyday cravings, celebration boxes, office treats and late-night dessert runs. Every batch is baked small so the centres stay soft and the aroma stays fresh.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Baked fresh daily', 'Premium fillings', 'Gift-ready tins', 'Bulk & corporate'].map(t => (
                <span key={t} style={{ padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-50)', border: '1px solid var(--border-default)', color: 'var(--orange-800)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', aspectRatio: '4 / 3', position: 'relative' }}>
            <Image src="/assets/gallery/ADC2.jpeg" alt="A Dough Cookie store" fill sizes="(max-width:760px) 100vw, 440px" style={{ objectFit: 'cover' }} />
          </div>
        </div>

        {/* Stores */}
        <h3 style={{ font: 'var(--weight-extra) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px', letterSpacing: '-.02em' }}>Our stores</h3>
        <p style={{ color: 'var(--text-body)', margin: '0 0 24px', fontSize: 'var(--text-base)' }}>Find ADC across India — walk in for warm cookies, or order online for delivery.</p>
        <div className="store-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
          {STORES.map(store => (
            <article key={store.city} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 6px' }}>{store.city}</p>
              <h4 style={{ font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 8px' }}>{store.name}</h4>
              <p style={{ color: 'var(--text-body)', lineHeight: 1.6, margin: '0 0 14px', fontSize: 'var(--text-sm)' }}>{store.address}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Phone size={15} /> {store.phone}</span>
                <Link href={store.map} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)' }}><MapPin size={15} /> Open map</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
