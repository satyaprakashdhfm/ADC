import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Croissant, Hand, Sparkles, Store, HeartHandshake, Wheat } from 'lucide-react';
import Footer from '@/components/storefront/Footer';
import SiteHeader from '@/components/storefront/SiteHeader';
import { STORES } from '@/lib/stores';

export const metadata = {
  title: 'Our Story — a dough cookie',
  description: 'How A Dough Cookie began: a small handmade cookie kitchen built on real butter, couverture chocolate and small-batch baking — now four stores across Bengaluru and Chennai.',
};

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 10 };
const h2: React.CSSProperties = { font: '900 clamp(1.7rem,1.2rem + 2vw,2.6rem)/1.08 var(--font-display)', letterSpacing: '-.02em', marginBottom: 16, color: 'var(--text-strong)' };
const para: React.CSSProperties = { fontSize: 'var(--text-base)', lineHeight: 1.85, color: 'var(--text-body)', marginBottom: 18 };

// The values that actually change how a cookie tastes — not generic brand adjectives.
const VALUES = [
  { icon: Hand, title: 'Made by hand, not by machine', text: 'Every ball of dough is portioned, filled and shaped by hand. It is slower and it does not scale neatly, but it is the only way to get a centre that stays molten and an edge that stays crisp.' },
  { icon: Wheat, title: 'Real ingredients, no substitutes', text: 'Président butter, couverture chocolate, and 100% real Nutella and Lotus Biscoff. No compounds, no vegetable-fat “chocolate”, no filling that is mostly sugar. If we cannot get the real thing, we do not make the cookie.' },
  { icon: Croissant, title: 'Small batches, all day', text: 'We bake through the day in small trays rather than one big morning run. It means the cookie you get in the evening is as fresh as the one at opening — and nothing sits in a freezer waiting for you.' },
  { icon: Sparkles, title: 'Finished like a gift', text: 'Tins, sleeves, ribbons and hand-written notes. A box of cookies is usually going to somebody, so it should look like somebody meant it.' },
];

// A short, honest arc — how a home kitchen became four stores.
const STORY = [
  { step: '01', title: 'It started in a home kitchen', text: 'One oven, a hand mixer, and far too many failed batches. The goal was simple and stubborn: a cookie with a genuinely gooey middle that still held its shape — the kind you could not buy anywhere nearby.' },
  { step: '02', title: 'Friends became the first customers', text: 'Boxes went out to friends and family, then to their offices, then to people we had never met. The recipe kept getting tightened — more butter, better chocolate, a shorter bake — until the cookie stopped needing an apology.' },
  { step: '03', title: 'The first counter opened', text: 'A small shop, an open oven, and the smell doing most of the marketing. Baking in front of people changed things: nothing could be hidden, so everything had to be right.' },
  { step: '04', title: 'Four stores, same dough', text: `Today there are ${STORES.length} A Dough Cookie stores across Bengaluru and Chennai. The kitchen is bigger, the trays are more frequent — but the dough is still mixed to the same recipe and still shaped by hand.` },
];

