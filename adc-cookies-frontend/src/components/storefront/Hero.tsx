'use client';
import { useState, useEffect, useRef, CSSProperties } from 'react';
import Image from 'next/image';
import Nav from './Nav';
import { useRouter } from 'next/navigation';

const SLIDES = [
  { n: 'ADC Special', tag: 'Signature', line: 'Our most loved cookie, ever.', desc: 'Handcrafted with browned butter, three kinds of premium chocolate and Maldon sea-salt flakes. Baked fresh every morning.', img: '/assets/products/adc-special.jpg', video: '/assets/hero-video.mp4', bg: '#1A1008' },
  { n: 'Matcha', tag: 'Premium', line: 'Earthy, creamy, addictive.', desc: 'Stone-ground ceremonial matcha from Uji, Japan folded into our buttery dough with cacao-butter white chocolate chips.', img: '/assets/products/matcha.jpg', video: '/assets/hero-video-matcha.mp4', bg: '#0D1A10' },
  { n: 'Triple Chocolate', tag: 'Bestseller', line: 'Warm dough. Three kinds of chocolate.', desc: 'Dark, milk and white chocolate folded into a deep cocoa dough. Rich, fudgy and completely impossible to stop at one.', img: '/assets/products/triple-choc.jpg', video: '/assets/hero-video-triple-choc.mp4', bg: '#1A0E06' },
  { n: 'Red Velvet', tag: 'Premium', line: 'Bold cocoa. Silky cream cheese.', desc: 'Deep cocoa-red velvet dough wrapped around a tangy cream-cheese centre. Our most dramatic cookie.', img: '/assets/products/red-velvet.jpg', video: '/assets/hero-video-red-velvet.mp4', bg: '#1A0508' },
  { n: 'Blueberry', tag: 'Classic', line: 'Butter, blueberry, pure joy.', desc: 'Buttery golden dough studded with plump blueberries and a hint of lemon zest. Simple, seasonal and utterly satisfying.', img: '/assets/products/blueberry.jpg', video: '/assets/hero-video-blueberry.mp4', bg: '#0A0D1A' },
];

interface HeroProps { onMenuOpen: () => void; }

export default function Hero({ onMenuOpen }: HeroProps) {
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % SLIDES.length), 7000);
    return () => clearInterval(t);
  }, []);

  const s = SLIDES[idx];

  return (
    <section style={{ height: '100vh', background: s.bg, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'background .8s ease' }}>
      {/* Videos */}
      {SLIDES.map((sl, i) => (
        <video
          key={sl.n}
          autoPlay
          loop
          playsInline
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

      {/* Nav */}
      <div style={{ position: 'relative', zIndex: 2 }}>
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
            whiteSpace: 'nowrap',
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
