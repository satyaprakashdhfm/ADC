import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
import LocationsClient from '@/components/storefront/LocationsClient';

export const metadata = {
  title: 'Store Finder - a dough cookie',
  description: 'Find every A Dough Cookie store across India — search, map and directions.',
};

export default function LocationsPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <section style={{ padding: 'clamp(24px,3.5vw,44px) var(--gutter) clamp(40px,5vw,72px)' }}>
        <div style={{ maxWidth: 1680, margin: '0 auto' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Store Finder</p>
          <h1 style={{ font: '900 clamp(1.9rem,1.3rem + 3vw,3.2rem)/1 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 10px' }}>Find A Dough Cookie near you.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.6, maxWidth: 720, color: 'var(--text-body)', margin: '0 0 clamp(20px,2.5vw,32px)' }}>Walk in for warm cookies, collect an online order, or plan a bulk gifting box — search a city below and find your nearest outlet on the map.</p>
          <LocationsClient />
        </div>
      </section>
      <Footer />
    </main>
  );
}
