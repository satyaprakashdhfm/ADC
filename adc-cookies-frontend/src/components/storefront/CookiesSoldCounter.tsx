'use client';
import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';

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

  /* Confetti — a few white specks and stars, placed rather than random so the layout is identical
     on the server and on every repaint. Purely decorative and pointer-events-free. */
  const specks: { top: string; left: string; size: number; kind: 'star' | 'dot'; o: number }[] = [
    { top: '13%', left: '8%',  size: 13, kind: 'star', o: 0.60 },
    { top: '22%', left: '85%', size: 10, kind: 'star', o: 0.48 },
    { top: '70%', left: '6%',  size: 9,  kind: 'dot',  o: 0.42 },
    { top: '76%', left: '89%', size: 12, kind: 'star', o: 0.52 },
    { top: '46%', left: '94%', size: 7,  kind: 'dot',  o: 0.34 },
    { top: '88%', left: '32%', size: 7,  kind: 'dot',  o: 0.32 },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 150,
        boxSizing: 'border-box',
        padding: '20px',
        borderRadius: 'var(--radius-card)',
        /* Milky glass, not smoked. A white tint over the footer's own orange lands near #F5AC6A at
           the top and #D97B31 at the foot — a lighter shade of the footer rather than a dark block
           on it, which is what looked odd here.
           Going lighter is why the type is dark: white on this measures about 2.5:1 and would fail
           outright, whereas --text-strong on it runs 5.2:1 to 8.4:1. There is no readable way to
           keep both a light panel and white text. */
        background: 'linear-gradient(165deg, var(--white-40), var(--white-16))',
        /* Bright edge, inner highlight and a soft drop are what read as glass. No backdrop-filter:
           the footer behind is a flat gradient, so blurring it costs a compositing layer and changes
           nothing visible. */
        border: '1px solid var(--white-72)',
        boxShadow: 'inset 0 1px 0 var(--white-72), 0 8px 22px var(--black-18)',
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
      {specks.map((sp, idx) => (
        <span key={idx} aria-hidden style={{ position: 'absolute', top: sp.top, left: sp.left, opacity: sp.o, pointerEvents: 'none', lineHeight: 0 }}>
          {sp.kind === 'star'
            ? <Star size={sp.size} color="var(--white)" fill="var(--white)" strokeWidth={0} />
            : <span style={{ display: 'block', width: sp.size, height: sp.size, borderRadius: '50%', background: 'var(--white)' }} />}
        </span>
      ))}

      {/* The cookie badge that sat above the figure is gone — the number and its line carry this on
          their own, and the footer already has the round bitten-cookie mark directly above. */}
      <div style={{ position: 'relative' }}>
        <b style={{ display: 'block', color: 'var(--text-strong)', font: `900 var(--text-h2)/1 var(--font-display)`, letterSpacing: '-.02em' }}>
          {n.toLocaleString('en-IN')}+
        </b>
        <span style={{ display: 'block', marginTop: 5, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.01em' }}>
          Cookies Baked &amp; Sold
        </span>
      </div>

      {/* One live indicator, not two: the reference had a corner chip and a bottom pill saying the
          same thing. White pill so it stays light like the panel it sits on. */}
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 'var(--radius-pill)', background: 'var(--white-72)' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ad06a', boxShadow: '0 0 0 3px rgba(58,208,106,.28)', flex: 'none' }} />
        <span style={{ color: 'var(--text-strong)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Counting live
        </span>
      </span>
    </div>
  );
}
