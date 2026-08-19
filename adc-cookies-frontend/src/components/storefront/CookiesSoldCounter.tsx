'use client';
import { useEffect, useRef, useState } from 'react';
import { Cookie, Star } from 'lucide-react';

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

  /* Confetti — a handful of amber specks and stars, placed rather than random so the layout is the
     same on every render (and on the server). Purely decorative and pointer-events-free. */
  const specks: { top: string; left: string; size: number; kind: 'star' | 'dot'; o: number }[] = [
    { top: '11%', left: '9%',  size: 13, kind: 'star', o: 0.55 },
    { top: '20%', left: '84%', size: 10, kind: 'star', o: 0.42 },
    { top: '68%', left: '7%',  size: 9,  kind: 'dot',  o: 0.40 },
    { top: '78%', left: '89%', size: 12, kind: 'star', o: 0.48 },
    { top: '44%', left: '93%', size: 7,  kind: 'dot',  o: 0.32 },
    { top: '88%', left: '30%', size: 7,  kind: 'dot',  o: 0.30 },
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
        /* Warm smoked glass, not the near-black block this replaces and not milky glass either.
           Espresso over the footer's own orange lands around #AD5506 at the top and #733707 at the
           foot — plainly the same family as the footer, so the card reads as part of it, while white
           type still measures 5:1 to 9:1 across the panel. Milky glass (a white tint) would have
           looked closer to the reference and put white text at about 2.9:1, which fails outright. */
        background: 'linear-gradient(165deg, var(--espresso-30), var(--espresso-50))',
        /* Bright top edge + soft inner glow: this, the translucency and the drop shadow are what
           read as glass. No backdrop-filter — the footer behind is a flat gradient, so blurring it
           would cost a compositing layer and change nothing you can see. */
        border: '1px solid var(--white-40)',
        boxShadow: 'inset 0 1px 0 var(--white-40), inset 0 -18px 30px -18px var(--white-16), 0 10px 26px var(--black-28)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        textAlign: 'center',
      }}
    >
      {specks.map((sp, idx) => (
        <span key={idx} aria-hidden style={{ position: 'absolute', top: sp.top, left: sp.left, opacity: sp.o, pointerEvents: 'none', lineHeight: 0 }}>
          {sp.kind === 'star'
            ? <Star size={sp.size} color="var(--amber-300)" fill="var(--amber-300)" strokeWidth={0} />
            : <span style={{ display: 'block', width: sp.size, height: sp.size, borderRadius: '50%', background: 'var(--amber-200)' }} />}
        </span>
      ))}

      {/* Ringed in white: amber on a burnt-orange panel has little to separate it. */}
      <span aria-hidden style={{ position: 'relative', width: 42, height: 42, borderRadius: '50%', background: 'var(--gradient-warm)', border: '2px solid var(--white-72)', display: 'grid', placeItems: 'center', flex: 'none', boxShadow: '0 3px 12px var(--black-45)' }}>
        <Cookie size={22} color="var(--white)" />
      </span>

      <div style={{ position: 'relative' }}>
        <b style={{ display: 'block', color: 'var(--white)', font: `900 var(--text-h2)/1 var(--font-display)`, letterSpacing: '-.02em', textShadow: '0 2px 10px var(--black-45)' }}>
          {n.toLocaleString('en-IN')}+
        </b>
        <span style={{ display: 'block', marginTop: 5, color: 'var(--cream-100)', fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.01em', textShadow: '0 1px 6px var(--black-45)' }}>
          Cookies Baked &amp; Sold
        </span>
      </div>

      {/* One live indicator, not two. The reference had a corner chip AND a bottom pill, which say
          the same thing twice; this is the legible one, so it is the one that stayed. */}
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 'var(--radius-pill)', background: 'var(--espresso-50)', border: '1px solid var(--white-16)' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ad06a', boxShadow: '0 0 0 3px rgba(58,208,106,.28)', flex: 'none' }} />
        <span style={{ color: 'var(--cream-100)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Counting live
        </span>
      </span>
    </div>
  );
}
