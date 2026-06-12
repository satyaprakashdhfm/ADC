import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';

export const metadata = {
  title: 'About Us - a dough cookie',
  description: 'Learn about a dough cookie, our baking style, and the cookie experience we are building.',
};

export default function AboutPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <section style={{ padding: '36px var(--gutter) 82px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(280px,460px)', gap: 48, alignItems: 'center' }} className="product-doc-hero">
          <div>
            <Link href="/" style={{ display: 'inline-block', color: 'var(--text-strong)', fontWeight: 800, marginBottom: 32 }}>a dough cookie</Link>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>About Us</p>
            <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 24 }}>Fresh cookies, built with care.</h1>
            <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.8, maxWidth: 640, color: 'var(--text-body)' }}>This is a proper dummy About page for ADC. Use it for the brand story, bakery process, quality promise, delivery standards, team notes, and any founder message you want visitors to see.</p>
          </div>
          <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', aspectRatio: '4 / 5' }}>
            <Image src="/assets/gallery/ADC1.jpeg" alt="ADC cookies box" width={720} height={900} priority style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 86px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }} className="about-card-grid">
          {[
            ['Baked fresh', 'Small-batch cookies made for warm delivery, soft centers, and consistent flavor.'],
            ['Premium fillings', 'Chocolate, Biscoff, Nutella, cream cheese, matcha, and signature mixes get documented here.'],
            ['Gift ready', 'Tins, ribbons, cards, and celebration packaging can be explained in this section.'],
          ].map(([title, body]) => (
            <article key={title} style={{ background: 'rgba(255,252,248,.82)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 26 }}>
              <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 10 }}>{title}</h2>
              <p style={{ color: 'var(--text-body)', lineHeight: 1.75 }}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--surface-inverse)', color: 'var(--cream-100)' }}>
          <h2 style={{ color: '#fff', fontSize: 'var(--text-h2)', marginBottom: 12 }}>Taste the fresh batch.</h2>
          <p style={{ color: 'rgba(255,248,241,.68)', marginBottom: 26 }}>Dummy brand copy can be expanded here with store timings, service areas, and founder notes.</p>
          <Link href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <ShoppingBag size={19} /> Order Now
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
