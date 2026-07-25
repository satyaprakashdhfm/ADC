'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Gift, Building2, Truck, BadgeCheck } from 'lucide-react';
import EnquiryForm from './EnquiryForm';

const PERKS = [
  { icon: Building2, title: 'Custom branding', text: 'Your logo on sleeves, tins and gift notes.' },
  { icon: Gift, title: 'Curated hampers', text: 'Mix flavours and tins to any budget.' },
  { icon: Truck, title: 'Pan-India delivery', text: 'Bulk despatch to one address or many.' },
  { icon: BadgeCheck, title: 'Volume pricing', text: 'Better rates as quantities grow.' },
];

/** Bulk / corporate order enquiry — a focused modal so the ask never gets lost in a generic form. */
export default function BulkOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Portalled to <body>, so an ancestor with a transform/filter can never trap the overlay's
  // stacking context or clip it (see the same note in LocationPicker).
  return createPortal(
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Bulk and corporate order enquiry"
      style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'var(--espresso-50)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="hide-sb"
        style={{ position: 'relative', width: 'min(880px,96vw)', maxHeight: 'min(88svh,900px)', overflowY: 'auto', margin: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', animation: 'riseIn .3s var(--ease-spring) both' }}>
        <button onClick={onClose} aria-label="Close"
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 3, width: 36, height: 36, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>

        <div className="bulk-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* Left — what they get. Sells the enquiry rather than presenting a bare form. */}
          <div style={{ padding: 'clamp(24px,3vw,36px)', background: 'var(--gold)', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Corporate &amp; Bulk</p>
              <h2 style={{ font: '900 clamp(1.4rem,1.1rem + 1vw,2rem)/1.1 var(--font-display)', letterSpacing: '-.02em', color: 'var(--text-strong)', margin: '0 0 10px' }}>
                Cookies by the hundred, done properly.
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.6, margin: 0 }}>
                Client gifting, office celebrations, weddings and events — tell us what you need and we&apos;ll send a quote within one working day.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {PERKS.map(({ icon: Icon, title, text }) => (
                <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface-card)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none', border: '1px solid var(--border-default)' }}>
                    <Icon size={17} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{title}</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45 }}>{text}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — the form itself, bare (the modal already provides the card). */}
          <div style={{ padding: 'clamp(24px,3vw,36px)' }}>
            <EnquiryForm variant="bulk" bare />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
