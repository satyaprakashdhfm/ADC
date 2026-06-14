import Image from 'next/image';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';

const GALLERY = [
  '/assets/gallery/ADC1.jpeg',
  '/assets/gallery/ADC2.jpeg',
  '/assets/gallery/ADC3.jpeg',
  '/assets/gallery/ADC4.jpeg',
  '/assets/gallery/ADC5.jpeg',
  '/assets/gallery/ADC6.jpeg',
  '/assets/gallery/ADC7.jpeg',
  '/assets/gallery/ADC8.jpeg',
  '/assets/gallery/ADC10.jpeg',
  '/assets/gallery/ADC11.jpeg',
];

export const metadata = {
  title: 'Gallery - a dough cookie',
  description: 'A gallery of ADC cookie images and packaging moments.',
};

export default function GalleryPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <section style={{ padding: '36px var(--gutter) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Gallery</p>
          <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22 }}>Cookies, boxes, and fresh-baked moments.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, maxWidth: 760, color: 'var(--text-body)' }}>A closer look at ADC cookies, boxes, and fresh-baked moments. The gallery should help customers see the product texture, packaging style, gifting quality, and the kind of care that goes into every order.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 26 }} className="store-grid">
            {[
              ['Fresh bakes', 'Soft centers and golden edges.'],
              ['Gift boxes', 'Packed neatly for sharing.'],
              ['Signature flavors', 'Chocolate, Biscoff, Matcha, and more.'],
              ['Store moments', 'A warm bakery experience.'],
            ].map(([title, body]) => (
              <div key={title} style={{ background: 'rgba(244,234,214,.82)', border: '1px solid var(--border-default)', borderRadius: 18, padding: 18 }}>
                <h2 style={{ fontSize: 'var(--text-h4)', marginBottom: 6 }}>{title}</h2>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }} className="gallery-grid">
          {GALLERY.map((src, index) => (
            <div key={src} style={{ position: 'relative', aspectRatio: index % 4 === 0 ? '4 / 5' : '1 / 1', borderRadius: 22, overflow: 'hidden', boxShadow: 'var(--shadow-md)', background: 'var(--surface-sunken)' }}>
              <Image src={src} alt={`ADC gallery image ${index + 1}`} width={720} height={900} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
