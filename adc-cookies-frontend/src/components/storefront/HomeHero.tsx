'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SiteNav from './SiteNav';

const ctaPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)' };
const ctaGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', border: '1.5px solid var(--border-strong)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)' };

/*
 * Art-directed hero backdrop. A single landscape photo gets its sides cropped away on a
 * portrait phone (the hero is a tall centred block), so desktop and mobile each get their own
 * crop via <picture>/media. Drop a portrait file at HERO_MOBILE to switch it on — until then
 * both breakpoints fall back to the landscape image, so nothing breaks if it's missing.
 *   HERO_DESKTOP  2400×1200 (2:1 landscape)
 *   HERO_MOBILE   1200×1600 (3:4 portrait)
 */
const HERO_DESKTOP = '/assets/hero-cookies-wide.jpg';
const HERO_MOBILE = '/assets/hero-cookies-portrait.jpg';

export default function HomeHero() {
  const router = useRouter();
  const scrollToProducts = () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      {/* Fixed bar, shown at the top of the page and tucked away while scrolling down. The hero
          is offset below it in globals.css so it never sits across the photograph. */}
      <SiteNav revealOnScroll />

      <section className="home-hero" style={{ position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', padding: 'clamp(56px,8vw,96px) 0' }}>
        {/* Background photo — starts zoomed in, then eases out so the edge cookies drift into frame.
            Plain <picture>/<img> rather than next/image: art direction needs two sources behind a
            media query, which next/image's single-src API can't express. */}
        <motion.div aria-hidden
          initial={{ scale: 1.18 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <picture>
            <source media="(max-width: 680px)" srcSet={HERO_MOBILE} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO_DESKTOP} alt="" fetchPriority="high" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          </picture>
        </motion.div>

        {/* Center content */}
        <motion.div className="home-hero-copy" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative', zIndex: 3, textAlign: 'center', padding: '0 var(--gutter)', maxWidth: 720 }}>
          {/* White wordmark, as in the navbar and footer. The asset is amber, which only read
              against the old cream wash — on the orange art it would sink into the background.
              Same crush-to-black-then-invert trick those two already use. */}
          <Image src="/assets/adc-logo.png" width={480} height={347} alt="a dough cookie" priority
            style={{ width: 'clamp(230px,36vw,400px)', height: 'auto', margin: '0 auto 10px', filter: 'brightness(0) invert(1)' }} />
          {/* White copy with a soft dark shadow, rather than dark-brown text haloed in white: over
              busy cookie photography the halo read as a smudge, while plain white stays crisp. */}
          <h1 style={{ font: '900 clamp(1.35rem,1.05rem + 1.7vw,2.2rem)/1.08 var(--font-display)', letterSpacing: '-.02em', color: 'var(--white)', textShadow: '0 2px 12px rgba(90,40,0,.45)', margin: '0 0 12px', textWrap: 'balance' }}>
            Chunky, gooey, eggless cookies — baked fresh, delivered warm.
          </h1>
          {/* The supporting paragraph is gone. The headline already says the whole thing, and three
              more lines of ingredient copy over a photograph is a paragraph nobody reads on the way
              to the button — the ingredients have their own section further down, with pictures. */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <button onClick={scrollToProducts} style={ctaPrimary}>Order Cookies <ArrowRight size={16} /></button>
            <button onClick={() => router.push('/about')} style={ctaGhost}>Our Story</button>
          </div>
        </motion.div>

        {/* The bouncing scroll-down chevron is gone. "Order Cookies" above already scrolls to the
            menu, so it was a second control doing the same thing, animating forever at the foot of
            the photograph. */}
      </section>
    </>
  );
}
