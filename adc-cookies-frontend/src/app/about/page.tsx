import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';

export const metadata = {
  title: 'About Us - a dough cookie',
  description: 'Learn about a dough cookie, our baking style, and the cookie experience we are building.',
};

export default function AboutPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <section style={{ padding: '36px var(--gutter) 82px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(280px,460px)', gap: 48, alignItems: 'center' }} className="product-doc-hero">
          <div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>About Us</p>
            <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 24 }}>Fresh cookies, built with care.</h1>
            <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.8, maxWidth: 660, color: 'var(--text-body)' }}>A Dough Cookie is built around warm, soft-center cookies, premium fillings, and gift-ready packaging. The store is made for everyday cravings, celebration boxes, office treats, and late-night dessert runs, with every batch focused on aroma, texture, and freshness.</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 24, maxWidth: 620 }}>
              {['Cookies are baked in small batches so the centers stay soft and the edges stay crisp.', 'Filled cookies and tins are packed carefully so they travel well and arrive looking gift-ready.', 'The menu balances classics, premium flavors, gluten-free options, and indulgent filled cookies.'].map((point) => (
                <p key={point} style={{ color: 'var(--text-body)', lineHeight: 1.65, fontWeight: 700 }}>{point}</p>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', aspectRatio: '4 / 5' }}>
            <Image src="/assets/gallery/ADC1.jpeg" alt="A Dough Cookie box" width={720} height={900} priority style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 86px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }} className="about-card-grid">
          {[
            ['Baked fresh', 'Cookies are prepared in controlled batches through the day, so the flavor stays consistent and the texture feels freshly made.'],
            ['Premium fillings', 'Nutella, Biscoff, cream cheese, matcha, chocolate chunks, and signature mixes give every cookie a clear flavor identity.'],
            ['Gift ready', 'Cookie tins, ribbons, notes, and neat packaging make A Dough Cookie useful for birthdays, office gifting, festive boxes, and thank-you treats.'],
          ].map(([title, body]) => (
            <article key={title} style={{ background: 'var(--panel-82)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 26 }}>
              <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 10 }}>{title}</h2>
              <p style={{ color: 'var(--text-body)', lineHeight: 1.75 }}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 86px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', background: 'var(--panel-86)', border: '1px solid var(--border-default)', borderRadius: 28, padding: '32px clamp(22px,4vw,44px)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: 'var(--text-h2)', marginBottom: 14 }}>What customers should feel</h2>
          <p style={{ color: 'var(--text-body)', lineHeight: 1.8, marginBottom: 18 }}>The website and store experience should feel warm, premium, and easy. Customers should immediately understand the menu, trust the product quality, see the gifting possibilities, and move quickly from browsing to ordering.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }} className="store-grid">
            {['Warm aroma', 'Soft centers', 'Premium boxes', 'Easy ordering'].map((item) => (
              <div key={item} style={{ padding: '16px 18px', borderRadius: 18, background: 'var(--amber-50)', color: 'var(--orange-800)', fontWeight: 900, textAlign: 'center' }}>{item}</div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--surface-inverse)', color: 'var(--cream-100)' }}>
          <h2 style={{ color: 'var(--white)', fontSize: 'var(--text-h2)', marginBottom: 12 }}>Taste the fresh batch.</h2>
          <p style={{ color: 'var(--cream-100-68)', marginBottom: 26 }}>Explore the menu, pick your favorite flavor, and order cookies baked for the moment.</p>
          <Link href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <ShoppingBag size={19} /> Order Now
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
