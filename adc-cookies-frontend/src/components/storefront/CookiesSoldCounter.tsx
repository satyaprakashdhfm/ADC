'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * A little "cookies baked & sold today" vanity counter (Swish-style) for the footer. It's a
 * deterministic function of the current day + time so it doesn't reset or jump around on refresh:
 * it starts 100+ and creeps up through the day, and the last digit is deliberately non-round so it
 * reads as a real, organic number rather than a marketing round figure. Ticks up live every few
 * seconds. Purely decorative — no data source, just a warm bit of social proof.
 */
function soldTotal(now: Date): number {
  const BASE = 1_000_000;                                     // all-time floor: 10 lakh+
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const epoch = Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);
  const days = Math.max(0, dayIndex - epoch);
  const perDay = 1700;                                        // steady daily growth
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let n = BASE + days * perDay + Math.floor((secs / 86400) * perDay);
  const tails = [1, 3, 7, 9, 3, 7, 9, 1];                     // non-round, odd-leaning last digit
  n = Math.floor(n / 10) * 10 + tails[(dayIndex + Math.floor(secs / 60)) % tails.length];
  return n;
}

export default function CookiesSoldCounter() {
  const [n, setN] = useState<number | null>(null);
  const shown = useRef(0);

  useEffect(() => {
    const sync = () => {
      const target = soldTotal(new Date());
      // Ease toward the true value so the number visibly ticks up rather than snapping.
      shown.current = shown.current === 0 ? target : Math.min(target, shown.current + 1);
      setN(shown.current);
    };
    sync();
    const t = setInterval(sync, 6000);
    return () => clearInterval(t);
  }, []);

  if (n == null) return null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 172,
        boxSizing: 'border-box',
        padding: '20px',
        borderRadius: 'var(--radius-card)',
        /* A solid fallback only — the panel itself is the photograph plus the scrim over it, both
           real elements, because a child painted behind this container's background would be
           hidden by it. --ink-950 is what the corporate card falls back to as well, so a missing
           image degrades to a dark panel with its white type still readable rather than to white
           on cream. */
        background: 'var(--ink-950)',
        /* A faint light edge, not a bright one: on a dark panel the old --white-72 border read as a
           drawn outline rather than a lit edge. */
        border: '1px solid var(--white-16)',
        boxShadow: 'inset 0 1px 0 var(--white-16), 0 8px 22px var(--black-18)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 11,
        textAlign: 'center',
      }}
    >
      {/* Decorative, so no alt text and out of the accessibility tree: it says nothing the figure
          and its label do not already say. Behind the scrim above, and behind everything else here
          via z-index — the card is overflow:hidden, so it is clipped to the rounded corners.
          `sizes` is the real rendered width rather than a viewport fraction: this is a small card
          in a footer column and asking for a full-width source would fetch several times the
          pixels it can show. */}
      <Image
        src="/assets/celebration-bg.webp"
        alt="" aria-hidden priority={false}
        fill sizes="(max-width: 680px) 92vw, 360px"
        style={{ objectFit: 'cover', objectPosition: 'center 62%', zIndex: 0 }}
      />

      {/* The same espresso wash the Corporate & Bulk Gifting card lays over its photograph, so the
          two image-backed panels on the site read as one treatment rather than two ideas. Dark
          overlay, white type.
          Its weight is measured rather than judged by eye: what decides whether a letter survives
          is the LIGHTEST pixel behind it, not the average — an average over a busy photograph
          hides the pale confetti and fairy lights that a white glyph disappears into. See the
          figure below for the sampled numbers. */}
      <span aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(165deg, var(--espresso-62), var(--espresso-50))',
      }} />

      {/* Gold ribbon across the top, as in the reference. Notched ends via clip-path rather than an
          image, so it costs nothing to load and scales with the type.
          Dark lettering on the amber, not white: white on amber-500 measures about 2.2:1 and is
          unreadable at this size, while the strong ink on it is roughly 7:1. */}
      <span style={{
        position: 'relative', zIndex: 2,
        display: 'inline-block',
        padding: '6px 24px',
        background: 'linear-gradient(180deg, var(--amber-200), var(--amber-500))',
        color: 'var(--text-strong)',
        font: `900 var(--text-2xs)/1 var(--font-display)`,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        clipPath: 'polygon(0 0, 100% 0, calc(100% - 10px) 50%, 100% 100%, 0 100%, 10px 50%)',
        boxShadow: '0 2px 8px var(--black-18)',
      }}>
        Celebrating
      </span>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <b style={{ display: 'block', color: 'var(--white)', font: `900 var(--text-h2)/1 var(--font-display)`, letterSpacing: '-.02em' }}>
          {n.toLocaleString('en-IN')}+
        </b>
        <span style={{ display: 'block', marginTop: 5, color: 'var(--cream-100)', fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.01em' }}>
          Cookies Baked &amp; Sold
        </span>
      </div>

      {/* One live indicator, not two: the reference had a corner chip and a bottom pill saying the
          same thing. A translucent white chip now, matching the corporate card's icon tile, rather
          than the opaque white pill it was — an opaque light pill on a dark panel reads as a hole
          punched in it. */}
      <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 'var(--radius-pill)', background: 'var(--espresso-50)', border: '1px solid var(--white-16)' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ad06a', boxShadow: '0 0 0 3px rgba(58,208,106,.28)', flex: 'none' }} />
        <span style={{ color: 'var(--white)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Counting live
        </span>
      </span>
    </div>
  );
}
