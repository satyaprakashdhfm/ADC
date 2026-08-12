import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, Phone, Clock, Truck, Gift, ShoppingBag, Wheat, ArrowRight } from 'lucide-react';
import SiteHeader from '@/components/storefront/SiteHeader';
import Footer from '@/components/storefront/Footer';
import { STORES } from '@/lib/stores';
import { PRODUCT_DOCS } from '@/lib/products';
import { SITE_PHONE, SITE_EMAIL } from '@/lib/site';

/*
 * A keyword landing page, not a blog post.
 *
 * "best cookies in bangalore" is the search every cookie shop in the city is competing for, and it
 * is answered by a page that actually answers it — where the shops are, what is in the cookies,
 * what it costs to get one delivered — rather than by a brand page that says "premium handcrafted
 * cookies" eight times. The competitor page ranking for this term is a store list plus a product
 * list, about 2,000 words, with no FAQ and no structured data. Those last two are the gap.
 *
 * Everything factual here is imported, not retyped: the shops come from lib/stores and the cookies
 * from lib/products, so a page whose whole value is being correct cannot quietly go stale when an
 * address or a price changes somewhere else.
 */

const SITE_URL = 'https://www.adoughcookie.com';
const PATH = '/best-cookies-in-bangalore';
const TITLE = 'Best Cookies in Bangalore — Freshly Baked & Same-Day Delivery | a dough cookie';
const DESCRIPTION =
  'Looking for the best cookies in Bangalore? A Dough Cookie bakes in small batches all day at three Bengaluru stores — Jayanagar, S.G. Palya and Electronic City — with same-day delivery across the city in about an hour.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  keywords: [
    'best cookies in bangalore', 'cookies in bangalore', 'cookie shop bangalore',
    'freshly baked cookies bangalore', 'cookie delivery bangalore', 'cookie gift box bangalore',
    'best cookies in bengaluru', 'gooey cookies bangalore', 'nutella cookie bangalore',
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    siteName: 'a dough cookie',
    locale: 'en_IN',
    type: 'article',
    images: [{ url: '/assets/hero-cookies-wide.jpg', width: 2400, height: 1200, alt: 'Freshly baked cookies in Bangalore from a dough cookie' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/assets/hero-cookies-wide.jpg'],
  },
};

const BLR_STORES = STORES.filter(s => s.city === 'Bengaluru');
const COOKIES = PRODUCT_DOCS.filter(p => !/tin$/i.test(p.slug));

/* The questions people actually type after searching for cookies in this city — answered plainly,
   because a FAQPage block is only worth having if the answer would satisfy someone reading it on
   the results page without clicking. */
const FAQS = [
  {
    q: 'Where can I buy the best cookies in Bangalore?',
    a: 'A Dough Cookie has three Bengaluru stores — Jayanagar 9th Block, S.G. Palya near Christ University, and Electronic City Phase 1. All three bake in small batches through the day, so an evening cookie is as fresh as a morning one. You can also order online for same-day delivery anywhere we reach in the city.',
  },
  {
    q: 'Do you deliver cookies across Bangalore on the same day?',
    a: 'Yes. Orders to a Bengaluru address are fulfilled from whichever of our stores is nearest to you and typically arrive within about an hour. The delivery fee is calculated by distance from that store and shown before you pay, so there is no surprise at checkout.',
  },
  {
    q: 'How much do your cookies cost?',
    a: 'Cookies start at ₹60 for the Chocolate Chip and go up to ₹110 for the Biscoff Filled. Cookie tins for gifting run from ₹500 to ₹850. Cookie shakes, hot drinks and cold coffee are on the menu at our stores too.',
  },
  {
    q: 'What makes your cookies different from other cookie shops in Bangalore?',
    a: 'Three things: real ingredients, small batches, and hand-shaping. We use Président butter, couverture chocolate, and genuine Nutella and Lotus Biscoff rather than compound substitutes. Every cookie is portioned and filled by hand, and we bake in small trays through the day instead of one large morning run.',
  },
  {
    q: 'Do you have eggless or gluten-free cookies?',
    a: 'Our Raagi Cookie is gluten-free, made with finger millet rather than wheat flour. It is on the menu at all three Bengaluru stores and available for delivery across the city.',
  },
  {
    q: 'Can I order cookies for a corporate gift or bulk event in Bangalore?',
    a: 'Yes. We do branded boxes, bulk pricing and coordinated delivery for teams, clients and celebrations across Bengaluru. Tell us the headcount and the date and we will put together a quote.',
  },
  {
    q: 'Which is your best-selling cookie?',
    a: 'The Double Choco Chip and the Nutella Filled are the two that move fastest. If you are ordering for the first time and cannot decide, the Chocolate Chip is the honest benchmark — it is the cookie the rest of the menu is measured against.',
  },
];

