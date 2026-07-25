'use client';
import { ArrowRight } from 'lucide-react';
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
 * Homepage Instagram strip — a horizontal snap-scroll row of 9:16 reel tiles.
 *
 * Each tile is Instagram's own /embed iframe, so no API key, access token or third-party script
 * is involved (the Graph API would need a Business account + app review just to list reels).
 * The trade-off: the embed is a plain iframe we can't restyle inside, so the tile owns the
 * rounded frame and the iframe simply fills it.
 *
 * With no reels configured yet (see src/lib/reels.ts) this renders the follow-CTA alone rather
 * than an empty rail — the section is still useful the moment it ships, and fills in with real
 * reels as soon as shortcodes are pasted into that file.
 */
export default function InstagramReels() {
  const hasReels = REELS.length > 0;

  return (
    <section id="instagram" style={{ padding: 'clamp(26px,4.5vw,72px) 0', background: 'var(--band-ivory)' }}>
      <div style={{ maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 'clamp(16px,2vw,28px)' }}>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>
              @{INSTAGRAM_HANDLE}
            </p>
            <h2 style={{ font: '900 clamp(1.5rem,1.1rem + 1.7vw,2.25rem)/1.08 var(--font-display)', letterSpacing: '-.02em', margin: 0, color: 'var(--text-strong)' }}>
              ADC on Instagram
            </h2>
          </div>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none', boxShadow: 'var(--shadow-brand)', flex: 'none' }}>
            <InstagramGlyph size={16} /> Follow us
          </a>
        </div>

        {hasReels ? (
          <div className="hide-sb reels-rail"
            style={{ display: 'flex', gap: 'clamp(12px,1.5vw,18px)', overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
            {REELS.map(r => (
              <figure key={r.id}
                style={{ flex: 'none', width: 'clamp(210px,60vw,264px)', margin: 0, scrollSnapAlign: 'start', borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--surface-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', background: 'var(--surface-sunken)' }}>
                  <iframe
                    src={`${reelUrl(r.id)}embed/`}
                    title={r.caption}
                    loading="lazy"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    scrolling="no"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
                <figcaption style={{ padding: '10px 12px 12px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {r.caption}
                </figcaption>
              </figure>
            ))}
          </div>
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