export default function AboutPage() {
  return (
    <main className="adc-pattern-page" style={{ minHeight: '100vh' }}>
      <SiteHeader />

      {/* ── Hero ── */}
      <section style={{ padding: '36px var(--gutter) 72px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr minmax(280px,440px)', gap: 'clamp(28px,4vw,56px)', alignItems: 'center' }} className="product-doc-hero">
          <div>
            <p style={eyebrow}>Our Story</p>
            <h1 style={{ font: '900 clamp(2.4rem,1.8rem + 3.4vw,4.6rem)/.95 var(--font-display)', letterSpacing: '-.02em', marginBottom: 22, color: 'var(--text-strong)' }}>
              A small cookie kitchen that refused to cut corners.
            </h1>
            <p style={{ ...para, fontSize: 'var(--text-lg)', maxWidth: 660 }}>
              A Dough Cookie began the way most good food does — with somebody being fussy at home. We wanted a cookie
              that was soft in the middle without being raw, rich without being sickly, and made with ingredients we
              would happily name out loud. It took a lot of batches to get there.
            </p>
            <p style={{ ...para, maxWidth: 660 }}>
              Everything is still handmade in small batches, baked through the day, and packed to travel well. That is
              the whole idea, and we have not found a good reason to change it.
            </p>
          </div>
          <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', aspectRatio: '4 / 5', position: 'relative' }}>
            <Image src="/assets/gallery/ADC1.jpeg" alt="A box of freshly baked A Dough Cookie cookies" fill sizes="(max-width:760px) 100vw, 440px" priority style={{ objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      {/* ── The story, as a numbered arc ── */}
      <section style={{ padding: 'clamp(30px,5vw,72px) 0', background: 'var(--gold)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <div style={{ maxWidth: 640, marginBottom: 'clamp(22px,3vw,40px)' }}>
            <p style={eyebrow}>How we got here</p>
            <h2 style={h2}>From one oven to four stores.</h2>
            <p style={{ ...para, marginBottom: 0 }}>
              No investors, no grand plan — just a recipe that kept getting better and word that kept getting round.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'clamp(14px,1.8vw,22px)' }}>
            {STORY.map(s => (
              <article key={s.step} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', padding: 'clamp(18px,2vw,26px)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ font: '900 clamp(1.5rem,1.1rem + 1vw,2.1rem)/1 var(--font-display)', color: 'var(--brand-secondary)', marginBottom: 10, letterSpacing: '-.02em' }}>{s.step}</div>
                <h3 style={{ font: 'var(--weight-extra) var(--text-lg)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 8px' }}>{s.title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.65, color: 'var(--text-body)', margin: 0 }}>{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── What we will not compromise on ── */}
      <section style={{ padding: 'clamp(30px,5vw,72px) 0', background: 'var(--band-ivory)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <div style={{ maxWidth: 640, marginBottom: 'clamp(22px,3vw,40px)' }}>
            <p style={eyebrow}>What we stand on</p>
            <h2 style={h2}>Four things we will not compromise on.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'clamp(14px,1.8vw,22px)' }}>
            {VALUES.map(({ icon: Icon, title, text }) => (
              <article key={title} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', padding: 'clamp(20px,2.2vw,28px)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                  <Icon size={21} />
                </span>
                <h3 style={{ font: 'var(--weight-extra) var(--text-lg)/1.25 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 8px' }}>{title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--text-body)', margin: 0 }}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Photo strip + the stores ── */}
      <section style={{ padding: 'clamp(30px,5vw,72px) 0', background: 'var(--gold)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'clamp(10px,1.4vw,16px)', marginBottom: 'clamp(24px,3vw,44px)' }}>
            {['ADC3.jpeg', 'ADC5.jpeg', 'ADC7.jpeg', 'ADC10.jpeg'].map((f, i) => (
              <div key={f} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <Image src={`/assets/gallery/${f}`} alt="" fill sizes="(max-width:760px) 45vw, 260px" style={{ objectFit: 'cover' }} priority={i === 0} />
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(280px,420px)', gap: 'clamp(24px,4vw,48px)', alignItems: 'start' }} className="product-doc-hero">
            <div>
              <p style={eyebrow}>Come say hello</p>
              <h2 style={h2}>Four counters, one dough.</h2>
              <p style={para}>
                Each store bakes on site, so what you smell walking in is what you are about to eat. Pop in for a warm
                one, or order and we will get it to you while it is still soft.
              </p>
              <Link href="/locations" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>
                <Store size={16} /> Find your nearest store
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STORES.map(s => (
                <div key={s.name} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)', padding: '13px 16px' }}>
                  <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>{s.city}</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', lineHeight: 1.3 }}>{s.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing note ── */}
      <section style={{ padding: 'clamp(30px,5vw,72px) var(--gutter)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--gradient-warm)', color: 'var(--white)', display: 'inline-grid', placeItems: 'center', marginBottom: 18 }}>
            <HeartHandshake size={24} />
          </span>
          <h2 style={h2}>Thank you for eating our cookies.</h2>
          <p style={{ ...para, marginBottom: 0 }}>
            Every order still gets noticed at this end. If something is not right, tell us — we would much rather fix
            it than have you quietly not come back.
          </p>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter) 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center', padding: '42px 28px', borderRadius: 28, background: 'var(--surface-inverse)', color: 'var(--cream-100)' }}>
          <h2 style={{ color: 'var(--white)', fontSize: 'var(--text-h2)', marginBottom: 12 }}>Taste the fresh batch.</h2>
          <p style={{ color: 'var(--cream-100-68)', marginBottom: 26 }}>Explore the menu, pick your favourite flavour, and order cookies baked for the moment.</p>
          <Link href="/#products" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 900, boxShadow: 'var(--shadow-brand)' }}>
            <ShoppingBag size={19} /> Order Now
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
