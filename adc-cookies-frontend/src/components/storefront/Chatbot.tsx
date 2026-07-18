'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { whatsappLink } from '@/lib/site';
import { FAQ_CATEGORIES, type FaqCategory, type FaqItem } from '@/lib/faqData';

/*
 * Doughie — the categorized FAQ support bot. Flow: greet -> pick a category -> pick a question
 * -> get the answer -> "anything else?" -> yes loops back to the OTHER categories (the one just
 * used drops off the list), no ends the chat. No free-text input; every step is a tap.
 */
type Msg = { from: 'bot' | 'user'; text: string };
type Stage = 'categories' | 'questions' | 'yesno' | 'closed';

const GREETING = 'Hey there! I’m Doughie, your friendly ADC support cookie. Whether you have a question, need help with an order, or just want to know more about our cookies, I’m here to help. What can I do for you today?';
const ANYTHING_ELSE = 'Is there anything else I can help you with today? I’m just a message away!';
const GOODBYE = 'Alright, looks like we’ve covered everything! Thanks for chatting with me. Have a sweet day, and see you again soon. Goodbye! 👋';

const initialMsgs = (): Msg[] => [{ from: 'bot', text: GREETING }];

export default function Chatbot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(initialMsgs);
  const [stage, setStage] = useState<Stage>('categories');
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const [usedCategoryKeys, setUsedCategoryKeys] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  if (!open) return null;

  const activeCategory = FAQ_CATEGORIES.find(c => c.key === activeCategoryKey) || null;
  const remainingCategories = FAQ_CATEGORIES.filter(c => !usedCategoryKeys.includes(c.key));

  const pickCategory = (cat: FaqCategory) => {
    setMsgs(m => [...m, { from: 'user', text: `${cat.emoji} ${cat.label}` }]);
    setActiveCategoryKey(cat.key);
    setStage('questions');
  };

  const pickQuestion = (cat: FaqCategory, item: FaqItem) => {
    setMsgs(m => [...m, { from: 'user', text: item.q }, { from: 'bot', text: item.a }, { from: 'bot', text: ANYTHING_ELSE }]);
    setUsedCategoryKeys(u => (u.includes(cat.key) ? u : [...u, cat.key]));
    setActiveCategoryKey(null);
    setStage('yesno');
  };

  const backToCategories = () => { setActiveCategoryKey(null); setStage('categories'); };

  const answerYes = () => {
    setMsgs(m => [...m, { from: 'user', text: 'Yes' }]);
    setStage('categories');
  };
  const answerNo = () => {
    setMsgs(m => [...m, { from: 'user', text: 'No' }, { from: 'bot', text: GOODBYE }]);
    setStage('closed');
  };
  const startOver = () => {
    setMsgs(initialMsgs());
    setActiveCategoryKey(null);
    setUsedCategoryKeys([]);
    setStage('categories');
  };

  const chip = (label: string, onClick: () => void, key?: string) => (
    <button key={key ?? label} onClick={onClick}
      style={{ padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer', textAlign: 'left' }}>
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
        boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'riseIn .3s var(--ease-spring) both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: 'var(--gradient-warm)', color: 'var(--white)', flex: 'none' }}>
        <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--white-16)', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 20 }}>🍪</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-base)', lineHeight: 1.1 }}>Doughie</div>
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

      {/* Action panel — swaps between categories / questions / yes-no / closed */}
      <div style={{ flex: 'none', padding: '12px 14px', borderTop: '1px solid var(--border-soft)', background: 'var(--surface-page)' }}>
        {stage === 'questions' && activeCategory ? (
          <>
            <button onClick={backToCategories} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 8, color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-2xs)', cursor: 'pointer' }}>
              ← Back to topics
            </button>
            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>{activeCategory.emoji} {activeCategory.label.toUpperCase()}</div>
            <div className="hide-sb" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 140, overflowY: 'auto' }}>
              {activeCategory.items.map(item => chip(item.q, () => pickQuestion(activeCategory, item), item.q))}
            </div>
          </>
        ) : stage === 'yesno' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={answerYes} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Yes</button>
            <button onClick={answerNo} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>No</button>
          </div>
        ) : stage === 'closed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 700, textDecoration: 'none' }}>
              <Send size={14} /> Need something else? Message us on WhatsApp
            </a>
            <button onClick={startOver} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xs)', cursor: 'pointer', textDecoration: 'underline' }}>
              Start a new conversation
            </button>
          </div>
        ) : remainingCategories.length > 0 ? (
          <>
            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>WHAT WOULD YOU LIKE TO KNOW?</div>
            <div className="hide-sb" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 140, overflowY: 'auto' }}>
              {remainingCategories.map(cat => chip(`${cat.emoji} ${cat.label}`, () => pickCategory(cat), cat.key))}
            </div>
          </>
        ) : (
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 700, textDecoration: 'none' }}>
            <Send size={14} /> Still need help? Message us on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
