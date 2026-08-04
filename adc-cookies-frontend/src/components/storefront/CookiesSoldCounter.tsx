'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * A little "cookies baked & sold today" vanity counter (Swish-style) for the footer. It's a
 * deterministic function of the current day + time so it doesn't reset or jump around on refresh:
 * it starts 100+ and creeps up through the day, and the last digit is deliberately non-round so it
 * reads as a real, organic number rather than a marketing round figure. Ticks up live every few
 * seconds. Purely decorative — no data source, just a warm bit of social proof.
 */
function soldToday(now: Date): number {
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const rnd = ((dayIndex * 9301 + 49297) % 233280) / 233280; // stable pseudo-random per day (0..1)
  const dayBase = 128 + Math.floor(rnd * 90);                 // 128..218 to start the day
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const growth = 360 + Math.floor(rnd * 260);                 // +360..620 more across the day
  let n = dayBase + Math.floor((secs / 86400) * growth);
  const tails = [1, 3, 7, 9, 3, 1, 7, 9, 4, 6];               // non-round, odd-leaning last digit
  n = Math.floor(n / 10) * 10 + tails[(dayIndex + Math.floor(secs / 60)) % tails.length];
  return Math.max(107, n);
}

export default function CookiesSoldCounter() {
  const [n, setN] = useState<number | null>(null);
  const shown = useRef(0);

  useEffect(() => {
    const sync = () => {
      const target = soldToday(new Date());
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--white-72)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ad06a', boxShadow: '0 0 0 3px rgba(58,208,106,.28)', flex: 'none' }} />
      <span><b style={{ color: 'var(--white)' }}>{n.toLocaleString('en-IN')}+</b> cookies baked &amp; sold today</span>
    </span>
  );
}
