import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
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
      <SiteHeader />
      <section style={{ padding: '28px var(--gutter) 72px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 28, flexWrap: 'wrap' }}>
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
        <article style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'var(--text-h2)', marginBottom: 16 }}>What it is</h2>
          <p style={{ lineHeight: 1.85, color: 'var(--text-body)', fontSize: 'var(--text-lg)', marginBottom: 38 }}>{product.story}</p>

          <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>How it&apos;s made</h2>
          <ol style={{ margin: '0 0 38px', padding: 0, listStyle: 'none', display: 'grid', gap: 14 }}>
            {product.making.map((step, index) => (
              <li key={step} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 14, alignItems: 'start', lineHeight: 1.8, color: 'var(--text-body)' }}>
                <span aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-warm)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 'var(--text-sm)' }}>{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>Why you&apos;ll love it</h2>
          <ul style={{ margin: '0 0 38px', padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
            {product.highlights.map((item) => (
              <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'baseline', lineHeight: 1.75, color: 'var(--text-body)' }}>
                <span aria-hidden style={{ color: 'var(--brand-secondary)', fontWeight: 900, flex: 'none' }}>&bull;</span>{item}
              </li>
            ))}
          </ul>

          <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 14 }}>Pairs well with</h2>
          <p style={{ lineHeight: 1.85, color: 'var(--text-body)' }}>{product.pairing}</p>
        </article>
      </section>

      <section style={{ padding: '0 var(--gutter) 88px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: 18, textAlign: 'center' }}>Good to know</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }} className="product-doc-grid">
            <article style={{ background: 'rgba(244,234,214,.82)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 10 }}>Sweetness &amp; texture</h3>
              <p style={{ lineHeight: 1.7, color: 'var(--text-body)', fontSize: 'var(--text-sm)' }}>{product.sweetness} {product.texture}</p>
            </article>

            <article style={{ background: 'rgba(244,234,214,.82)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 12 }}>What goes inside</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {product.ingredients.map((item) => (
                  <span key={item} style={{ padding: '8px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-50)', color: 'var(--orange-800)', fontWeight: 800, fontSize: 'var(--text-xs)' }}>{item}</span>
                ))}
              </div>
            </article>

            <article style={{ background: 'rgba(244,234,214,.82)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 10 }}>Serving note</h3>
              <p style={{ lineHeight: 1.7, color: 'var(--text-body)', fontSize: 'var(--text-sm)' }}>{product.serving}</p>
            </article>

            <article style={{ background: 'rgba(244,234,214,.82)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: 'var(--text-h4)', marginBottom: 10 }}>Storage</h3>
              <p style={{ lineHeight: 1.7, color: 'var(--text-body)', fontSize: 'var(--text-sm)' }}>{product.storage}</p>
            </article>
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--surface-inverse)', color: 'var(--cream-100)' }}>
          <h2 style={{ color: '#fff', fontSize: 'var(--text-h2)', marginBottom: 12 }}>Ready for {product.name}?</h2>
          <p style={{ color: 'rgba(255,248,241,.68)', marginBottom: 26 }}>Order it fresh from A Dough Cookie and enjoy the texture, aroma, and packaging exactly the way this cookie is meant to be served.</p>
          <Link href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <ShoppingBag size={19} /> Order Now
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
