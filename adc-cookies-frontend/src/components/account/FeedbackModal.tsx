'use client';
import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { submitFeedback, type PendingFeedback } from '@/lib/api';

/*
 * The three questions we ask once an order has actually arrived.
 *
 * Each is a 1-5 rating plus an optional comment, and each comment box offers word chips the
 * customer can tap instead of typing. The chips are a shortcut, never a constraint: tapping one
 * appends it to whatever is already in the box, and the box stays freely editable.
 *
 * Chips are chosen by the rating given, because the useful prompts after one star and after five
 * are not the same words — offering "Loved it" to someone who just rated us 1/5 reads as not
 * listening. Below three is the unhappy set, three is the middling set, above three the happy one.
 */
const QUESTIONS = [
  {
    key: 'website' as const,
    title: 'How was the website?',
    hint: 'Browsing, finding cookies, the look of it.',
    chips: {
      low: ['Confusing', 'Slow', 'Hard to find'],
      mid: ['Okay', 'Cluttered', 'Could be faster'],
      high: ['Easy', 'Beautiful', 'Fast'],
    },
  },
  {
    key: 'flow' as const,
    title: 'How easy was ordering and paying?',
    hint: 'Checkout, payment, and understanding what you had ordered.',
    chips: {
      low: ['Confusing', 'Payment failed', 'Too many steps'],
      mid: ['Okay', 'Slow payment', 'Unclear total'],
      high: ['Smooth', 'Quick', 'Clear'],
    },
  },
  {
    key: 'delivery' as const,
    title: 'How was the delivery?',
    hint: 'Timing, condition on arrival, and the delivery partner.',
    chips: {
      low: ['Late', 'Damaged', 'Rude'],
      mid: ['Okay', 'A bit late', 'Average packing'],
      high: ['On time', 'Well packed', 'Polite'],
    },
  },
];

type Key = (typeof QUESTIONS)[number]['key'];

function chipsFor(q: (typeof QUESTIONS)[number], rating: number) {
  if (!rating) return q.chips.high;      // nothing rated yet — lead with the positive set
  if (rating < 3) return q.chips.low;
  if (rating === 3) return q.chips.mid;
  return q.chips.high;
}

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 }}
        >
          <Star
            size={26}
            style={{
              fill: n <= shown ? 'var(--accent, #f5a524)' : 'transparent',
              color: n <= shown ? 'var(--accent, #f5a524)' : 'var(--border-default, #cbd5e1)',
              transition: 'fill .12s, color .12s',
            }}
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackModal({
  order, onClose, onDone,
}: { order: PendingFeedback; onClose: () => void; onDone: () => void }) {
  const [ratings, setRatings] = useState<Record<Key, number>>({ website: 0, flow: 0, delivery: 0 });
  const [comments, setComments] = useState<Record<Key, string>>({ website: '', flow: '', delivery: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = QUESTIONS.every((q) => ratings[q.key] > 0);

  /* Append rather than replace: chips are meant to be combined, and with several tapped the box
     reads as a sentence the customer can then edit. Tapping the same one twice is a no-op. */
  function addChip(key: Key, word: string) {
    setComments((c) => {
      const cur = c[key].trim();
      if (cur.toLowerCase().includes(word.toLowerCase())) return c;
      return { ...c, [key]: cur ? `${cur}, ${word}` : word };
    });
  }

  async function save() {
    if (!complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      await submitFeedback(order.id, {
        websiteRating: ratings.website, websiteComment: comments.website,
        flowRating: ratings.flow, flowComment: comments.flow,
        deliveryRating: ratings.delivery, deliveryComment: comments.delivery,
      });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not send your feedback — please try again.');
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Order feedback"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--panel, #fff)', borderRadius: 'var(--radius-card, 14px)',
          width: 'min(640px, 100%)', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 8px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)' }}>
              How did we do?
            </h2>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted, #64748b)', fontSize: 14 }}>
              Your order {order.orderNumber} has been delivered. Three quick questions.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted, #64748b)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '8px 20px 4px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {QUESTIONS.map((q) => (
            <div key={q.key} style={{ borderTop: '1px solid var(--border-default, #e2e8f0)', paddingTop: 16 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: 2 }}>{q.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginBottom: 10 }}>{q.hint}</div>

              {/* Stars left, comment right on a wide screen; stacked on a phone. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ flex: '0 0 auto' }}>
                  <Stars label={q.title} value={ratings[q.key]} onChange={(n) => setRatings((r) => ({ ...r, [q.key]: n }))} />
                </div>
                <div style={{ flex: '1 1 260px', minWidth: 220 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {chipsFor(q, ratings[q.key]).map((w) => (
                      <button key={w} type="button" onClick={() => addChip(q.key, w)}
                        style={{
                          border: '1px solid var(--border-default, #cbd5e1)', background: 'var(--surface-sunken, #f8fafc)',
                          borderRadius: 999, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                          color: 'var(--text-strong)',
                        }}>
                        {w}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={comments[q.key]}
                    onChange={(e) => setComments((c) => ({ ...c, [q.key]: e.target.value }))}
                    placeholder="Anything you'd like to add? (optional)"
                    rows={2}
                    maxLength={1000}
                    aria-label={`${q.title} comment`}
                    style={{
                      width: '100%', resize: 'vertical', padding: '8px 10px', fontSize: 14,
                      borderRadius: 'var(--radius-input, 10px)', border: '1px solid var(--border-default, #cbd5e1)',
                      background: 'var(--panel, #fff)', color: 'var(--text-strong)', fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" style={{ margin: '10px 20px 0', color: 'var(--danger, #dc2626)', fontSize: 13 }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px 20px' }}>
          <button type="button" onClick={onClose} disabled={saving}
            style={{
              background: 'none', border: '1px solid var(--border-default, #cbd5e1)', borderRadius: 999,
              padding: '9px 16px', cursor: saving ? 'default' : 'pointer', color: 'var(--text-muted, #64748b)', fontSize: 14,
            }}>
            Maybe later
          </button>
          <button type="button" onClick={save} disabled={!complete || saving}
            title={complete ? undefined : 'Rate all three to send'}
            style={{
              background: complete ? 'var(--accent, #f5a524)' : 'var(--surface-sunken, #e2e8f0)',
              color: complete ? '#fff' : 'var(--text-muted, #94a3b8)',
              border: 'none', borderRadius: 999, padding: '9px 18px', fontSize: 14, fontWeight: 600,
              cursor: complete && !saving ? 'pointer' : 'default',
            }}>
            {saving ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
