'use client';
import { useState, useEffect } from 'react';
import { getPromoProduct, getAnnouncement } from '@/lib/api';

// Slim top ribbon — rotates between the veg promise and the login/track-order nudge. The offer
// line is admin-controlled (see AdminDashboard "Header banner offer") so it only ever advertises
// a real, currently-active discount — never a hardcoded code that doesn't work at checkout.
const MESSAGES = [
  '100% Pure Veg · All our cookies are eggless',
  'Log in to save favourites & track your orders',
];

// The Indian veg mark — a green dot inside a green-bordered square — instead of a plant emoji.
const VegMark = () => (
  <span aria-label="Pure veg" style={{ display: 'inline-flex', width: 13, height: 13, border: '1.6px solid #2e8b3d', borderRadius: 2, background: '#fff', alignItems: 'center', justifyContent: 'center', verticalAlign: '-2px', marginRight: 6, flex: 'none' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2e8b3d' }} />
  </span>
);

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
        // Pinned to the very top so the ribbon persists through scrolling (the revealing home
        // navbar is offset down by --ribbon-h to sit just beneath it). z above the nav (50).
        position: 'sticky', top: 0, zIndex: 60,
        height: 'var(--ribbon-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--orange-light)', color: 'var(--ink-800)',
        textAlign: 'center', padding: '0 clamp(12px, 4vw, 40px)', overflow: 'hidden',
        borderBottom: '1px solid var(--ink-900-08)',
      }}
    >
      {/* key forces a remount so the slide-in animation replays on each message. One line always —
          a long trending message (e.g. a long product name) would otherwise wrap to two lines and
          get clipped by the fixed ribbon height on mobile, so nowrap + ellipsis keeps it neat. */}
      <span
        key={i}
        style={{
          display: 'block', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)',
          fontWeight: 700, letterSpacing: '.01em', animation: 'annSlide .5s var(--ease-out) both',
        }}
      >
        {/^\s*100% Pure Veg/i.test(messages[i % messages.length]) && <VegMark />}{messages[i % messages.length]}
      </span>
    </div>
  );
}
