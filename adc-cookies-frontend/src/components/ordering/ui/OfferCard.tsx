'use client';
import { useState } from 'react';

/**
 * One coupon offer — the spin-wheel win and the publicly available codes are the same card.
 *
 * They used to be two near-identical blocks written out separately, and they had drifted: the
 * available offers said "Min. order ₹500" while the spin reward said only when it expired. So the
 * one code most likely to fail was the one that never mentioned the condition it would fail on —
 * you tapped Apply and got "Order amount below minimum" with no way to have known.
 *
 * Both now show the minimum, both link their terms, and Apply is disabled with the shortfall on it
 * when the basket is short. A button that can only produce an error should say so instead of
 * offering itself.
 */
export interface OfferCardProps {
  icon: React.ReactNode;
  code: string;
  label: string;
  minimumOrderAmount?: number | null;
  /** Milliseconds left before it expires — spin rewards only; omitted for standing offers. */
  expiresInMs?: number | null;
  expiresLabel?: string;
  terms?: string | null;
  /** How far under the minimum this order is. 0 or undefined means it can be applied. */
  shortfall?: number;
  onApply: () => void;
}

export default function OfferCard({
  icon, code, label, minimumOrderAmount, expiresInMs, expiresLabel, terms, shortfall = 0, onApply,
}: OfferCardProps) {
  const [showTerms, setShowTerms] = useState(false);
  const blocked = shortfall > 0;

  return (
    <div style={{ padding: '11px 13px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--brand-secondary)', background: 'var(--amber-50)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 'none', display: 'grid', placeItems: 'center' }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '.04em', color: 'var(--brand-secondary)' }}>{code}</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-strong)' }}>{label}</span>
          </div>
          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2 }}>
            {minimumOrderAmount ? `Min. order ₹${minimumOrderAmount}` : 'No minimum order'}
            {expiresInMs != null && expiresLabel ? ` · Expires in ${expiresLabel}` : null}
          </div>
        </div>
        <button
          onClick={onApply}
          disabled={blocked}
          title={blocked ? `Add ₹${shortfall} more to use this code` : `Apply ${code}`}
          style={{
            flex: 'none', padding: '7px 14px', borderRadius: 'var(--radius-button)', border: 'none',
            background: blocked ? 'var(--border-default)' : 'var(--gradient-warm)',
            color: blocked ? 'var(--text-muted)' : 'var(--white)',
            fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)',
            cursor: blocked ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {blocked ? `Add ₹${shortfall} more` : 'Apply'}
        </button>
      </div>

      {/* Terms behind a toggle rather than always open: they are long, most people never read them,
          and the ones who do are looking for them deliberately. Hidden they cost a line; open they
          would cost the card. */}
      {terms?.trim() ? (
        <>
          <button
            onClick={() => setShowTerms(v => !v)}
            aria-expanded={showTerms}
            style={{
              marginTop: 7, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--text-link)', fontFamily: 'var(--font-body)', fontWeight: 800,
              fontSize: 'var(--text-2xs)', textDecoration: 'underline',
            }}
          >
            {showTerms ? 'Hide terms' : 'Terms & conditions'}
          </button>
          {showTerms && (
            <p style={{ margin: '7px 0 0', fontSize: 'var(--text-2xs)', lineHeight: 1.6, color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
              {terms}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
