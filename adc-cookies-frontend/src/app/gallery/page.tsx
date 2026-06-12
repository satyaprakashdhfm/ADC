import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/storefront/Footer';

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
      <section style={{ padding: '36px var(--gutter) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Link href="/" style={{ display: 'inline-block', color: 'var(--text-strong)', fontWeight: 800, marginBottom: 32 }}>a dough cookie</Link>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Gallery</p>
          <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22 }}>Cookies, boxes, and fresh-baked moments.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, maxWidth: 680, color: 'var(--text-body)' }}>Images are pulled from the local cookies folder and staged into the site assets so the gallery works in the Next app.</p>
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
