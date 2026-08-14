'use client';
import { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Ingredient { n: string; title: string; text: string; img?: string }

const arrowBtn: React.CSSProperties = {
  position: 'absolute', top: '42%', transform: 'translateY(-50%)', zIndex: 5,
  width: 42, height: 42, borderRadius: '50%', cursor: 'pointer',
  border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-strong)',
  display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-md)',
};

/** Ingredient image = top half of the card (4:3). Falls back to a branded gradient + number tile
 *  until the real photo (public/assets/ingredients/<slug>.jpg) is dropped in, so nothing 404s. */
function IngredientImage({ n, src, title }: { n: string; src?: string; title: string }) {
  const [ok, setOk] = useState(!!src);
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'var(--gradient-warm)', overflow: 'hidden' }}>
      {ok && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} loading="lazy" onError={() => setOk(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {/* Only when there is no photograph to show. Over a real one the number was a white figure
          stamped across the corner of the shot, competing with it and counting a list nobody is
          reading in order — but as the whole content of an empty tile it still beats a blank
          orange rectangle if an image ever 404s. */}
      {!ok && (
        <span aria-hidden style={{ position: 'absolute', top: 10, left: 12, font: '900 clamp(1.5rem,1.1rem + 1vw,2.1rem)/1 var(--font-display)', color: 'var(--white)', letterSpacing: '-.02em', textShadow: '0 2px 8px rgba(0,0,0,.25)' }}>{n}</span>
      )}
    </div>
  );
}

/**
 * The Finest Ingredients — a gentle sideways auto-scroll through the FIVE unique cards (no doubling,
 * so nothing ever visibly repeats): it eases forward, then smoothly returns to the first card and
 * goes again. Pauses on hover; arrows nudge it. Each card is half image (top) / half text (below).
 */
export default function IngredientsCarousel({ items }: { items: Ingredient[] }) {
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const returning = useRef(false);
  const pos = useRef(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const speed = 0.5; // px/frame — slow, premium glide
    pos.current = el.scrollLeft;
    const tick = () => {
      if (el && !paused.current && !returning.current) {
        const max = el.scrollWidth - el.clientWidth;
        if (max > 4) {
          pos.current += speed;
          if (pos.current >= max) {
            // Reached the last card — ease back to the start, then resume (only 5, no duplicate).
            returning.current = true;
            el.scrollTo({ left: 0, behavior: 'smooth' });
            window.setTimeout(() => { pos.current = 0; returning.current = false; }, 1000);
          } else {
            el.scrollLeft = pos.current;
          }
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
    returning.current = true;
    el.scrollBy({ left: dir * 340, behavior: 'smooth' });
    window.setTimeout(() => { pos.current = el.scrollLeft; paused.current = false; returning.current = false; }, 1200);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button aria-label="Previous ingredient" onClick={() => nudge(-1)} style={{ ...arrowBtn, left: -6 }}><ChevronLeft size={20} /></button>

      <div ref={track} className="hide-sb" style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollBehavior: 'auto' }}>
        {items.map((x) => (
          <div
            key={x.n}
            className="ingredient-card"
            style={{ flex: 'none', width: 'min(82vw, 320px)', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <IngredientImage n={x.n} src={x.img} title={x.title} />
            <div style={{ padding: 'clamp(16px,1.8vw,22px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h4 style={{ font: 'var(--weight-extra) var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{x.title}</h4>
              <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.55, color: 'var(--text-body)', margin: 0 }}>{x.text}</p>
            </div>
          </div>
        ))}
      </div>

      <button aria-label="Next ingredient" onClick={() => nudge(1)} style={{ ...arrowBtn, right: -6 }}><ChevronRight size={20} /></button>
    </div>
  );
}
