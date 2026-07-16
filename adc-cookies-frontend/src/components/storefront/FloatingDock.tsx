'use client';
import { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { whatsappLink } from '@/lib/site';
import SpinWheel from './SpinWheel';
import Chatbot from './Chatbot';

// Real prize-wheel launcher — colourful conic wedges, a pointer and a centre hub.
const WHEEL_MINI = 'conic-gradient(var(--amber-400) 0 45deg, var(--orange-500) 45deg 90deg, var(--amber-400) 90deg 135deg, var(--orange-500) 135deg 180deg, var(--amber-400) 180deg 225deg, var(--orange-500) 225deg 270deg, var(--amber-400) 270deg 315deg, var(--orange-500) 315deg 360deg)';
const MiniWheel = () => (
  <span style={{ position: 'relative', width: 32, height: 32, display: 'grid', placeItems: 'center' }}>
    <span aria-hidden style={{ position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)', zIndex: 2, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '7px solid var(--ink-900)' }} />
    <span aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', background: WHEEL_MINI, border: '2px solid var(--white)', boxShadow: '0 0 0 1px var(--amber-600)' }} />
    <span aria-hidden style={{ position: 'absolute', width: 9, height: 9, borderRadius: '50%', background: 'var(--white)', boxShadow: '0 0 0 1.5px var(--amber-600)' }} />
  </span>
);

/**
 * Bottom-right floating stack (top → bottom): Spin & Win · Chatbot · WhatsApp.
 * Each launcher opens its own panel/modal; the WhatsApp one is a direct deep-link.
 */
const fab: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
  display: 'grid', placeItems: 'center', position: 'relative', flex: 'none',
  boxShadow: '0 10px 26px var(--black-18)',
};

export default function FloatingDock() {
  const [spin, setSpin] = useState(false);
  const [chat, setChat] = useState(false);

  // Auto-open the spin wheel on the first visit, then at most once a day.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let last = 0;
    try { last = Number(localStorage.getItem('adc_spin_last') || 0); } catch { /* ignore */ }
    const DAY = 24 * 60 * 60 * 1000;
    if (last && Date.now() - last <= DAY) return;
    const t = setTimeout(() => {
      setSpin(true);
      try { localStorage.setItem('adc_spin_last', String(Date.now())); } catch { /* ignore */ }
    }, 1300);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        {/* Spin & win (top) */}
        <button onClick={() => setSpin(true)} aria-label="Spin & win a discount" title="Spin & win"
          style={{ ...fab, background: 'var(--white)', border: '1.5px solid var(--border-default)' }}>
          <MiniWheel />
        </button>

        {/* Chatbot (middle) */}
        <button onClick={() => setChat(o => !o)} aria-label="Help & support" title="Help & support"
          style={{ ...fab, background: 'var(--ink-900)', color: 'var(--white)' }}>
          <Bot size={25} />
        </button>

        {/* WhatsApp (bottom) */}
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp" title="WhatsApp"
          style={{ ...fab, width: 62, height: 62, background: 'var(--whatsapp-green)', boxShadow: '0 12px 30px var(--wa-45), 0 4px 10px var(--black-18)', textDecoration: 'none' }}>
          <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--wa-60)', animation: 'waPulse 2.4s ease-out infinite' }} />
          <svg width={33} height={33} viewBox="0 0 32 32" aria-hidden style={{ fill: 'var(--white)' }}>
            <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.74 6.4L3.2 28.8l6.56-1.72a12.74 12.74 0 0 0 6.24 1.6h.005c7.06 0 12.8-5.74 12.8-12.8s-5.745-12.68-12.8-12.68Zm0 23.04h-.004a10.6 10.6 0 0 1-5.4-1.48l-.388-.23-4.03 1.06 1.076-3.93-.252-.404a10.56 10.56 0 0 1-1.62-5.62c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.114 7.52c0 5.86-4.77 10.63-10.63 10.63Zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.54-.71-.55l-.6-.01c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63 0 1.55 1.13 3.05 1.29 3.26.16.21 2.22 3.39 5.38 4.76.75.32 1.34.51 1.8.66.76.24 1.45.21 1.99.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
          </svg>
        </a>
      </div>

      <SpinWheel open={spin} onClose={() => setSpin(false)} />
      <Chatbot open={chat} onClose={() => setChat(false)} />
    </>
  );
}
