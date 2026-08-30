'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { X, Send, ArrowUp, RotateCcw } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { whatsappLink } from '@/lib/site';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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
 * Suggestions, chosen from what was just said rather than fixed in the file.
 *
 * These used to be four hardcoded pairs — two openers, two follow-ups — so every visitor saw the
 * same two questions in the same order forever, and after a conversation about allergens the panel
 * still offered "Track my latest order". A suggestion that ignores the last answer is worse than
 * none: it reads as a menu, and a menu is exactly what this component replaced.
 *
 * So: pools by topic, the topic picked from the assistant's last reply, and anything already
 * offered or already asked filtered out. No extra model call — the cost of a suggestion should not
 * be a second round trip.
 */
type Topic = 'order' | 'delivery' | 'product' | 'payment' | 'help';

const POOL: Record<Topic, string[]> = {
  order: [
    'Where is my order?',
    'Track my latest order',
    'Has my order been picked up?',
    'When will it arrive?',
    'My order is taking too long',
  ],
  delivery: [
    'Do you deliver to my area?',
    'How long does delivery take?',
    'Do you deliver same day?',
    'What are your delivery charges?',
    'Can I get it delivered tomorrow morning?',
  ],
  product: [
    'What cookies do you sell?',
    'What are your bestsellers?',
    'Are your cookies eggless?',
    'What are the allergens?',
    'What is in the Nutella filled cookie?',
    'Do you have anything without nuts?',
  ],
  payment: [
    'I was charged but there is no order',
    'How long does a refund take?',
    'Do you accept cash on delivery?',
    'My payment failed',
  ],
  help: [
    'I need help with an order',
    'I want to cancel an order',
    'Something was wrong with my order',
    'I want to talk to someone',
  ],
};

/* Reachable only once we know whose account it is — offering these to a signed-out visitor invites
   a question the assistant is then obliged to refuse. */
const ACCOUNT_TOPICS: Topic[] = ['order', 'payment'];

/* Matched against the assistant's last reply, most specific first: "refund" should land on payment
   even though the same sentence probably also says "order". */
const TOPIC_HINTS: [Topic, RegExp][] = [
  ['payment', /refund|payment|paid|charge|razorpay|money back/i],
  ['help', /ticket|team will|cannot do that|get back to you|raised/i],
  ['order', /order|delivered|rider|tracking|waybill|picked up|ADC\d/i],
  ['delivery', /deliver|pincode|same.?day|outstation|address|area/i],
  ['product', /cookie|flavour|flavor|eggless|allergen|price|₹|menu|bestseller/i],
];

/** After this many exchanges we start offering follow-ups. */
const FOLLOW_UP_AFTER = 2;

function topicOf(text: string): Topic | null {
  for (const [topic, re] of TOPIC_HINTS) if (re.test(text)) return topic;
  return null;
}

/* A stable shuffle: the same seed gives the same order, so chips do not rearrange themselves on
   every keystroke while still differing between one conversation and the next. */
function shuffled<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let x = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const GREETING =
  'Hey there! I’m Doughie, your ADC support cookie. Ask me about our cookies, delivery, '
  + 'or your orders — I’m here to help.';

