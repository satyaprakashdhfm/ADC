'use client';
import { useState, useEffect, useRef, CSSProperties } from 'react';
import Nav from './Nav';
import { useRouter } from 'next/navigation';
import { getProducts, firstImage } from '@/lib/api';

interface Slide { n: string; tag: string; line: string; desc: string; img: string; video: string; bg: string; }

/* Purely-presentational assets (hero video, backdrop colour, tagline) keyed by product
   name. The product set itself + names/prices/descriptions/which are featured all come
   from the database; this just maps each featured product to its cinematic treatment. */
const PRESENTATION: Record<string, { video: string; bg: string; line: string }> = {
  'ADC Special':            { video: '/assets/hero-video.mp4',             bg: '#1A1008', line: 'Our most loved cookie, ever.' },
  'Matcha':                 { video: '/assets/hero-video-matcha.mp4',      bg: '#0D1A10', line: 'Earthy, creamy, addictive.' },
  'Double Choc Chip':       { video: '/assets/hero-video-triple-choc.mp4', bg: '#1A0E06', line: 'Warm dough. Double the chocolate.' },
  'Red Velvet With Cheese': { video: '/assets/hero-video-red-velvet.mp4',  bg: '#1A0508', line: 'Bold cocoa. Silky cream cheese.' },
  'Biscoff Filled':         { video: '/assets/hero-video-blueberry.mp4',   bg: '#1A0E06', line: 'A molten Biscoff centre.' },
};
const DEFAULT_PRES = { video: '/assets/hero-video.mp4', bg: '#1A1008', line: 'Baked fresh every morning.' };

// Seconds to skip at the start of every hero video (the cookie-fall begins ~1s in).
const START_OFFSET = 1;

// Lead order for the slideshow (Signature first); any other featured items follow.
const LEAD_ORDER = ['ADC Special', 'Biscoff Filled', 'Matcha', 'Red Velvet With Cheese', 'Double Choc Chip'];

// Shown instantly on first paint and if the backend is unreachable.
const FALLBACK_SLIDES: Slide[] = LEAD_ORDER.map(n => ({
  n, tag: 'Featured', line: PRESENTATION[n]?.line ?? DEFAULT_PRES.line,
  desc: '', img: '/assets/products/adc-special.jpg',
  video: PRESENTATION[n]?.video ?? DEFAULT_PRES.video, bg: PRESENTATION[n]?.bg ?? DEFAULT_PRES.bg,
}));

interface HeroProps { onMenuOpen: () => void; }

export default function Hero({ onMenuOpen }: HeroProps) {
  const [idx, setIdx] = useState(0);
  const [slides, setSlides] = useState<Slide[]>(FALLBACK_SLIDES);
  const router = useRouter();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Build the slideshow from the DB's featured products.
  useEffect(() => {
    getProducts().then(products => {
      const featured = products.filter(p => p.featured);
      if (!featured.length) return;
      featured.sort((a, b) => {
        const ia = LEAD_ORDER.indexOf(a.name), ib = LEAD_ORDER.indexOf(b.name);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      setSlides(featured.map(p => {
        const pres = PRESENTATION[p.name] ?? DEFAULT_PRES;
        return { n: p.name, tag: p.tag || 'Featured', line: pres.line, desc: p.description || '',
                 img: firstImage(p.images), video: pres.video, bg: pres.bg };
      }));
      setIdx(0);
    }).catch(() => {}); // keep fallback slides on error
  }, []);

  const SLIDES = slides;

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % SLIDES.length), 7000);
    return () => clearInterval(t);
  }, [SLIDES.length]);

  // Only the active slide's video plays. It starts 1s in (START_OFFSET) so the
  // cookie-fall action is on screen the instant the slide appears — not the dead
  // first second. Looping also restarts at START_OFFSET (see onEnded below).
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === idx) {
        const seekAndPlay = () => {
          try { v.currentTime = START_OFFSET; } catch {}
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        };
        if (v.readyState >= 2) seekAndPlay();            // HAVE_CURRENT_DATA — can seek now
        else v.addEventListener('loadeddata', seekAndPlay, { once: true });
      } else {
        v.pause();
      }
    });
  }, [idx, SLIDES]);

  const s = SLIDES[idx] ?? SLIDES[0];

  return (
    <section style={{ height: '100vh', background: s.bg, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'background .8s ease' }}>
      {/* Videos */}
      {SLIDES.map((sl, i) => (
        <video
          key={sl.n}
          muted
          playsInline
          preload="auto"
          onEnded={e => { const v = e.currentTarget; try { v.currentTime = START_OFFSET; } catch {} v.play().catch(() => {}); }}
          ref={el => {
            videoRefs.current[i] = el;
            if (el) { el.muted = true; el.volume = 0; }
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, opacity: i === idx ? 1 : 0, transition: 'opacity 1s ease' }}
        >
          <source src={sl.video} type="video/mp4" />
        </video>
      ))}

      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(10,6,2,.75) 0%,rgba(10,6,2,.35) 50%,rgba(10,6,2,.15) 100%)', zIndex: 1 }} />

      {/* Nav — above the centered-text overlay so the Menu button stays clickable */}
      <div style={{ position: 'relative', zIndex: 30 }}>
        <Nav onMenuOpen={onMenuOpen} />
      </div>

      {/* Centered text */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative', zIndex: 2, padding: '0 var(--gutter)' }}>
        <div style={{ maxWidth: 680 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(242,159,5,.22)', backdropFilter: 'blur(8px)',
            borderRadius: 'var(--radius-pill)', padding: '5px 16px', marginBottom: 20,
          }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: '#F8C24D', letterSpacing: '.08em', textTransform: 'uppercase' }}>{s.tag}</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(3rem,2rem + 5vw,6.5rem)',
            lineHeight: .9, letterSpacing: '-.03em', color: '#fff', margin: '0 0 20px',
            textShadow: '0 4px 24px rgba(0,0,0,.4)',
            textAlign: 'center', textWrap: 'balance',
          }}>{s.n}</h1>
          <p style={{ fontSize: 'var(--text-lg)', color: 'rgba(255,245,220,.8)', margin: '0 0 32px', fontWeight: 400, lineHeight: 1.6, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as CSSProperties}>{s.desc}</p>
          <button
            onClick={() => router.push('/order')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '17px 42px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff',
              fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-lg)', whiteSpace: 'nowrap',
              boxShadow: '0 12px 32px rgba(239,117,7,.45)', transition: 'transform .2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
          >Order Now</button>
        </div>
      </div>

      {/* Dots */}
      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 3 }}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            style={{
              width: i === idx ? 28 : 8, height: 8, borderRadius: 99, padding: 0, border: 'none', cursor: 'pointer',
              background: i === idx ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.35)',
              transition: 'all .3s ease',
            }}
          />
        ))}
      </div>
    </section>
  );
}
