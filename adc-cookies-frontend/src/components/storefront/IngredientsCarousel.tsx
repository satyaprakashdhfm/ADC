'use client';
import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Ingredient { n: string; title: string; text: string; }

const arrowBtn: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 5,
  width: 42, height: 42, borderRadius: '50%', cursor: 'pointer',
  border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-strong)',
  display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-md)',
};

/**
 * The Finest Ingredients — same sideways marquee as the reviews strip: a smooth, continuous
 * auto-scroll (cards rendered twice for a seamless loop) that pauses on hover, with arrows at the
 * far ends to nudge it. Keeps the section short instead of running tall as a stacked grid.
 */
export default function IngredientsCarousel({ items }: { items: Ingredient[] }) {
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const pos = useRef(0); // float scroll position so sub-pixel speed accumulates

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const speed = 0.6; // px per frame — slow, premium glide (matches the reviews strip)
    pos.current = el.scrollLeft;
    const tick = () => {
      if (el && !paused.current) {
        const half = el.scrollWidth / 2; // second copy is identical → seamless wrap
        if (half > 0) {
          pos.current += speed;
          if (pos.current >= half) pos.current -= half;
          el.scrollLeft = pos.current;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const enter = () => { paused.current = true; };
    const leave = () => { pos.current = el.scrollLeft; paused.current = false; };
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); };
  }, []);

  const nudge = (dir: number) => {
    const el = track.current;
    if (!el) return;
    paused.current = true;
    el.scrollBy({ left: dir * 320, behavior: 'smooth' });
    window.setTimeout(() => { pos.current = el.scrollLeft; paused.current = false; }, 1400);
  };

  const cards = [...items, ...items];

  return (
    <div style={{ position: 'relative' }}>
      <button aria-label="Previous ingredient" onClick={() => nudge(-1)} style={{ ...arrowBtn, left: -6 }}><ChevronLeft size={20} /></button>

      <div ref={track} className="hide-sb" style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollBehavior: 'auto' }}>
        {cards.map((x, i) => (
          <div
            key={i}
            className="ingredient-card"
            style={{ flex: 'none', width: 'min(80vw, 320px)', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', padding: 'clamp(18px,2vw,26px)' }}
          >
            <div style={{ font: '900 clamp(1.5rem,1.1rem + 1vw,2.1rem)/1 var(--font-display)', color: 'var(--brand-secondary)', marginBottom: 8, letterSpacing: '-.02em' }}>{x.n}</div>
            <h4 style={{ font: 'var(--weight-extra) var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 8px' }}>{x.title}</h4>
            <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.55, color: 'var(--text-body)', margin: 0 }}>{x.text}</p>
          </div>
        ))}
      </div>

      <button aria-label="Next ingredient" onClick={() => nudge(1)} style={{ ...arrowBtn, right: -6 }}><ChevronRight size={20} /></button>
    </div>
  );
}