export default function Chatbot({ open, onClose }: { open: boolean; onClose: () => void }) {
  /*
   * authId, not `user` — the Supabase auth id is the only stable answer to "which account is this".
   * `user`'s phone and email arrive at different moments and each can be the first one present, so
   * keying on those reads as "somebody else signed in" moments after the SAME person did. This is
   * the identity CartContext scopes on for the same reason.
   */
  const { authId } = useAuth();
  const signedIn = !!authId;
  const [input, setInput] = useState('');
  /* Re-rolled whenever a conversation starts, so the openers differ between visits rather than
     being the same two lines for everybody, forever. */
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({ transport });

  /*
   * A conversation belongs to whoever was signed in when it happened. Start a fresh one the moment
   * that changes.
   *
   * Without this the transcript outlived the session. FloatingDock keeps this component mounted
   * across a logout, so signing out left the previous customer's thread on screen — their name,
   * their orders — and the next person to open the panel could read it. Worse, those turns are sent
   * back as context, so the assistant kept answering "You are Satya Prakash" from the transcript
   * even though the server had correctly dropped it to the anonymous agent with no account tools.
   * The server-side isolation was intact; the leak was the history the browser was still holding.
   *
   * Cleared on ANY change of identity, including signing IN — unlike the cart, which deliberately
   * survives that. A guest thread carries no personal data, but it does carry "you'll need to sign
   * in first" advice that is wrong the moment they have.
   */
  const prevAuthId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevAuthId.current === undefined) { prevAuthId.current = authId; return; } // first resolve is not a change
    if (prevAuthId.current !== authId) {
      stop();                 // abandon a reply that is mid-flight for the old identity
      setMessages([]);
      setInput('');
      setSeed(Math.floor(Math.random() * 1e9));
    }
    prevAuthId.current = authId;
  }, [authId, setMessages, stop]);

  const busy = status === 'submitted' || status === 'streaming';
  const exchanges = messages.filter((m) => m.role === 'user').length;

  /*
   * What to offer next.
   *
   * Openers before anything is said, then follow-ups drawn from whatever the assistant just talked
   * about. Nothing in between, so the panel is never permanently half-menu, and nothing that has
   * already been offered or already asked — repeating a chip somebody just tapped is how a thread
   * starts looking like it is going in circles.
   */
  const suggestions = useMemo(() => {
    if (busy) return [];

    const asked = new Set(
      messages.filter((m) => m.role === 'user')
        .map((m) => m.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text).join('').trim().toLowerCase()),
    );

    const allowed = (t: Topic) => signedIn || !ACCOUNT_TOPICS.includes(t);

    if (messages.length === 0) {
      /* Openers: one product question and one about getting it to them, which is what people
         actually open a chat to ask. Shuffled per conversation so two visitors do not see an
         identical panel, and so the same person coming back gets a different way in. */
      const first: Topic = signedIn ? 'order' : 'product';
      const second: Topic = signedIn ? 'product' : 'delivery';
      return [shuffled(POOL[first], seed)[0]!, shuffled(POOL[second], seed + 7)[0]!];
    }

    if (exchanges < FOLLOW_UP_AFTER) return [];

    const lastBot = [...messages].reverse().find((m) => m.role === 'assistant');
    const lastText = lastBot
      ? lastBot.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map((p) => p.text).join('')
      : '';

    /* The topic just discussed leads; `help` follows it, because the honest next step after most
       support answers is a person. Everything else fills the remainder. */
    const lead = topicOf(lastText);
    const order: Topic[] = [
      ...(lead ? [lead] : []),
      'help',
      ...(['order', 'delivery', 'product', 'payment'] as Topic[]),
    ];

    const out: string[] = [];
    const seen = new Set<string>();
    for (const t of order) {
      if (!allowed(t) || seen.has(t)) continue;
      seen.add(t);
      for (const q of shuffled(POOL[t], seed + t.length)) {
        if (out.length >= 3) break;
        if (!asked.has(q.toLowerCase()) && !out.includes(q)) { out.push(q); break; }
      }
      if (out.length >= 3) break;
    }
    return out;
  }, [messages, busy, exchanges, signedIn, seed]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  if (!open) return null;

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    sendMessage({ text: t });
  };


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
        {/* Only once there is something to clear. A reset button on an empty thread is a control
            that does nothing, and it invites the question of what it would have done. */}
        {messages.length > 0 && (
          <button onClick={() => { stop(); setMessages([]); setInput(''); setSeed(Math.floor(Math.random() * 1e9)); inputRef.current?.focus(); }}
            aria-label="Start a new conversation" title="Start a new conversation"
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--white-16)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}>
            <RotateCcw size={15} />
          </button>
        )}
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
