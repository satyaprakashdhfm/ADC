'use client';
import { AlertTriangle, Info, Clock } from 'lucide-react';
import { card } from '../shared/ui';

/**
 * A titled card with a one-line plain-words explanation under the title.
 *
 * Every section on this tab carries one, because the people reading it are running a bakery, not
 * an ad agency: "Visits → orders" means nothing until something says it is out of every 100 visits.
 */
export function Section({ title, hint, right, children }: {
  title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ ...card, padding: 20, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: hint ? 4 : 12 }}>
        <h3 style={{ fontSize: 'var(--text-h4)' }}>{title}</h3>
        {right}
      </div>
      {hint && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 14px' }}>{hint}</p>}
      {/* minWidth:0 + overflow, as in Panel: a wide table scrolls inside the card on a phone
          instead of stretching the whole page sideways. */}
      <div style={{ overflowX: 'auto', minWidth: 0, maxWidth: '100%' }} className="hide-sb">{children}</div>
    </div>
  );
}

const TONES = {
  info: { bg: 'var(--surface-sunken)', fg: 'var(--text-body)', Icon: Info },
  waiting: { bg: 'var(--amber-50)', fg: 'var(--amber-800)', Icon: Clock },
  error: { bg: 'var(--status-error-bg)', fg: 'var(--status-error)', Icon: AlertTriangle },
} as const;

/** A callout: something not connected yet, a report that failed, or a note on reading the numbers. */
export function Notice({ tone = 'info', title, children }: { tone?: keyof typeof TONES; title?: string; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-input)', background: t.bg, color: t.fg, fontSize: 'var(--text-sm)', lineHeight: 1.55 }}>
      <t.Icon size={16} style={{ flex: 'none', marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        {title && <strong style={{ display: 'block', marginBottom: 2 }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/** The row label in a table: the name, and underneath it what the name means. */
export function Labelled({ label, hint }: { label: string; hint?: string }) {
  return (
    <div style={{ minWidth: 160 }}>
      <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{label}</div>
      {hint && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', lineHeight: 1.5, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
