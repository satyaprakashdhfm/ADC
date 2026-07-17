'use client';
import { useState, useEffect } from 'react';
import { getPromoProduct, getAnnouncement } from '@/lib/api';

// Slim top ribbon — rotates between the veg promise and the login/track-order nudge. The offer
// line is admin-controlled (see AdminDashboard "Header banner offer") so it only ever advertises
// a real, currently-active discount — never a hardcoded code that doesn't work at checkout.
const MESSAGES = [
  '🌱 100% Pure Veg · All our cookies are eggless',
  'Log in to save favourites & track your orders',
];

export default function AnnouncementBar() {
  const [i, setI] = useState(0);
  // Trending product + the admin's current offer text both prepend onto the base rotation.
  const [messages, setMessages] = useState<string[]>(MESSAGES);

  useEffect(() => {
    getPromoProduct()
      .then(p => { if (p?.name) setMessages(m => [`🔥 Trending now: ${p.name} — freshly baked, order today`, ...m]); })
      .catch(() => {});
    getAnnouncement()
      .then(a => { if (a?.text) setMessages(m => [a.text as string, ...m]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => setI(p => (p + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, [messages.length]);

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
        {messages[i % messages.length]}
      </span>
    </div>
  );
}
