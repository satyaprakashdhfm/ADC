'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Check } from 'lucide-react';
import { firstImage, type PackConfig, type PackPick } from '@/lib/api';

/*
 * Choosing what goes in a build-your-own pack.
 *
 * The pack is one product at one fixed price with N slots underneath it, and the slots come from
 * the server (see packs.js) rather than being described here — the same rules decide whether the
 * order is accepted, and a picker that disagrees with the validator hands the customer that
 * disagreement at the Pay button.
 *
 * Quantities, not toggles. Three filled slots against a catalogue with three filled cookies means
 * repeats are normal, not an edge case, so every choice is a stepper and "2× Biscoff, 1× Nutella"
 * is an ordinary thing to express. A row of tick-boxes could not say it at all.
 *
 * One component for both layouts. A phone gets a sheet that rises from the bottom with the summary
 * and the Add button pinned above the fold of the thumb; a desktop gets a centred dialog. The
 * difference is a handful of style values rather than two component trees, because two trees is how
 * the two stop matching after the third change to one of them.
 */

type Counts = Record<string, Record<number, number>>;   // slotKey -> productId -> qty

export default function PackBuilderModal({ pack, onClose, onAdd }: {
  pack: PackConfig;
  onClose: () => void;
  onAdd: (picks: PackPick[], summary: string[]) => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [counts, setCounts] = useState<Counts>(() =>
    Object.fromEntries(pack.slots.map(s => [s.key, {}])));

  /* Rendered into <body> and the page behind it frozen, for the same reason the order Track sheet
     is: as a child of a product card it inherits whatever that card's ancestors do about overflow
     and stacking, and the page kept scrolling underneath a sheet that is meant to be the only
     thing moving. Restore rather than clear on the way out — losing body overflow leaves the whole
     site unscrollable. */
  useEffect(() => {
    setHost(document.body);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onEsc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = useMemo(() => Object.fromEntries(pack.slots.map(s =>
    [s.key, Object.values(counts[s.key] || {}).reduce((n, q) => n + q, 0)])), [counts, pack.slots]);

  const totalChosen = Object.values(chosen).reduce((n, q) => n + q, 0);
  const complete = pack.slots.every(s => chosen[s.key] === s.count);

  const bump = (slotKey: string, productId: number, delta: number, max: number) => {
    setCounts(prev => {
      const slot = { ...(prev[slotKey] || {}) };
      const taken = Object.values(slot).reduce((n, q) => n + q, 0);
      const next = (slot[productId] || 0) + delta;
      // Never let a slot go past its count: the Add button would refuse it anyway, and a stepper
      // that moves and is then rejected is worse than one that simply stops.
      if (next < 0 || (delta > 0 && taken >= max)) return prev;
      if (next === 0) delete slot[productId]; else slot[productId] = next;
      return { ...prev, [slotKey]: slot };
    });
  };

  const submit = () => {
    if (!complete) return;
    const picks: PackPick[] = [];
    for (const slot of pack.slots) {
      for (const [pid, qty] of Object.entries(counts[slot.key] || {})) {
        const choice = slot.choices.find(c => c.productId === Number(pid));
        if (choice && qty > 0) picks.push({ slot: slot.key, productId: choice.productId, name: choice.name, quantity: qty });
      }
    }
    onAdd(picks, picks.map(p => `${p.quantity}× ${p.name}`));
  };

  if (!host) return null;

  /* A catalogue problem, said as one. A slot with nothing available cannot be satisfied, and
     rendering an empty list would leave the customer hunting for a control that is not there. */
  const blocked = pack.unavailableSlots.length > 0;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="scrim"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(40,20,5,.55)',
          backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        className="pack-scrim"
      >
        <motion.div
          key="sheet"
          role="dialog" aria-modal="true" aria-label={`Choose your ${pack.name}`}
          onClick={e => e.stopPropagation()}
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="pack-sheet"
          style={{ width: '100%', maxWidth: 560, maxHeight: '92svh', display: 'flex', flexDirection: 'column',
            background: 'var(--cream-bg)', borderRadius: '20px 20px 0 0', overflow: 'hidden',
            boxShadow: '0 -8px 40px rgba(70,35,0,.28)' }}
        >
          {/* ---- header ---- */}
          <div style={{ flex: 'none', padding: '14px 16px 12px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-card)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ font: '900 var(--text-lg)/1.15 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{pack.name}</h2>
                <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Build your box — ₹{pack.price} whatever you choose.
                </p>
              </div>
              <button onClick={onClose} aria-label="Close"
                style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--border-default)',
                  background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-body)' }}>
                <X size={17} />
              </button>
            </div>
          </div>

          {/* ---- slots ---- */}
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px 16px' }}>
            {blocked && (
              <p style={{ margin: '12px 0', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-wash)',
                border: '1px solid var(--status-error)', color: 'var(--status-error)', fontSize: 'var(--text-xs)', fontWeight: 700, lineHeight: 1.5 }}>
                {pack.unavailableSlots.join(' and ')} are all sold out just now, so this box cannot be built. Please try again later.
              </p>
            )}

            {pack.slots.map(slot => {
              const picked = chosen[slot.key] || 0;
              const full = picked === slot.count;
              return (
                <section key={slot.key} style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <h3 style={{ font: '900 var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{slot.label}</h3>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--text-2xs)', fontWeight: 900, padding: '2px 9px',
                      borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap',
                      background: full ? 'var(--status-success)' : 'var(--amber-100)',
                      color: full ? 'var(--white)' : 'var(--amber-800)' }}>
                      {full ? <><Check size={11} style={{ verticalAlign: -1 }} /> {slot.count} chosen</> : `${picked} of ${slot.count}`}
                    </span>
                  </div>
                  {slot.hint && <p style={{ margin: '0 0 9px', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', lineHeight: 1.45 }}>{slot.hint}</p>}

                  <div style={{ display: 'grid', gap: 8 }}>
                    {slot.choices.map(c => {
                      const qty = counts[slot.key]?.[c.productId] || 0;
                      const atLimit = picked >= slot.count;
                      return (
                        <div key={c.productId}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 'var(--radius-sm)',
                            border: `1.5px solid ${qty ? 'var(--brand-secondary)' : 'var(--border-soft)'}`,
                            background: qty ? 'var(--amber-50)' : 'var(--surface-card)', transition: 'border-color .15s, background .15s' }}>
                          <div style={{ flex: 'none', position: 'relative', width: 44, height: 44, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                            {firstImage(c.images) && <Image src={firstImage(c.images)} alt="" fill sizes="44px" style={{ objectFit: 'cover' }} />}
                          </div>
                          {/* minWidth 0 so a long cookie name wraps inside the row instead of widening it */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1.3 }}>{c.name}</div>
                            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700 }}>₹{c.price} each</div>
                          </div>
                          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <button onClick={() => bump(slot.key, c.productId, -1, slot.count)} disabled={qty === 0} aria-label={`One fewer ${c.name}`}
                              style={stepBtn(qty === 0)}><Minus size={15} /></button>
                            <span aria-live="polite" style={{ minWidth: 24, textAlign: 'center', fontWeight: 900, fontSize: 'var(--text-sm)', color: qty ? 'var(--text-strong)' : 'var(--text-subtle)' }}>{qty}</span>
                            <button onClick={() => bump(slot.key, c.productId, 1, slot.count)} disabled={atLimit} aria-label={`One more ${c.name}`}
                              style={stepBtn(atLimit)}><Plus size={15} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* ---- footer: pinned, so the Add button is never scrolled away from a thumb ---- */}
          <div style={{ flex: 'none', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--border-soft)', background: 'var(--surface-card)',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ font: '900 var(--text-lg)/1 var(--font-display)', color: 'var(--text-strong)' }}>₹{pack.price}</div>
              <div style={{ fontSize: 'var(--text-2xs)', color: complete ? 'var(--status-success)' : 'var(--text-muted)', fontWeight: 800, marginTop: 2 }}>
                {complete ? 'Ready to add' : `${totalChosen} of ${pack.size} chosen`}
              </div>
            </div>
            <button onClick={submit} disabled={!complete || blocked}
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px',
                borderRadius: 'var(--radius-pill)', border: 'none',
                background: complete && !blocked ? 'var(--gradient-warm)' : 'var(--surface-sunken)',
                color: complete && !blocked ? 'var(--white)' : 'var(--text-subtle)',
                fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 'var(--text-sm)',
                cursor: complete && !blocked ? 'pointer' : 'not-allowed' }}>
              <Plus size={16} /> Add to cart
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    host,
  );
}

const stepBtn = (disabled: boolean): React.CSSProperties => ({
  width: 30, height: 30, borderRadius: '50%',
  border: `1.5px solid ${disabled ? 'var(--border-soft)' : 'var(--brand-secondary)'}`,
  background: disabled ? 'transparent' : 'var(--surface-raised)',
  color: disabled ? 'var(--text-subtle)' : 'var(--brand-secondary)',
  display: 'grid', placeItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer',
});
