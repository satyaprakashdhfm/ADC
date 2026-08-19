'use client';
import { useEffect, useRef, useState } from 'react';
import { Star, Sparkles } from 'lucide-react';

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

  /* Confetti. Placed rather than random so the layout is identical on the server and on every
     repaint — Math.random() here would also mean the stars jumped on each tick of the counter.
     Kept to the edges: the middle belongs to the figure, and a star behind a numeral reads as a
     smudge. Purely decorative and pointer-events-free. */
  const specks: { top: string; left: string; size: number; kind: 'star' | 'sparkle' | 'dot'; o: number }[] = [
    { top: '6%',  left: '5%',  size: 12, kind: 'star',    o: 0.62 },
    { top: '16%', left: '15%', size: 7,  kind: 'dot',     o: 0.40 },
    { top: '9%',  left: '88%', size: 13, kind: 'sparkle', o: 0.58 },
    { top: '21%', left: '78%', size: 8,  kind: 'star',    o: 0.44 },
    { top: '34%', left: '4%',  size: 9,  kind: 'sparkle', o: 0.48 },
    { top: '44%', left: '93%', size: 7,  kind: 'dot',     o: 0.38 },
    { top: '56%', left: '7%',  size: 11, kind: 'star',    o: 0.50 },
    { top: '62%', left: '90%', size: 10, kind: 'star',    o: 0.46 },
    { top: '74%', left: '3%',  size: 7,  kind: 'dot',     o: 0.36 },
    { top: '80%', left: '84%', size: 12, kind: 'sparkle', o: 0.52 },
    { top: '90%', left: '18%', size: 9,  kind: 'star',    o: 0.44 },
    { top: '92%', left: '62%', size: 7,  kind: 'dot',     o: 0.34 },
    { top: '86%', left: '44%', size: 8,  kind: 'star',    o: 0.30 },
    { top: '30%', left: '86%', size: 6,  kind: 'dot',     o: 0.30 },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 172,
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
            : sp.kind === 'sparkle'
              ? <Sparkles size={sp.size} color="var(--white)" strokeWidth={2.4} />
              : <span style={{ display: 'block', width: sp.size, height: sp.size, borderRadius: '50%', background: 'var(--white)' }} />}
        </span>
      ))}

      {/* Gold ribbon across the top, as in the reference. Notched ends via clip-path rather than an
          image, so it costs nothing to load and scales with the type.
          Dark lettering on the amber, not white: white on amber-500 measures about 2.2:1 and is
          unreadable at this size, while the strong ink on it is roughly 7:1. */}
      <span style={{
        position: 'relative',
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