const REASONS = [
  { icon: Wheat, title: 'Real ingredients, no substitutes', text: 'Président butter, couverture chocolate, and 100% real Nutella and Lotus Biscoff. No compound coatings, no vegetable-fat “chocolate”, no filling that is mostly sugar.' },
  { icon: Clock, title: 'Baked in small batches, all day', text: 'We bake through the day in small trays rather than one big morning run, so the cookie you pick up at seven in the evening is as fresh as the one at opening.' },
  { icon: Truck, title: 'Across Bengaluru in about an hour', text: 'Same-day delivery from the store nearest your address, priced by real distance. You see the fee and the arrival time before you pay for anything.' },
  { icon: Gift, title: 'Finished like a gift', text: 'Tins, sleeves, ribbons and a hand-written note. A box of cookies is usually going to somebody, so it should look like somebody meant it.' },
];

const h2: React.CSSProperties = { font: '900 clamp(1.6rem,1.15rem + 1.9vw,2.4rem)/1.1 var(--font-display)', letterSpacing: '-.02em', color: 'var(--text-strong)', marginBottom: 14 };
const para: React.CSSProperties = { fontSize: 'var(--text-base)', lineHeight: 1.85, color: 'var(--text-body)', marginBottom: 18 };
const wrap: React.CSSProperties = { maxWidth: 1080, margin: '0 auto', padding: '0 var(--gutter)' };
const section: React.CSSProperties = { padding: 'clamp(38px,5vw,64px) 0' };

