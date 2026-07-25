'use client';
import { useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { REELS, INSTAGRAM_HANDLE, INSTAGRAM_URL, reelUrl } from '@/lib/reels';

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
 * "A Dough Cookie on Social Media" — a horizontal reel rail, laid out like the marketplace
 * cookie sites: centred heading, portrait 9:16 tiles that snap as you swipe, arrows on desktop.
 *
 * Each tile is Instagram's own /embed iframe, so no API key, access token or third-party script
 * is involved (the Graph API would need a Business account + app review just to list reels).
 * The trade-off: the embed is an opaque iframe we can't restyle inside, so the tile owns the
 * rounded frame and the iframe simply fills it.
 *
 * With no reels configured yet (see src/lib/reels.ts) this renders the follow-CTA alone rather
 * than an empty rail, so the section is never a broken shell.
 */
export default function InstagramReels() {
  const rail = useRef<HTMLDivElement>(null);
  const hasReels = REELS.length > 0;

  const nudge = (dir: -1 | 1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const arrow: React.CSSProperties = {
    width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--border-default)',
    background: 'var(--surface-card)', color: 'var(--text-strong)', cursor: 'pointer',
    display: 'grid', placeItems: 'center', flex: 'none', boxShadow: 'var(--shadow-sm)',
  };

  return (
    <section id="instagram" style={{ padding: 'clamp(26px,4.5vw,72px) 0', background: 'var(--band-ivory)' }}>
      <div style={{ maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter)' }}>
        {/* Centred heading, like the reference layout */}
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto clamp(18px,2.5vw,32px)' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>
            @{INSTAGRAM_HANDLE}
          </p>
          <h2 style={{ font: '900 clamp(1.5rem,1.1rem + 1.7vw,2.25rem)/1.08 var(--font-display)', letterSpacing: '-.02em', margin: '0 0 10px', color: 'var(--text-strong)' }}>
            A Dough Cookie on Social Media
          </h2>
          <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--text-body)', margin: 0 }}>
            Fresh batches, new flavours and far too many gooey close-ups.
          </p>
        </div>

        {hasReels ? (
          <>
            <div ref={rail} className="hide-sb"
              style={{ display: 'flex', gap: 'clamp(12px,1.5vw,18px)', overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
              {REELS.map(r => (
                <figure key={r.id}
                  style={{ flex: 'none', width: 'clamp(220px,62vw,280px)', margin: 0, scrollSnapAlign: 'start', borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--surface-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', background: 'var(--surface-sunken)' }}>
                    <iframe
                      src={`${reelUrl(r.id)}embed/`}
                      title={r.caption || 'Instagram reel'}
                      loading="lazy"
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                      scrolling="no"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    />
                  </div>
                  {r.caption && (
                    <figcaption style={{ padding: '10px 12px 12px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      {r.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>

            {/* Arrows + follow, below the rail. Hidden on phones, where swiping is the gesture. */}
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
