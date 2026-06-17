import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Phone } from 'lucide-react';
import { STORES } from '@/lib/stores';

/** Home page About + Stores — who we are, and where to find every ADC outlet. */
export default function StoresAbout() {
  return (
    <section id="about" style={{ padding: 'clamp(32px,4.5vw,56px) 0', background: 'var(--cream-100)', borderBottom: '1px solid var(--border-default)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 var(--gutter)' }}>
        {/* About */}
        <div className="product-doc-hero" style={{ display: 'grid', gridTemplateColumns: '1fr minmax(260px,400px)', gap: 'clamp(22px,3vw,40px)', alignItems: 'center', marginBottom: 'clamp(28px,4vw,44px)' }}>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>About Us</p>
            <h2 style={{ font: '900 clamp(1.4rem,1.1rem + 1.4vw,2rem)/1.05 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 12px' }}>A Dough Cookie — baked fresh, served warm.</h2>
            <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--text-body)', margin: '0 0 16px' }}>
              ADC is built around warm, soft-centre cookies, premium fillings and gift-ready packaging — for everyday cravings, celebration boxes, office treats and late-night dessert runs. Every batch is baked small so the centres stay soft.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Baked fresh daily', 'Premium fillings', 'Gift-ready tins', 'Bulk & corporate'].map(t => (
                <span key={t} style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-50)', border: '1px solid var(--border-default)', color: 'var(--orange-800)', fontWeight: 700, fontSize: 'var(--text-xs)' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', aspectRatio: '4 / 3', position: 'relative' }}>
            <Image src="/assets/gallery/ADC2.jpeg" alt="A Dough Cookie store" fill sizes="(max-width:760px) 100vw, 400px" style={{ objectFit: 'cover' }} />
          </div>
        </div>

        {/* Stores */}
        <h3 style={{ font: 'var(--weight-extra) clamp(1.15rem,1rem + .6vw,1.4rem)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px', letterSpacing: '-.02em' }}>Our stores</h3>
        <p style={{ color: 'var(--text-body)', margin: '0 0 16px', fontSize: 'var(--text-sm)' }}>Find ADC across India — walk in for warm cookies, or order online for delivery.</p>
        <div className="store-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {STORES.map(store => (
            <article key={store.city} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-image)', padding: 16, boxShadow: 'var(--shadow-sm)' }}>
              <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 4px' }}>{store.city}</p>
              <h4 style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{store.name}</h4>
              <p style={{ color: 'var(--text-body)', lineHeight: 1.5, margin: '0 0 10px', fontSize: 'var(--text-xs)' }}>{store.address}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-xs)' }}><Phone size={13} /> {store.phone}</span>
                <Link href={store.map} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-xs)' }}><MapPin size={13} /> Open map</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
