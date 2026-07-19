'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X, Send } from 'lucide-react';
import { whatsappLink } from '@/lib/site';
import { FAQ_CATEGORIES, type FaqCategory, type FaqItem } from '@/lib/faqData';

/*
 * Doughie — the categorized FAQ support bot. Flow: greet -> pick a category -> pick a question
 * -> get the answer -> "anything else?" -> yes loops back to the OTHER categories (the one just
 * used drops off the list), no ends the chat. No free-text input; every step is a tap.
 *
 * The current set of options (categories / questions / yes-no / closed) renders as its own
 * "message" attached at the bottom of the scrolling thread — like a real chat's quick-reply
 * buttons — rather than in a separate fixed panel. Only the LATEST message is ever interactive;
 * once acted on, it's replaced by a plain text bubble recording what was picked, and the next
 * options message (if any) is appended after the bot's reply. Each options message carries its
 * own `usedKeys` snapshot so "back"/"yes" always know exactly which categories are already spent,
 * without reaching outside the message list for state.
 */
type Msg =
  | { kind: 'text'; from: 'bot' | 'user'; text: string }
  | { kind: 'categories'; usedKeys: string[] }
  | { kind: 'questions'; categoryKey: string; usedKeys: string[] }
  | { kind: 'yesno'; usedKeys: string[] }
  | { kind: 'closed' };

const GREETING = 'Hey there! I’m Doughie, your friendly ADC support cookie. Whether you have a question, need help with an order, or just want to know more about our cookies, I’m here to help. What can I do for you today?';
const ANYTHING_ELSE = 'Is there anything else I can help you with today? I’m just a message away!';
const GOODBYE = 'Alright, looks like we’ve covered everything! Thanks for chatting with me. Have a sweet day, and see you again soon. Goodbye! 👋';

const initialMsgs = (): Msg[] => [
  { kind: 'text', from: 'bot', text: GREETING },
  { kind: 'categories', usedKeys: [] },
];

export default function Chatbot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(initialMsgs);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  if (!open) return null;

  const isLast = (i: number) => i === msgs.length - 1;

  // Replaces the current (last) options message with a plain-text record of what was picked,
  // then appends whatever comes next — same shape a real chat uses for a resolved quick-reply.
  const resolve = (pickedText: string, ...next: Msg[]) => {
    setMsgs(m => [...m.slice(0, -1), { kind: 'text', from: 'user', text: pickedText }, ...next]);
  };

  const pickCategory = (cat: FaqCategory, usedKeys: string[]) => {
    resolve(`${cat.emoji} ${cat.label}`, { kind: 'questions', categoryKey: cat.key, usedKeys });
  };

  const pickQuestion = (cat: FaqCategory, item: FaqItem, usedKeys: string[]) => {
    const nextUsed = usedKeys.includes(cat.key) ? usedKeys : [...usedKeys, cat.key];
    resolve(item.q,
      { kind: 'text', from: 'bot', text: item.a },
      { kind: 'text', from: 'bot', text: ANYTHING_ELSE },
      { kind: 'yesno', usedKeys: nextUsed },
    );
  };

  const backToCategories = (usedKeys: string[]) => {
    setMsgs(m => [...m.slice(0, -1), { kind: 'categories', usedKeys }]);
  };

  const answerYes = (usedKeys: string[]) => {
    resolve('Yes', { kind: 'categories', usedKeys });
  };
  const answerNo = () => {
    resolve('No', { kind: 'text', from: 'bot', text: GOODBYE }, { kind: 'closed' });
  };
  const startOver = () => setMsgs(initialMsgs());

  const chip = (label: string, onClick: () => void, key?: string) => (
    <button key={key ?? label} onClick={onClick}
      style={{ padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer', textAlign: 'left' }}>
      {label}
    </button>
  );

  // Renders one message — either a plain bubble, or (only when it's the latest message) the
  // live set of tappable options for that step.
  const renderMsg = (m: Msg, i: number) => {
    if (m.kind === 'text') {
      return (
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
      );
    }
    if (!isLast(i)) return null; // an old, already-acted-on options message — nothing left to show

    const optionsWrap: React.CSSProperties = { alignSelf: 'flex-start', maxWidth: '92%', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 14, borderBottomLeftRadius: 4, padding: '10px 12px', boxShadow: 'var(--shadow-xs)' };

    if (m.kind === 'categories') {
      const remaining = FAQ_CATEGORIES.filter(c => !m.usedKeys.includes(c.key));
      if (remaining.length === 0) {
        return (
          <div key={i} style={optionsWrap}>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 700, textDecoration: 'none' }}>
              <Send size={14} /> Still need help? Message us on WhatsApp
            </a>
          </div>
        );
      }
      return (
        <div key={i} style={optionsWrap}>
          <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>WHAT WOULD YOU LIKE TO KNOW?</div>
          <div className="hide-sb" style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {remaining.map(cat => chip(`${cat.emoji} ${cat.label}`, () => pickCategory(cat, m.usedKeys), cat.key))}
          </div>
        </div>
      );
    }
    if (m.kind === 'questions') {
      const cat = FAQ_CATEGORIES.find(c => c.key === m.categoryKey);
      if (!cat) return null;
      return (
        <div key={i} style={optionsWrap}>
          <button onClick={() => backToCategories(m.usedKeys)} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 8, color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-2xs)', cursor: 'pointer' }}>
            ← Back to topics
          </button>
          <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>{cat.emoji} {cat.label.toUpperCase()}</div>
          <div className="hide-sb" style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {cat.items.map(item => chip(item.q, () => pickQuestion(cat, item, m.usedKeys), item.q))}
          </div>
        </div>
      );
    }
    if (m.kind === 'yesno') {
      return (
        <div key={i} style={{ ...optionsWrap, display: 'flex', gap: 8 }}>
          <button onClick={() => answerYes(m.usedKeys)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Yes</button>
          <button onClick={answerNo} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>No</button>
        </div>
      );
    }
    // closed
    return (
      <div key={i} style={{ ...optionsWrap, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 700, textDecoration: 'none' }}>
          <Send size={14} /> Need something else? Message us on WhatsApp
        </a>
        <button onClick={startOver} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)', cursor: 'pointer', textDecoration: 'underline' }}>
          Start a new conversation
        </button>
      </div>
    );
  };

  return (
    <div
      className="hide-sb"
      style={{
        position: 'fixed', right: 22, bottom: 22, zIndex: 60,
        width: 'min(360px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 120px))',
        background: 'var(--surface-page)', borderRadius: 'var(--radius-sheet)',
        boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'riseIn .3s var(--ease-spring) both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: 'var(--gradient-warm)', color: 'var(--white)', flex: 'none' }}>
        <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--white)', display: 'grid', placeItems: 'center', flex: 'none', overflow: 'hidden' }}>
          <Image src="/assets/mascots/doughie-support.png" alt="" width={38} height={38} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-base)', lineHeight: 1.1 }}>Doughie</div>
          <div style={{ fontSize: 'var(--text-2xs)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green-500)', display: 'inline-block' }} /> Online · replies instantly
          </div>
        </div>
        <button onClick={onClose} aria-label="Close chat" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--white-16)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}><X size={17} /></button>
      </div>

      {/* Messages — including the current step's tappable options, attached at the bottom like
          any other chat bubble, rather than in a separate control strip. */}
      <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-sunken)' }}>
        {msgs.map((m, i) => renderMsg(m, i))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
