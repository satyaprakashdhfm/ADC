'use client';
import { useEffect, useRef, useState } from 'react';

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
   * Presented as a card rather than a line of text.
   *
   * It was set at the same size and weight as the copyright and the policy links it sits between,
   * so the one genuinely interesting number in the footer — and the only thing on the page that
   * moves — read as small print and got skimmed with it. A panel of its own, a larger figure and a
   * live dot give it somewhere to be noticed.
   *
   * Not a button, though it borrows the shape: nothing happens when you press it, and a card that
   * looks clickable and isn't is a worse outcome than one that goes unnoticed. No hover state and
   * no pointer cursor, for the same reason.
   */
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 11,
        padding: '12px 22px', borderRadius: 'var(--radius-pill)',
        /* Deep warm near-black, the token the theme already reserves for badge fills. A white tint
           over an orange footer is barely a shade lighter than the orange, which is why this did
           not stand out at all — it needs to leave the background colour, not sit on it. */
        background: 'var(--ink-950)',
        boxShadow: '0 3px 14px var(--black-18)',
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ad06a', boxShadow: '0 0 0 3px rgba(58,208,106,.28)', flex: 'none' }} />
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
        <b style={{ color: 'var(--amber-300)', font: '900 var(--text-lg)/1 var(--font-display)', letterSpacing: '-.01em' }}>
          {n.toLocaleString('en-IN')}+
        </b>
        <span style={{ color: 'var(--cream-100-72)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '.02em' }}>
          cookies baked &amp; sold
        </span>
      </span>
    </div>
  );
}
