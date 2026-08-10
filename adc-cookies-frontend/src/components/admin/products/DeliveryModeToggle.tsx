'use client';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { inp } from '../shared/ui';

/**
 * One delivery-mode on/off switch on the product form. Turning it OFF requires a reason before it
 * can be saved with that value — an off switch with no explanation is useless to whoever reads it
 * later (the customer sees this text when the product is disabled for them; another admin sees it
 * when wondering why a product they didn't touch is suddenly unavailable). `children` renders
 * extra fields only relevant while this mode is ON (e.g. the city restriction, for intracity).
 */
export default function DeliveryModeToggle({ label, available, reason, onToggle, onReason, children }: {
  label: string; available: boolean; reason: string;
  onToggle: (v: boolean) => void; onReason: (r: string) => void; children?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', flex: 1 }}>{label}</span>
        <button type="button" onClick={() => onToggle(!available)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 'var(--radius-pill)',
            border: `1.5px solid ${available ? 'var(--border-default)' : 'var(--status-error)'}`,
            background: available ? 'var(--surface-card)' : 'var(--status-error-bg, #fdecec)',
            color: available ? 'var(--text-body)' : 'var(--status-error)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
          {available ? <ToggleRight size={15} color="var(--brand-secondary)" /> : <ToggleLeft size={15} />}
          {available ? 'On' : 'Off'}
        </button>
      </div>
      {!available && (
        <div style={{ marginTop: 8 }}>
          <input style={{ ...inp, borderColor: !reason.trim() ? 'var(--status-error)' : undefined }}
            placeholder={'Reason shown to the customer (required) — e.g. "Out of same-day stock today"'}
            value={reason} onChange={e => onReason(e.target.value)} />
          {!reason.trim() && (
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', margin: '4px 0 0' }}>
              A reason is required while this is off.
            </p>
          )}
        </div>
      )}
      {available && children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}
