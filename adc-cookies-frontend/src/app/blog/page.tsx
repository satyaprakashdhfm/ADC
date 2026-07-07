import Image from 'next/image';
import Link from 'next/link';
import { Clock, ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';

const POSTS = [
  {
    title: 'How A Dough Cookie Gets That Soft-Center Bite',
    date: 'June 13, 2026',
    read: '4 min read',
    image: '/assets/products/adc-special.jpg',
    excerpt: 'A look at dough resting, browned butter, chocolate selection, and the bake timing that keeps the middle tender.',
    body: 'Every A Dough Cookie starts with a dough that is rested before baking. That rest helps the flour hydrate, deepens the butter flavor, and gives the cookie enough structure to hold a soft center. We bake in small batches, pull the tray while the middle is still tender, and let the cookie finish gently as it cools. The result is a crisp edge, a warm aroma, and a center that still feels fresh when it reaches the box.',
  },
  {
    title: 'Choosing the Right Cookie Tin for Gifting',
    date: 'June 13, 2026',
    read: '3 min read',
    image: '/assets/products/m-and-m.jpg',
    excerpt: 'Nutella tins, Biscoff tins, handwritten notes, and the details that make a cookie box feel personal.',
    body: 'Gift tins work best when the flavor has a clear personality. Nutella is creamy and familiar, while Biscoff brings a caramel-spiced hit. At A Dough Cookie, tins are built for birthdays, team treats, festive tables, and last-minute surprises. Add a short note, choose the tin size based on how many people will share it, and keep the packaging neat enough that the box feels like a real present before it is even opened.',
  },
];

export const metadata = {
  title: 'Blog - a dough cookie',
  description: 'Stories, baking notes, and gifting ideas from a dough cookie.',
};

export default function BlogPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <section style={{ padding: '36px var(--gutter) 48px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 }}>Blog</p>
          <h1 style={{ font: '900 clamp(3rem,2.2rem + 4vw,6rem)/.9 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22 }}>Fresh notes from the bakery.</h1>
          <p style={{ fontSize: 'var(--text-lg)', lineHeight: 1.75, maxWidth: 760, color: 'var(--text-body)' }}>Baking notes, gifting ideas, flavor stories, and behind-the-counter updates from a dough cookie. This is where customers can learn how our cookies are made, what makes each batch special, and how to choose the right box for any moment.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            {['Small-batch baking', 'Fresh delivery', 'Gift tins', 'Flavor launches'].map((item) => (
              <span key={item} style={{ padding: '10px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--panel-82)', border: '1px solid var(--border-default)', color: 'var(--text-strong)', fontWeight: 800 }}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 26 }} className="blog-grid">
          {POSTS.map((post) => (
            <article key={post.title} style={{ overflow: 'hidden', borderRadius: 26, background: 'var(--panel-86)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ aspectRatio: '16 / 10', overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                <Image src={post.image} alt={post.title} width={900} height={560} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: 26 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 12 }}>
                  <span>{post.date}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={15} /> {post.read}</span>
                </div>
                <h2 style={{ fontSize: 'var(--text-h3)', lineHeight: 1.12, marginBottom: 12 }}>{post.title}</h2>
                <p style={{ color: 'var(--text-body)', lineHeight: 1.75, marginBottom: 16 }}>{post.excerpt}</p>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.75 }}>{post.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--surface-inverse)', color: 'var(--cream-100)' }}>
          <h2 style={{ color: 'var(--white)', fontSize: 'var(--text-h2)', marginBottom: 12 }}>Reading made you hungry?</h2>
          <p style={{ color: 'var(--cream-100-68)', marginBottom: 26 }}>Order a fresh batch while the next blog post is still baking.</p>
          <Link href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <ShoppingBag size={19} /> Order Now
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
