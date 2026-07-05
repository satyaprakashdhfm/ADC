'use client';
import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Review { title: string; body: string; name: string; verified: boolean; city: string; img: string; }

const REVIEWS: Review[] = [
  { title: 'Gooey and unreal', body: 'The Biscoff filled is unreal — gooey, warm, perfect. My weekly ritual now.', name: 'Ananya R.', verified: true, city: 'Bengaluru', img: '/assets/products/adc-special.jpg' },
  { title: 'Best in the city', body: 'Arrived warm and smelled incredible — the signature cookie is the best in town.', name: 'Karthik M.', verified: true, city: 'Hyderabad', img: '/assets/products/triple-choc.jpg' },
  { title: 'Gifting done right', body: 'Beautiful packaging — gifted a Nutella tin and it was a total hit.', name: 'Sneha P.', verified: true, city: 'Mumbai', img: '/assets/products/caramel-cashew.jpg' },
  { title: 'Ordered 10 at once', body: 'Ordered 10 cookies all at once. Definitely better than expected — tasted too good. 😊', name: 'Vedant', verified: true, city: 'Delhi', img: '/assets/products/m-and-m.jpg' },
  { title: 'Soft centres every time', body: 'Every batch has that soft molten centre. The peanut butter one is my favourite.', name: 'Farah K.', verified: true, city: 'Bengaluru', img: '/assets/products/peanut-butter.jpg' },
  { title: 'Loved it', body: 'Very nice cookie, loved it. Ordering again this weekend for sure.', name: 'Pratham', verified: true, city: 'Pune', img: '/assets/products/red-velvet.jpg' },
];

const REVIEWS_URL = 'https://www.google.com/search?q=ADC+-+A+DOUGH+COOKIE+%28+Jayanagar+%29+Reviews';

const arrowBtn: React.CSSProperties = {
  position: 'absolute', top: '46%', transform: 'translateY(-50%)', zIndex: 5,
  width: 42, height: 42, borderRadius: '50%', cursor: 'pointer',
  border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-strong)',
  display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-md)',
};
const verifiedPill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 5,
  background: '#160D06', color: '#fff', fontSize: 'var(--text-2xs)', fontWeight: 700, letterSpacing: '.02em',
};
const clamp2: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };

/**
 * Customer reviews — compact image cards on a light band (only the footer stays brown).
 * Smooth, continuous marquee auto-scroll (cards rendered twice for a seamless loop); pauses on
 * hover; arrows at the far ends nudge it. Uses only brand ambers/creams — no new colors.
 */
export default function Reviews() {
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const pos = useRef(0); // float scroll position — set scrollLeft from this so sub-pixel speed accumulates

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const speed = 0.6; // px per frame — slow, premium glide
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
    el.scrollBy({ left: dir * 286, behavior: 'smooth' });
    window.setTimeout(() => { pos.current = el.scrollLeft; paused.current = false; }, 1400);
  };

  const cards = [...REVIEWS, ...REVIEWS];

  return (
    <section style={{ padding: 'clamp(20px,3vw,40px) 0', background: 'var(--cream-100)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
      <div style={{ maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter)' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 4px' }}>Customer Love</p>
          <h2 style={{ font: 'var(--weight-extra) clamp(1.4rem,1rem + 1.8vw,2.4rem)/1.05 var(--font-display)', color: 'var(--text-strong)', margin: 0, letterSpacing: '-.02em' }}>People can&apos;t stop</h2>
        </div>

        <div style={{ position: 'relative' }}>
          <button aria-label="Previous review" onClick={() => nudge(-1)} style={{ ...arrowBtn, left: -6 }}><ChevronLeft size={20} /></button>

          <div ref={track} className="hide-sb" style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollBehavior: 'auto' }}>
            {cards.map((rv, i) => (
              <article key={i} className="review-card" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                <div className="rv-inner" style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 7 }}>
                  <div aria-hidden className="rv-stars" style={{ color: 'var(--amber-500)', fontSize: 14, letterSpacing: 2 }}>★★★★★</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="rv-name" style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-xs)' }}>{rv.name}</span>
                    {rv.verified && <span style={verifiedPill}>Verified</span>}
                  </div>
                  <h3 className="rv-title" style={{ font: 'var(--weight-bold) var(--text-sm)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '1px 0 0' }}>{rv.title}</h3>
                  <p className="rv-body" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', lineHeight: 1.45, margin: 0, ...clamp2 }}>{rv.body}</p>
                </div>
              </article>
            ))}
          </div>

          <button aria-label="Next review" onClick={() => nudge(1)} style={{ ...arrowBtn, right: -6 }}><ChevronRight size={20} /></button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <a href={REVIEWS_URL} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 22px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', boxShadow: 'var(--shadow-brand)' }}>Read more reviews</a>
        </div>
      </div>
    </section>
  );
}
