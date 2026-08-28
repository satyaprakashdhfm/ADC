'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { X, Send, ArrowUp } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { whatsappLink } from '@/lib/site';
import { supabase } from '@/lib/supabase';

/*
 * Doughie — the support assistant.
 *
 * This used to be a tap-only FAQ tree: pick a category, pick a question, read the canned answer.
 * It could only ever say the things somebody had written down in advance, which meant the one
 * question people actually open a support chat to ask — "where is my order" — was the one it could
 * not answer.
 *
 * It is now a real conversation against our own /api/chat, which can read THIS customer's orders
 * and raise a ticket when the answer is "a person needs to do that".
 *
 * The FAQ tree is kept in lib/faqData.ts, unused, rather than deleted — the copy in it is good and
 * is the obvious place to look when tuning the assistant's answers.
 *
 * WHAT THIS COMPONENT DOES NOT DO is decide what the assistant may see. There is no API key here
 * and no order data fetched here; the browser sends the conversation and the session token, and the
 * server decides which tools exist for that caller. See chatTools.service.ts.
 */

/*
 * Openers. Two, deliberately — a wall of suggestions is a menu, and a menu is what this replaced.
 * They differ by sign-in state because the signed-out assistant genuinely cannot answer the second
 * one, and offering a question it must refuse is a worse start than not offering it.
 */
const OPENERS_SIGNED_IN = ['Where is my order?', 'What are your bestsellers?'];
const OPENERS_SIGNED_OUT = ['What cookies do you sell?', 'Do you deliver to my area?'];

/* Offered once the conversation has run a little, so there is a way onward that is not typing. */
const FOLLOW_UPS_SIGNED_IN = ['Track my latest order', 'I need help with an order'];
const FOLLOW_UPS_SIGNED_OUT = ['How long does delivery take?', 'Are your cookies eggless?'];

/** After this many exchanges we start offering the follow-ups. */
const FOLLOW_UP_AFTER = 3;

const GREETING =
  'Hey there! I’m Doughie, your ADC support cookie. Ask me about our cookies, delivery, '
  + 'or your orders — I’m here to help.';

export default function Chatbot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Which assistant the user is talking to depends on this, so it is read before the first send.
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setSignedIn(!!data.session); })
      .catch(() => { if (alive) setSignedIn(false); });
    return () => { alive = false; };
  }, [open]);

  /*
   * headers is a FUNCTION, not an object: a Supabase access token is refreshed in the background,
   * and a token captured once at mount would be stale by the time somebody sends their third
   * message. Resolving it per request means the server sees a live session or none at all — and
   * "none at all" is a smaller assistant, not an error.
   */
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  }), []);

  const { messages, sendMessage, status, error } = useChat({ transport });

  const busy = status === 'submitted' || status === 'streaming';
  const exchanges = messages.filter((m) => m.role === 'user').length;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  if (!open) return null;

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    sendMessage({ text: t });
  };

  /* Openers before anything is said; follow-ups once the conversation has actually run. Nothing in
     between, so the panel is not permanently half-menu. */
  const suggestions = messages.length === 0
    ? (signedIn ? OPENERS_SIGNED_IN : OPENERS_SIGNED_OUT)
    : (!busy && exchanges >= FOLLOW_UP_AFTER
        ? (signedIn ? FOLLOW_UPS_SIGNED_IN : FOLLOW_UPS_SIGNED_OUT)
        : []);

  const bubble = (from: 'bot' | 'user', text: string, key: string) => (
    <div key={key} style={{ alignSelf: from === 'bot' ? 'flex-start' : 'flex-end', maxWidth: '82%' }}>
      <div style={{
        padding: '10px 13px', borderRadius: 14,
        borderBottomLeftRadius: from === 'bot' ? 4 : 14,
        borderBottomRightRadius: from === 'user' ? 4 : 14,
        background: from === 'bot' ? 'var(--surface-card)' : 'var(--gradient-warm)',
        color: from === 'bot' ? 'var(--text-body)' : 'var(--white)',
        border: from === 'bot' ? '1px solid var(--border-default)' : 'none',
        fontSize: 'var(--text-sm)', lineHeight: 1.5, boxShadow: 'var(--shadow-xs)',
        whiteSpace: 'pre-wrap',
      }}>
        {text}
      </div>
    </div>
  );

  const chip = (label: string) => (
    <button key={label} onClick={() => send(label)} disabled={busy}
      style={{ padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: busy ? 'default' : 'pointer', textAlign: 'left', opacity: busy ? 0.6 : 1 }}>
      {label}
    </button>
  );

  return (
    <div
      className="hide-sb"
      style={{
        position: 'fixed', right: 22, bottom: 22, zIndex: 60,
        width: 'min(360px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 120px))',
        background: 'var(--surface-page)', borderRadius: 'var(--radius-sheet)',
        border: '1.5px solid var(--border-default)',
        boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'riseIn .3s var(--ease-spring) both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: 'var(--gradient-warm)', color: 'var(--white)', flex: 'none' }}>
        <span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', flex: 'none' }}>
          <Image src="/assets/mascots/doughie-support.png" alt="" width={40} height={40} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-base)', lineHeight: 1.1 }}>ADC Support</div>
          <div style={{ fontSize: 'var(--text-2xs)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green-500)', display: 'inline-block' }} /> Online · replies instantly
          </div>
        </div>
        <button onClick={onClose} aria-label="Close chat" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--white-16)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}><X size={17} /></button>
      </div>

      {/* Thread */}
      <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-sunken)' }}>
        {bubble('bot', GREETING, 'greeting')}

        {messages.map((m) => {
          /* A message is a list of parts; only the text ones are shown. Tool calls are how the
             answer was found, not part of the answer, and narrating them to a customer would be
             noise — the reply already contains what they came for. */
          const text = m.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text).join('');
          if (!text) return null;
          return bubble(m.role === 'user' ? 'user' : 'bot', text, m.id);
        })}

        {busy && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 13px', borderRadius: 14, borderBottomLeftRadius: 4, background: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Doughie is typing…
          </div>
        )}

        {error && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '82%', padding: '10px 13px', borderRadius: 14, background: 'var(--red-wash)', border: '1px solid var(--status-error)', color: 'var(--text-body)', fontSize: 'var(--text-sm)' }}>
            Sorry — I couldn’t reach support just then. Try again, or{' '}
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-secondary)', fontWeight: 700 }}>message us on WhatsApp</a>.
          </div>
        )}

        {suggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 2 }}>
            {suggestions.map(chip)}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border-default)', background: 'var(--surface-page)' }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={signedIn ? 'Ask about your order or our cookies…' : 'Ask about our cookies…'}
          aria-label="Message"
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', outline: 'none' }}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
          style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', border: 'none', background: busy || !input.trim() ? 'var(--border-default)' : 'var(--gradient-warm)', color: 'var(--white)', display: 'grid', placeItems: 'center', cursor: busy || !input.trim() ? 'default' : 'pointer' }}>
          <ArrowUp size={17} />
        </button>
      </form>

      {/* A human, always one tap away. The assistant cannot cancel or refund anything, so the route
          to somebody who can must never be buried. */}
      <a href={whatsappLink()} target="_blank" rel="noopener noreferrer"
        style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 12px 11px', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700, textDecoration: 'none', background: 'var(--surface-page)' }}>
        <Send size={12} /> Prefer a person? Message us on WhatsApp
      </a>
    </div>
  );
}
