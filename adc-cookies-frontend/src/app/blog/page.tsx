import Image from 'next/image';
import Link from 'next/link';
import { Clock, ShoppingBag } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import OrderCta from '@/components/storefront/OrderCta';
import SiteHeader from '@/components/storefront/SiteHeader';

/* Photography, matched to what each piece is actually about. These were three unrelated
   single-cookie product shots — a plain cookie illustrating an article on gift tins, in
   particular — while the branded tin and pulled-apart shots sat unused in the assets folder.
   They are also all from one shoot, so the grid reads as a set rather than three stock photos. */
const POSTS = [
  {
    title: 'How A Dough Cookie Gets That Soft-Center Bite',
    date: 'June 13, 2026',
    read: '4 min read',
    image: '/assets/cookies_new_images/nutella-filled.jpeg',
    excerpt: 'A look at dough resting, browned butter, chocolate selection, and the bake timing that keeps the middle tender.',
    body: 'Every A Dough Cookie starts with a dough that is rested before baking. That rest helps the flour hydrate, deepens the butter flavor, and gives the cookie enough structure to hold a soft center. We bake in small batches, pull the tray while the middle is still tender, and let the cookie finish gently as it cools. The result is a crisp edge, a warm aroma, and a center that still feels fresh when it reaches the box.',
  },
  {
    title: 'Choosing the Right Cookie Tin for Gifting',
    date: 'June 13, 2026',
    read: '3 min read',
    image: '/assets/cookies_new_images/nutella-tin.jpeg',
    excerpt: 'Nutella tins, Biscoff tins, handwritten notes, and the details that make a cookie box feel personal.',
    body: 'Gift tins work best when the flavor has a clear personality. Nutella is creamy and familiar, while Biscoff brings a caramel-spiced hit. At A Dough Cookie, tins are built for birthdays, team treats, festive tables, and last-minute surprises. Add a short note, choose the tin size based on how many people will share it, and keep the packaging neat enough that the box feels like a real present before it is even opened.',
  },
  {
    title: 'Why We Bake All Day Instead of All Morning',
    date: 'August 12, 2026',
    read: '3 min read',
    image: '/assets/cookies_new_images/chocolate-chip.jpeg',
    excerpt: 'Most bakeries run one big morning batch. We run small trays through the day, and it changes what an evening cookie tastes like.',
    body: 'A cookie is at its best in the first hour. Bake everything at seven in the morning and the tray that sells at seven in the evening has had twelve hours to dry out, however good the recipe was. So we bake in small trays through the day at each of our three Bengaluru stores in Jayanagar, S.G. Palya and Electronic City. It is more work and it wastes more dough, but it means there is no bad time to walk in. The same logic drives how we deliver: an order is routed to whichever store is nearest your address rather than to one central kitchen, so the cookie has a short trip and is still warm when it reaches you.',
  },
];

export const metadata = {
  title: 'Blog - a dough cookie',
  description: 'Stories, baking notes, and gifting ideas from a dough cookie.',
  // /blogs re-exports this same page — canonical points there since that's the URL the site's
  // own nav links to, so Google treats the two as one page instead of duplicate content.
  alternates: { canonical: '/blogs' },
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

      <OrderCta
        title="Reading made you hungry?"
        body="Order a fresh batch while the next blog post is still baking."
        href="/order"
      />

      <Footer />
    </main>
  );
}
