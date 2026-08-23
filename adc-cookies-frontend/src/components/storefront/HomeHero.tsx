'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getHeroBanner } from '@/lib/api';
import SiteNav from './SiteNav';

const ctaPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)' };
const ctaGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', border: '1.5px solid var(--border-strong)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)' };

/*
 * Art-directed hero backdrop. A single landscape photo gets its sides cropped away on a
 * portrait phone (the hero is a tall centred block), so desktop and mobile each get their own
 * crop via <picture>/media.
 *   HERO_DESKTOP  2400×1200 (2:1 landscape)
 *   HERO_MOBILE   1200×1600 (3:4 portrait)
 *
 * These two are the files the site ships, and they are also the fallback. The admin can replace
 * either from Admin → Customize UI → Home page banner, and give the banner somewhere to link to.
 */
const HERO_DESKTOP = '/assets/hero-cookies-wide.jpg';
const HERO_MOBILE = '/assets/hero-cookies-portrait.jpg';

export default function HomeHero() {
  const router = useRouter();
  const scrollToProducts = () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });

  /*
   * The admin's banner, fetched rather than rendered on the server.
   *
   * An uploaded image lives in a private bucket and resolves to a SIGNED url with an expiry, so it
   * cannot be baked into this statically-prerendered page — the signature would lapse a week after a
   * deploy, on the first image every visitor sees. Starting from the shipped files means the fetch
   * swaps one photograph for another rather than filling a hole, so there is no empty hero while it
   * is in flight.
   */
  const [banner, setBanner] = useState<{ desktop: string | null; mobile: string | null; href: string | null; alt: string | null; hideOverlay?: boolean }>(
    { desktop: null, mobile: null, href: null, alt: null },
  );
  useEffect(() => { getHeroBanner().then(setBanner).catch(() => {}); }, []);

  const desktopSrc = banner.desktop || HERO_DESKTOP;
  const mobileSrc = banner.mobile || banner.desktop || HERO_MOBILE;
  /*
   * An offer banner is finished artwork with its own words on it, so our wordmark, headline and
   * buttons print over the top of someone else's design. When the banner asks for it they step
   * aside and the image is the whole hero.
   *
   * The flag arrives with the banner, from the server, and is false whenever no banner is showing —
   * so an expired offer or a storage hiccup cannot leave the home page with no headline and nothing
   * to click. The ordinary hero always keeps its copy.
   */
  const bare = !!banner.hideOverlay && !!(banner.desktop || banner.mobile);

  return (
    <>
      {/* Fixed bar, shown at the top of the page and tucked away while scrolling down. The hero
          is offset below it in globals.css so it never sits across the photograph. */}
      <SiteNav revealOnScroll />

      {/* Sits under the fixed navbar and is painted its colour — see .home-hero-gap. */}
      <div aria-hidden className="home-hero-gap" />

      {/* Padding is deliberately bottom-heavy. The block is centred in the grid, so the extra
          bottom padding lifts the whole thing off the cookies along the lower edge of the photo,
          which the button row was sitting on top of. */}
      <section className="home-hero" style={{ position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', padding: 'clamp(36px,5vw,64px) 0 clamp(76px,11vw,132px)' }}>
        {/* Background photo — starts zoomed in, then eases out so the edge cookies drift into frame.
            Plain <picture>/<img> rather than next/image: art direction needs two sources behind a
            media query, which next/image's single-src API can't express. */}
        <motion.div aria-hidden
          initial={{ scale: 1.18 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <picture>
            <source media="(max-width: 680px)" srcSet={mobileSrc} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={desktopSrc} alt="" fetchPriority="high" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          </picture>
        </motion.div>

        {/*
          The photograph as a link, when the admin has given it a destination.

          A transparent anchor over the photo and UNDER the copy (z-index 1 against the copy's 3),
          rather than wrapping the whole hero: the headline block contains two buttons of its own, and
          nesting them inside a link is invalid markup that leaves the browser to guess which one a
          tap meant. Layered this way the photo is the link and the buttons are the buttons, with
          nothing to intercept and no click handler to fight.
        */}
        {banner.href && (
          <a href={banner.href} aria-label={banner.alt || 'See more'}
            style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'block' }} />
        )}

        {/* Center content — stood down while a bare offer banner is up (see `bare` above). */}
        {!bare && (
        <motion.div className="home-hero-copy" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative', zIndex: 3, textAlign: 'center', padding: '0 var(--gutter)', maxWidth: 720 }}>
          {/* White wordmark, as in the navbar and footer. The asset is amber, which only read
              against the old cream wash — on the orange art it would sink into the background.
              Same crush-to-black-then-invert trick those two already use. */}
          {/* The asset bakes in ~22% transparent space below "Aroma of Freshness", so a 10px margin
              rendered as a ~55px hole between the wordmark and the headline. The negative bottom
              margin crops that dead space back; it is expressed in vw so it tracks the image's own
              clamp() sizing instead of drifting apart from it at other widths. */}
          <Image src="/assets/adc-logo.png" width={480} height={347} alt="a dough cookie" priority
            style={{ width: 'clamp(230px,36vw,400px)', height: 'auto', margin: '0 auto clamp(-38px,-3.4vw,-20px)', filter: 'brightness(0) invert(1)' }} />
          {/* White copy with a soft dark shadow, rather than dark-brown text haloed in white: over
              busy cookie photography the halo read as a smudge, while plain white stays crisp. */}
          <h1 style={{ font: '900 clamp(1.35rem,1.05rem + 1.7vw,2.2rem)/1.08 var(--font-display)', letterSpacing: '-.02em', color: 'var(--white)', textShadow: '0 2px 12px rgba(90,40,0,.45)', margin: '0 0 12px', textWrap: 'balance' }}>
            Indulge in chunky, gooey, eggless cookies, freshly baked and delivered warm to your door.
          </h1>
          {/* The supporting paragraph is gone. The headline already says the whole thing, and three
              more lines of ingredient copy over a photograph is a paragraph nobody reads on the way
              to the button — the ingredients have their own section further down, with pictures. */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <button onClick={scrollToProducts} style={ctaPrimary}>Order Cookies <ArrowRight size={16} /></button>
            <button onClick={() => router.push('/about')} style={ctaGhost}>Our Story</button>
          </div>
        </motion.div>
        )}

        {/* The bouncing scroll-down chevron is gone. "Order Cookies" above already scrolls to the
            menu, so it was a second control doing the same thing, animating forever at the foot of
            the photograph. */}
      </section>
    </>
  );
}
