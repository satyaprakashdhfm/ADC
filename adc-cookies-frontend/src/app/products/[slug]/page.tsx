import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import { PRODUCT_DOCS } from '@/lib/products';

export function generateStaticParams() {
  return PRODUCT_DOCS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = PRODUCT_DOCS.find((item) => item.slug === slug);
  return {
    title: product ? `${product.name} - a dough cookie` : 'Product - a dough cookie',
    description: product?.description,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = PRODUCT_DOCS.find((item) => item.slug === slug);
  if (!product) notFound();

  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <section style={{ padding: '28px var(--gutter) 72px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 28, flexWrap: 'wrap' }}>
            <Link href="/" aria-label="a dough cookie home" style={{ display: 'inline-block' }}>
              <Image src="/assets/adc-logo.png" height={86} width={128} alt="a dough cookie" style={{ objectFit: 'contain' }} />
            </Link>
            <Link href="/#menu" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-strong)', fontWeight: 800 }}>
              <ArrowLeft size={18} /> Back to menu
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,520px) 1fr', gap: 48, alignItems: 'center' }} className="product-doc-hero">
            <div style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', background: 'var(--surface-sunken)' }}>
              <Image src={product.image} alt={product.name} width={900} height={900} priority style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>{product.tag}</p>
              <h1 style={{ font: '900 clamp(2.8rem,2rem + 4vw,5.8rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22 }}>{product.name}</h1>
              <p style={{ color: 'var(--text-body)', fontSize: 'var(--text-lg)', lineHeight: 1.75, maxWidth: 620, marginBottom: 24 }}>{product.description}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ padding: '10px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-raised)', color: 'var(--text-strong)', fontWeight: 800 }}>From Rs. {product.price}</span>
                <span style={{ padding: '10px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--orange-800)', fontWeight: 800 }}>{product.sweetness}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 88px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }} className="product-doc-grid">
          <article style={{ background: 'rgba(255,252,248,.82)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>What it is</h2>
            <p style={{ lineHeight: 1.8, color: 'var(--text-body)' }}>A dummy documentation page for the {product.name}. This page is ready for full product notes, ingredient sourcing, storage guidance, serving suggestions, and launch-specific messaging.</p>
          </article>

          <article style={{ background: 'rgba(255,252,248,.82)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>Sweetness and texture</h2>
            <p style={{ lineHeight: 1.8, color: 'var(--text-body)', marginBottom: 10 }}>{product.sweetness}</p>
            <p style={{ lineHeight: 1.8, color: 'var(--text-body)' }}>{product.texture}</p>
          </article>

          <article style={{ background: 'rgba(255,252,248,.82)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>How it will be made</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {product.making.map((step, index) => (
                <div key={step} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12, alignItems: 'start' }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gradient-warm)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{index + 1}</span>
                  <p style={{ lineHeight: 1.7, color: 'var(--text-body)' }}>{step}</p>
                </div>
              ))}
            </div>
          </article>

          <article style={{ background: 'rgba(255,252,248,.82)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 28 }}>
            <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>Why it is good</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {product.highlights.map((item) => (
                <p key={item} style={{ lineHeight: 1.7, color: 'var(--text-body)' }}>{item}</p>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--surface-inverse)', color: 'var(--cream-100)' }}>
          <h2 style={{ color: '#fff', fontSize: 'var(--text-h2)', marginBottom: 12 }}>Ready for {product.name}?</h2>
          <p style={{ color: 'rgba(255,248,241,.68)', marginBottom: 26 }}>Fresh batch notes, final ingredient details, and packaging information can be added here before launch.</p>
          <Link href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <ShoppingBag size={19} /> Order Now
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
