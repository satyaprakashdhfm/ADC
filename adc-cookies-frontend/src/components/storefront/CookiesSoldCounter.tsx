'use client';
import { useEffect, useRef, useState } from 'react';
import { Cookie } from 'lucide-react';

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
  /*
   * The footer's brand column, as a full-height celebration panel.
   *
   * It began as a line of text at the same size and weight as the copyright and policy links it sat
   * between, so the one genuinely interesting number in the footer — and the only thing on the page
   * that moves — read as small print. Then a pill in that same crowded centre strip. It now owns the
   * bottom of the brand column and runs to the foot of the columns row, so it is sized and dressed
   * for that: two warm glows, the cookie mark, the figure at h2, and a live line saying it is still
   * counting.
   *
   * Content is centred and the box is height:100%, so it stays composed whatever height the column
   * hands it — that depends on how long the neighbouring copy runs, which is not fixed.
   *
   * Not a button, though it borrows the shape: nothing happens when you press it, and a card that
   * looks clickable and isn't is a worse outcome than one that goes unnoticed. No hover state and
   * no pointer cursor, for the same reason.
   */
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 150,
        boxSizing: 'border-box',
        padding: '22px 20px',
        borderRadius: 'var(--radius-card)',
        /* Deep warm near-black, the token the theme already reserves for badge fills. A white tint
           over an orange footer is barely a shade lighter than the orange, which is why the original
           did not stand out at all — it needs to leave the background colour, not sit on it. */
        background: 'var(--ink-950)',
        border: '1px solid var(--white-16)',
        boxShadow: '0 6px 20px var(--black-18)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      {/* Warm glows, opposite corners, for depth on a large flat panel. Decorative only and
          pointer-events-free so they can never swallow a tap meant for something underneath. */}
      <span aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, var(--brand-scrim-16) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <span aria-hidden style={{ position: 'absolute', bottom: -46, left: -46, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, var(--brand-scrim-16) 0%, transparent 72%)', pointerEvents: 'none' }} />

      <span aria-hidden style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none', boxShadow: '0 3px 12px var(--black-28)' }}>
        <Cookie size={24} color="var(--white)" />
      </span>

      <div style={{ position: 'relative' }}>
        <b style={{ display: 'block', color: 'var(--amber-300)', font: `900 var(--text-h2)/1 var(--font-display)`, letterSpacing: '-.02em' }}>
          {n.toLocaleString('en-IN')}+
        </b>
        <span style={{ display: 'block', marginTop: 4, color: 'var(--cream-100-72)', fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.02em' }}>
          cookies baked &amp; sold
        </span>
      </div>

      {/* The number really is ticking, and this is what says so. */}
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 'var(--radius-pill)', background: 'var(--white-16)' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ad06a', boxShadow: '0 0 0 3px rgba(58,208,106,.28)', flex: 'none' }} />
        <span style={{ color: 'var(--cream-100-72)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          counting live
        </span>
      </span>
    </div>
  );
}
