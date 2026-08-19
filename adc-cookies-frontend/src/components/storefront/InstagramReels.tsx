'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Volume2, VolumeX, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { REELS, INSTAGRAM_HANDLE, INSTAGRAM_URL, reelVideo } from '@/lib/reels';

// lucide-react dropped its brand icons, so the Instagram glyph is inlined — same approach the
// floating dock already uses for the WhatsApp mark.
const InstagramGlyph = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

/*
 * "A Dough Cookie on Social Media" — a rail of self-hosted reels that autoplay silently and loop,
 * with a YouTube-style sound toggle per tile. No Instagram chrome, no like/view counts.
 *
 * Lazy by necessity: eleven clips is ~19MB, so nothing is fetched up front. Each tile only gets a
 * `src` once it scrolls near the viewport (IntersectionObserver, generous rootMargin so it is
 * loaded before it is seen), plays while on screen, and pauses when it leaves — so a visitor who
 * never reaches this section downloads none of it, and one who does downloads only what they pass.
 *
 * Rotation copies the Reviews marquee: the list is rendered twice and scrollLeft advances a
 * fraction of a pixel per frame, wrapping at the halfway point for a seamless loop. It pauses on
 * hover, during an arrow nudge, and whenever a tile has its sound on — nobody wants the clip
 * they're listening to to slide out of view.
 */