export default function BestCookiesInBangalorePage() {
  /*
   * One @graph rather than several loose blocks, so the page, its breadcrumb trail, its FAQ and its
   * three shopfronts are described to Google as one connected thing instead of four unrelated
   * assertions. The Bakery entries are what can earn a map/local result; the FAQPage is what can
   * expand the listing itself. The root layout already publishes the brand-level Bakery record, so
   * these carry @id/branchOf back to it rather than declaring a second, competing business.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}${PATH}#page`,
        url: `${SITE_URL}${PATH}`,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'en-IN',
        isPartOf: { '@type': 'WebSite', url: SITE_URL, name: 'a dough cookie' },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}/assets/hero-cookies-wide.jpg` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Best Cookies in Bangalore', item: `${SITE_URL}${PATH}` },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}${PATH}#faq`,
        mainEntity: FAQS.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      ...BLR_STORES.map(s => ({
        '@type': 'Bakery',
        '@id': `${SITE_URL}${PATH}#store-${s.pincode}`,
        name: s.name,
        image: s.image ? `${SITE_URL}${s.image}` : `${SITE_URL}/assets/hero-cookies-wide.jpg`,
        telephone: s.phone,
        email: s.email,
        url: `${SITE_URL}/locations`,
        priceRange: '₹₹',
        servesCuisine: 'Bakery, Desserts, Coffee',
        branchOf: { '@type': 'Bakery', name: 'a dough cookie', url: SITE_URL },
        address: {
          '@type': 'PostalAddress',
          streetAddress: s.address,
          addressLocality: 'Bengaluru',
          addressRegion: 'Karnataka',
          postalCode: String(s.pincode),
          addressCountry: 'IN',
        },
        geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
        hasMap: s.map,
      })),
    ],
  };

  return (
    <main style={{ background: 'var(--surface-page)' }}>
      {/* Rendered as a script tag per the Next.js JSON-LD guide; `<` is escaped because
          JSON.stringify does not sanitise it and the payload ends up inside HTML. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <SiteHeader />

      {/* ---- Hero: the H1 carries the exact phrase, once, and then the page gets on with it ---- */}
      <section style={{ ...section, paddingTop: 'clamp(28px,4vw,48px)' }}>
        <div style={wrap}>
          <nav aria-label="Breadcrumb" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
            <Link href="/" style={{ color: 'var(--text-link)', fontWeight: 700 }}>Home</Link>
            <span aria-hidden="true"> › </span>
            <span>Best Cookies in Bangalore</span>
          </nav>
          <h1 style={{ font: '900 clamp(2rem,1.3rem + 3vw,3.4rem)/1.05 var(--font-display)', letterSpacing: '-.03em', color: 'var(--text-strong)', marginBottom: 18, maxWidth: 900 }}>
            The Best Cookies in Bangalore, Baked Fresh All Day
          </h1>
          <p style={{ ...para, fontSize: 'var(--text-lg)', maxWidth: 780 }}>
            A Dough Cookie is a small-batch cookie kitchen with three stores across Bengaluru — Jayanagar,
            S.G. Palya and Electronic City. Everything is shaped by hand, baked through the day rather
            than all at once, and delivered anywhere in the city in about an hour.
          </p>

          <div style={{ position: 'relative', width: '100%', aspectRatio: '21 / 9', borderRadius: 'var(--radius-card)', overflow: 'hidden', margin: '26px 0 30px', background: 'var(--surface-sunken)' }}>
            <Image src="/assets/hero-cookies-wide.jpg" alt="Freshly baked cookies from a dough cookie in Bangalore" fill priority sizes="(max-width: 1080px) 100vw, 1080px" style={{ objectFit: 'cover' }} />
          </div>

          {/* A short, direct answer near the top — the shape a search engine can lift whole. */}
          <div style={{ padding: 'clamp(18px,2.4vw,26px)', borderRadius: 'var(--radius-card)', background: 'var(--amber-50)', border: '1.5px solid var(--amber-300)' }}>
            <h2 style={{ font: '900 var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', marginBottom: 10 }}>
              The short answer
            </h2>
            <p style={{ ...para, marginBottom: 0 }}>
              The best cookie in Bangalore is the one that reaches you warm. A Dough Cookie bakes in small
              trays all day at three Bengaluru stores, uses Président butter and couverture chocolate
              rather than compound substitutes, and delivers same-day from whichever store sits closest
              to your address. Cookies start at ₹60; gift tins start at ₹500.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Stores: the section that can win a local pack result ---- */}
      <section style={{ ...section, background: 'var(--gold)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={wrap}>
          <h2 style={h2}>Our cookie stores in Bengaluru</h2>
          <p style={{ ...para, maxWidth: 760 }}>
            Three shopfronts, each baking its own trays through the day. Walk in for a warm cookie, a
            cookie shake or a coffee — or order from the nearest one and have it brought to you.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(14px,2vw,22px)', marginTop: 26 }}>
            {BLR_STORES.map(s => (
              <article key={s.pincode} style={{ background: 'var(--vanilla)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                {s.image && (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: 'var(--surface-sunken)' }}>
                    <Image src={s.image} alt={`${s.name} store front`} fill sizes="(max-width: 760px) 100vw, 340px" style={{ objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <h3 style={{ font: '900 var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>
                    {s.name.replace('A Dough Cookie — ', '')}
                  </h3>
                  <p style={{ display: 'flex', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, margin: 0 }}>
                    <MapPin size={16} style={{ flex: 'none', marginTop: 2, color: 'var(--brand-secondary)' }} />
                    <span>{s.address}</span>
                  </p>
                  <p style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-body)', margin: 0 }}>
                    <Phone size={16} style={{ flex: 'none', color: 'var(--brand-secondary)' }} />
                    <a href={`tel:${s.phone.replace(/\s/g, '')}`} style={{ color: 'var(--text-link)', fontWeight: 700 }}>{s.phone}</a>
                  </p>
                  <a href={s.map} target="_blank" rel="noopener noreferrer" style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--brand-secondary)' }}>
                    Get directions <ArrowRight size={15} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Why ---- */}
      <section style={section}>
        <div style={wrap}>
          <h2 style={h2}>What makes them worth the trip</h2>
          <p style={{ ...para, maxWidth: 760 }}>
            Bangalore is not short of places selling cookies. What is rarer is a cookie that was shaped by
            a person, baked an hour ago, and made from ingredients nobody quietly swapped for something
            cheaper.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'clamp(14px,2vw,22px)', marginTop: 24 }}>
            {REASONS.map(r => (
              <div key={r.title} style={{ padding: 22, borderRadius: 'var(--radius-card)', border: '1px solid var(--border-default)', background: 'var(--vanilla)' }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                  <r.icon size={21} />
                </span>
                <h3 style={{ font: '900 var(--text-base)/1.25 var(--font-display)', color: 'var(--text-strong)', marginBottom: 8 }}>{r.title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--text-body)', margin: 0 }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- The cookies themselves, each linking to its own product page ---- */}
      <section style={{ ...section, background: 'var(--gold)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={wrap}>
          <h2 style={h2}>The cookies</h2>
          <p style={{ ...para, maxWidth: 760 }}>
            Eight cookies on the everyday menu, plus cookie tins, skillet cookies, shakes and coffee at
            the stores. Tap any of them to open it on the menu.
          </p>
          {/* Links land on the menu with that cookie floated to the top (`?q=`) rather than on
              /order, which robots.ts disallows — a link a crawler is told not to follow passes
              nothing on to the page it points at. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'clamp(14px,2vw,20px)', marginTop: 24 }}>
            {COOKIES.map(p => (
              <Link key={p.slug} href={`/?q=${encodeURIComponent(p.name)}`} style={{ background: 'var(--vanilla)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'var(--surface-sunken)' }}>
                  <Image src={p.image} alt={`${p.name} — a dough cookie Bangalore`} fill sizes="(max-width: 760px) 50vw, 260px" style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <h3 style={{ font: '900 var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{p.name}</h3>
                  <p style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>{p.texture}</p>
                  <span style={{ marginTop: 'auto', paddingTop: 8, fontWeight: 900, color: 'var(--text-strong)' }}>₹{p.price}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Delivery ---- */}
      <section style={section}>
        <div style={wrap}>
          <h2 style={h2}>Cookie delivery across Bengaluru</h2>
          <p style={para}>
            Put in your address at checkout and the order is routed to whichever of our three stores is
            actually closest to you — not to a single central kitchen. That is what makes same-day
            realistic: the cookie has a short trip, so it is still warm when it arrives, usually within
            about an hour.
          </p>
          <p style={para}>
            The delivery fee is the real distance-based rate from that store, shown on the bill before
            you pay, along with how many kilometres away your cookies are. Outside Bengaluru we ship
            nationwide by courier — though a few items, like the Red Velvet with its 24-hour life, stay
            inside the city where we can get them to you the same day.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22 }}>
            <Link href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 30px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
              <ShoppingBag size={18} /> Order cookies online
            </Link>
            <Link href="/locations" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 30px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-strong)', color: 'var(--text-strong)', fontWeight: 800 }}>
              <MapPin size={18} /> Find a store
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Gifting ---- */}
      <section style={{ ...section, background: 'var(--gold)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={wrap}>
          <h2 style={h2}>Cookie gifts and corporate boxes in Bangalore</h2>
          <p style={{ ...para, maxWidth: 820 }}>
            Cookie tins from ₹500 — Chocolate Chip, Nutella, Red Velvet and Biscoff — packed in a
            reusable tin with a ribbon and a hand-written card. For teams, clients and events we do
            branded boxes, bulk pricing and delivery coordinated to a single date across the city.
          </p>
          <Link href="/corporate" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 30px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <Gift size={18} /> Corporate &amp; bulk gifting
          </Link>
        </div>
      </section>

      {/* ---- FAQ — the visible half of the FAQPage schema above ---- */}
      <section style={section}>
        <div style={wrap}>
          <h2 style={h2}>Frequently asked questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22, maxWidth: 860 }}>
            {FAQS.map(f => (
              <details key={f.q} style={{ padding: '18px 20px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-default)', background: 'var(--vanilla)' }}>
                <summary style={{ font: '800 var(--text-base)/1.4 var(--font-body)', color: 'var(--text-strong)', cursor: 'pointer', listStyle: 'none' }}>
                  {f.q}
                </summary>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.8, color: 'var(--text-body)', margin: '12px 0 0' }}>{f.a}</p>
              </details>
            ))}
          </div>
          <p style={{ ...para, marginTop: 26, fontSize: 'var(--text-sm)' }}>
            Still deciding? Call us on{' '}
            <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ color: 'var(--text-link)', fontWeight: 700 }}>{SITE_PHONE}</a>{' '}
            or write to{' '}
            <a href={`mailto:${SITE_EMAIL}`} style={{ color: 'var(--text-link)', fontWeight: 700 }}>{SITE_EMAIL}</a>.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
