'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';

/*
 * Lightweight support bot — canned answers to the questions people actually ask.
 * Tap a question, get an instant reply. No backend yet (default answers only).
 */
interface Faq { q: string; a: string }
const FAQS: Faq[] = [
  { q: 'What areas do you deliver to?', a: 'We deliver fresh, intracity, from our A Dough Cookie stores in Bengaluru & Chennai. Set your location (top-right) and we’ll serve you from your nearest store.' },
  { q: 'How long does delivery take?', a: 'Intracity orders are baked fresh and delivered the same day. Out-of-area orders ship express across India with a tracked courier.' },
  { q: 'Are your cookies eggless?', a: 'Yes! Every cookie is 100% pure veg and eggless — baked fresh in small batches.' },
  { q: 'Do you take bulk / corporate orders?', a: 'Absolutely. Head to the “Partner with us” or Contact page and share your requirement — our team will send a custom quote.' },
  { q: 'How do I track my order?', a: 'Log in and open your Account page — you’ll see live order and delivery status there.' },
  { q: 'What payment methods do you accept?', a: 'We’re prepaid only — pay securely via Razorpay (UPI, cards, net-banking). No cash on delivery.' },
  { q: 'Do you have a discount for new customers?', a: 'Yes 🎉 Spin the wheel (the 🎁 button) after logging in to unlock an exclusive first-order code!' },
];

type Msg = { from: 'bot' | 'user'; text: string };
const GREETING: Msg = { from: 'bot', text: 'Hi! 🍪 I’m the A Dough Cookie helper. Tap a question below and I’ll answer right away.' };

export default function Chatbot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [asked, setAsked] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  if (!open) return null;

  const ask = (f: Faq) => {
    setMsgs(m => [...m, { from: 'user', text: f.q }, { from: 'bot', text: f.a }]);
    setAsked(a => [...a, f.q]);
  };
  const remaining = FAQS.filter(f => !asked.includes(f.q));

  return (
    <div
      className="hide-sb"
      style={{
        position: 'fixed', right: 22, bottom: 22, zIndex: 60,
        width: 'min(360px, calc(100vw - 32px))', height: 'min(520px, calc(100vh - 120px))',
        background: 'var(--surface-page)', borderRadius: 'var(--radius-sheet)',
        boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'riseIn .3s var(--ease-spring) both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: 'var(--gradient-warm)', color: 'var(--white)', flex: 'none' }}>
        <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--white-16)', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 20 }}>🍪</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-base)', lineHeight: 1.1 }}>Cookie Helper</div>
          <div style={{ fontSize: 'var(--text-2xs)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green-500)', display: 'inline-block' }} /> Online · replies instantly
          </div>
        </div>
        <button onClick={onClose} aria-label="Close chat" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--white-16)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}><X size={17} /></button>
      </div>

      {/* Messages */}
      <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-sunken)' }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.from === 'bot' ? 'flex-start' : 'flex-end', maxWidth: '82%' }}>
            <div style={{
              padding: '10px 13px', borderRadius: 14,
              borderBottomLeftRadius: m.from === 'bot' ? 4 : 14,
              borderBottomRightRadius: m.from === 'user' ? 4 : 14,
              background: m.from === 'bot' ? 'var(--surface-card)' : 'var(--gradient-warm)',
              color: m.from === 'bot' ? 'var(--text-body)' : 'var(--white)',
              border: m.from === 'bot' ? '1px solid var(--border-default)' : 'none',
              fontSize: 'var(--text-sm)', lineHeight: 1.5, boxShadow: 'var(--shadow-xs)',
            }}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Quick questions */}
      <div style={{ flex: 'none', padding: '12px 14px', borderTop: '1px solid var(--border-soft)', background: 'var(--surface-page)' }}>
        {remaining.length > 0 ? (
          <>
            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>SUGGESTED QUESTIONS</div>
            <div className="hide-sb" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 108, overflowY: 'auto' }}>
              {remaining.map(f => (
                <button key={f.q} onClick={() => ask(f)}
                  style={{ padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer', textAlign: 'left' }}>
                  {f.q}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <Send size={14} /> Still need help? Message us on WhatsApp (the green button).
          </div>
        )}
      </div>
    </div>
  );
}
