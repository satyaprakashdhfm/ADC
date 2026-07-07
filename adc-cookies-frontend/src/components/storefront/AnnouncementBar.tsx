'use client';
import { useState, useEffect } from 'react';

// Slim top ribbon — rotates between the veg promise, the offer and the login/track-order nudge.
const MESSAGES = [
  '🌱 100% Pure Veg · All our cookies are eggless',
  'Get 20% off your first order — use code FRESH20',
  'Log in to save favourites & track your orders',
];

export default function AnnouncementBar() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI(p => (p + 1) % MESSAGES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        background: 'var(--orange-light)', color: 'var(--ink-800)',
        textAlign: 'center', padding: '3px 40px', overflow: 'hidden',
        borderBottom: '1px solid var(--ink-900-08)',
      }}
    >
      {/* key forces a remount so the slide-in animation replays on each message */}
      <span
        key={i}
        style={{
          display: 'inline-block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)',
          fontWeight: 700, letterSpacing: '.01em', animation: 'annSlide .5s var(--ease-out) both',
        }}
      >
        {MESSAGES[i]}
      </span>
    </div>
  );
}
