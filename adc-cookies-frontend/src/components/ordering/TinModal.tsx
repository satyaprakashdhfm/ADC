'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Gift } from 'lucide-react';
import { type TinItem } from './menuData';
import { QStepper } from './ui/ProductCards';

export default function TinModal({ tin, onClose, onAdd }: { tin: TinItem | null; onClose: () => void; onAdd: (tin: TinItem, qty: number) => void }) {
  const [qty, setQty] = useState(1);
  const open = !!tin;
  const unit = tin?.price || 0;

  useEffect(() => { if (tin) { setQty(1); } }, [tin]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 82, background: 'var(--surface-overlay)', backdropFilter: 'blur(3px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .3s' }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', zIndex: 83,
        width: 'min(460px,94vw)', maxHeight: '86vh',
        background: 'var(--surface-card)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)',
        transform: open ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(.96)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-spring)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {tin && (
          <>
            <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 3, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--white-90)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><X size={18} /></button>

            <div className="hide-sb" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Real tin image */}
              <div style={{ width: '100%', height: 190, position: 'relative', overflow: 'hidden' }}>
                {tin.img ? <Image src={tin.img} alt={tin.name} fill style={{ objectFit: 'cover' }} /> : (
                  <div style={{ width: '100%', height: '100%', background: 'radial-gradient(130% 120% at 40% 25%,var(--amber-300),var(--orange-500))' }} />
                )}
                <span style={{ position: 'absolute', left: 14, bottom: 14, padding: '5px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--panel-92)', color: 'var(--amber-800)', fontSize: 'var(--text-xs)', fontWeight: 800, boxShadow: 'var(--shadow-sm)' }}>Premium Gift Tin · {tin.count} cookies</span>
              </div>

              <div style={{ padding: '16px 20px 0' }}>
                <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{tin.name}</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.55 }}>{tin.desc} Hand-packed with {tin.count} premium cookies.</p>
                <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}>₹{tin.price}</div>
              </div>

              <div style={{ padding: '10px 20px 0', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gift size={14} color="var(--brand-secondary)" /> Add gift wrap &amp; a message for the whole order at the cart.
              </div>
              <div style={{ height: 16 }} />
            </div>

            <div style={{ borderTop: '1px solid var(--border-soft)', padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center', background: 'var(--surface-card)' }}>
              <QStepper value={qty} onChange={n => setQty(Math.max(1, n))} />
              <button onClick={() => onAdd(tin, qty)} style={{ flex: 1, padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer' }}>
                Add to Cart · ₹{unit * qty}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// Valid Indian states + UTs — the address form only accepts one of these.