export default function InstagramReels() {
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const pos = useRef(0);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  // Index of the tile with sound on (null = all muted). Only ever one at a time.
  const [audible, setAudible] = useState<number | null>(null);
  // Mirrored into a ref so the marquee's once-bound mouseleave handler can read the current value
  // without the animation effect needing to re-run (and restart) on every sound toggle.
  const audibleRef = useRef<number | null>(null);

  const hasReels = REELS.length > 0;
  // Rendered twice for the seamless wrap, exactly like the reviews marquee.
  const tiles = hasReels ? [...REELS, ...REELS] : [];

  // Attach/observe each tile: load + play near the viewport, pause once past it.
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (!hasReels || typeof IntersectionObserver === 'undefined') return;
    observer.current = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            // Assign src on first approach — this is what keeps the 19MB off the initial load.
            if (!v.src && v.dataset.src) v.src = v.dataset.src;
            v.play().catch(() => { /* autoplay policy or not yet buffered — harmless */ });
          } else {
            v.pause();
          }
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.1 },
    );
    videos.current.forEach(v => { if (v) observer.current?.observe(v); });
    return () => observer.current?.disconnect();
  }, [hasReels]);

  const registerVideo = useCallback((el: HTMLVideoElement | null, i: number) => {
    videos.current[i] = el;
    if (el) observer.current?.observe(el);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el || !hasReels) return;
    let raf = 0;
    const speed = 0.5; // px per frame — slow, premium glide
    pos.current = el.scrollLeft;
    const tick = () => {
      if (el && !paused.current) {
        const half = el.scrollWidth / 2;
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
    const leave = () => { if (audibleRef.current === null) { pos.current = el.scrollLeft; paused.current = false; } };
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); };
  }, [hasReels]);

  useEffect(() => {
    audibleRef.current = audible;
    const el = track.current;
    if (!el) return;
    if (audible !== null) paused.current = true;
    else { pos.current = el.scrollLeft; paused.current = false; }
  }, [audible]);

  const nudge = (dir: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    paused.current = true;
    el.scrollBy({ left: dir * 300, behavior: 'smooth' });
    window.setTimeout(() => { pos.current = el.scrollLeft; if (audibleRef.current === null) paused.current = false; }, 1400);
  };

  // Unmuting one tile mutes every other — never two clips talking over each other.
  const toggleSound = (i: number) => {
    const next = audible === i ? null : i;
    videos.current.forEach((v, j) => {
      if (!v) return;
      v.muted = j !== next;
      if (j === next) v.play().catch(() => { /* autoplay policy — ignore */ });
    });
    setAudible(next);
  };

  const arrow: React.CSSProperties = {
    width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--border-default)',
    background: 'var(--surface-card)', color: 'var(--text-strong)', cursor: 'pointer',
    display: 'grid', placeItems: 'center', flex: 'none', boxShadow: 'var(--shadow-sm)',
  };

  return (
    <section id="instagram" style={{ padding: 'clamp(26px,4.5vw,72px) 0', background: 'var(--band-ivory)' }}>
      <div style={{ maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter)' }}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto clamp(18px,2.5vw,32px)' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>
            {INSTAGRAM_HANDLE}
          </p>
          <h2 style={{ font: '900 clamp(1.5rem,1.1rem + 1.7vw,2.25rem)/1.08 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 10px', color: 'var(--text-strong)' }}>
            A Dough Cookie on Social Media
          </h2>
          <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--text-body)', margin: 0 }}>
            Fresh batches, new flavours and far too many gooey close-ups. Tap the speaker for sound.
          </p>
        </div>

        {hasReels ? (
          <>
            <div ref={track} className="hide-sb"
              style={{ display: 'flex', gap: 'clamp(12px,1.5vw,18px)', overflowX: 'auto', scrollBehavior: 'auto' }}>
              {tiles.map((r, i) => (
                <div key={`${r.id}-${i}`}
                  style={{ position: 'relative', flex: 'none', width: 'clamp(210px,58vw,262px)', borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--ink-900)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16' }}>
                    <video
                      ref={el => registerVideo(el, i)}
                      data-src={reelVideo(r.id)}
                      muted
                      loop
                      playsInline
                      preload="none"
                      aria-label={r.caption || 'A Dough Cookie reel'}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {/* Sound toggle — the only control, bottom-right like a YouTube Short */}
                    <button
                      onClick={() => toggleSound(i)}
                      aria-label={audible === i ? 'Mute video' : 'Unmute video'}
                      style={{
                        position: 'absolute', bottom: 10, right: 10, zIndex: 2,
                        width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: 'var(--black-55)', color: 'var(--white)',
                        display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)',
                      }}
                    >
                      {audible === i ? <Volume2 size={17} /> : <VolumeX size={17} />}
                    </button>
                    {/* Caption sits over the base of the clip, on a soft scrim so it stays legible */}
                    {r.caption && (
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '26px 52px 10px 12px', background: 'linear-gradient(to top, var(--black-55), transparent)', color: 'var(--white)', fontSize: 'var(--text-xs)', fontWeight: 700, lineHeight: 1.35 }}>
                        {r.caption}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="reels-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 'clamp(14px,2vw,22px)' }}>
              <button onClick={() => nudge(-1)} aria-label="Previous reels" style={arrow}><ChevronLeft size={19} /></button>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none', boxShadow: 'var(--shadow-brand)' }}>
                <InstagramGlyph size={16} /> Follow @{INSTAGRAM_HANDLE}
              </a>
              <button onClick={() => nudge(1)} aria-label="More reels" style={arrow}><ChevronRight size={19} /></button>
            </div>
          </>
        ) : (
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px,2vw,22px)', padding: 'clamp(18px,2.5vw,28px)', borderRadius: 'var(--radius-card)', background: 'var(--surface-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)', textDecoration: 'none', flexWrap: 'wrap' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', flex: 'none' }}>
              <InstagramGlyph size={26} />
            </span>
            <span style={{ flex: '1 1 240px', minWidth: 0 }}>
              <span style={{ display: 'block', font: 'var(--weight-bold) var(--text-lg)/1.2 var(--font-display)', color: 'var(--text-strong)', marginBottom: 4 }}>
                Fresh batches, daily — on our Instagram
              </span>
              <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Behind-the-scenes bakes, new flavours and gooey close-ups. Follow @{INSTAGRAM_HANDLE} for the good stuff.
              </span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)', flex: 'none' }}>
              Open Instagram <ArrowRight size={16} />
            </span>
          </a>
        )}
      </div>
    </section>
  );
}
