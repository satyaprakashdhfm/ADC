'use client';
import { useState } from 'react';
import { Search, Filter } from 'lucide-react';

export const card: React.CSSProperties = { background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)' };
export const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', fontWeight: 800, borderBottom: '1px solid var(--border-default)' };
export const td: React.CSSProperties = { padding: '12px', fontSize: 'var(--text-sm)', color: 'var(--text-body)', borderBottom: '1px solid var(--border-soft)', verticalAlign: 'middle' };
export const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
export const addBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' };
export const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', color: 'var(--text-body)', marginRight: 6 };

/** Labelled row action ("Label", "POD", "Status", "Cancel"). `danger` tints it for destructive ones. */
export const actionBtn = (danger = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--radius-pill)',
  border: `1.5px solid ${danger ? 'var(--status-error)' : 'var(--border-default)'}`,
  background: 'var(--surface-card)', color: danger ? 'var(--status-error)' : 'var(--text-body)',
  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-2xs)', cursor: 'pointer', whiteSpace: 'nowrap',
});

export function MiniStat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div style={{ ...card, padding: '10px 14px' }}>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: bad ? 'var(--status-error)' : 'var(--text-strong)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

export function StatCard({ icon, label, value, sub, accent, onClick }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} style={{ ...card, padding: 18, cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={onClick ? (e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }) : undefined}
      onMouseLeave={onClick ? (e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }) : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: accent ? 'var(--brand-secondary)' : 'var(--amber-50)', color: accent ? 'var(--white)' : 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ font: 'var(--weight-extra) var(--text-h2)/1 var(--font-display)', color: 'var(--text-strong)' }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function Panel({ title, children, loading, action }: { title: string; children: React.ReactNode; loading?: boolean; action?: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ flex: 1, fontSize: 'var(--text-h4)' }}>{title}</h3>
        {action}
      </div>
      {/* minWidth:0 is what actually makes the horizontal scroll work on a phone: without it a wide
          table stretches this flex/grid child instead of scrolling inside it, and the whole admin
          page ends up wider than the screen. */}
      {loading ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div> : <div style={{ overflowX: 'auto', minWidth: 0, maxWidth: '100%' }} className="hide-sb">{children}</div>}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
      <thead><tr>{head.map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Badge({ text, ok }: { text: string; ok?: boolean }) {
  return <span style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-xs)', fontWeight: 800, background: ok ? 'var(--status-success-bg)' : 'var(--surface-sunken)', color: ok ? 'var(--status-success)' : 'var(--text-muted)' }}>{text}</span>;
}

export function Empty({ text }: { text: string }) {
  return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{text}</div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</span>{children}</label>;
}

// Search box + a compact "Filters" popover (the filter symbol reveals the extra filters inside).
export function FilterBar({ search, onSearch, placeholder, onClear, active, children }: { search: string; onSearch: (v: string) => void; placeholder: string; onClear: () => void; active: boolean; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input style={{ ...inp, paddingLeft: 34 }} placeholder={placeholder} value={search} onChange={e => onSearch(e.target.value)} />
      </div>
      {children && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpen(o => !o)} aria-label="Filters" style={{ ...iconBtn, width: 'auto', padding: '0 14px', height: 40, marginRight: 0, display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 'var(--text-sm)', color: active ? 'var(--brand-secondary)' : 'var(--text-body)', borderColor: active ? 'var(--brand-secondary)' : 'var(--border-default)' }}>
            <Filter size={15} /> Filters{active ? ' •' : ''}
          </button>
          {open && (<>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 31, width: 250, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-md)', padding: 14, display: 'grid', gap: 12 }}>
              {children}
              <button onClick={() => { onClear(); setOpen(false); }} style={{ ...iconBtn, width: '100%', padding: '8px', marginRight: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>Clear all</button>
            </div>
          </>)}
        </div>
      )}
      {!children && active && <button onClick={onClear} style={{ ...iconBtn, width: 'auto', padding: '0 12px', marginRight: 0, fontSize: 'var(--text-xs)', fontWeight: 700 }}>Clear</button>}
    </div>
  );
}

// Prev/next pager. Renders nothing when everything fits on one page.
export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1, to = Math.min(total, page * pageSize);
  const btn = (disabled: boolean): React.CSSProperties => ({ ...iconBtn, width: 'auto', padding: '0 12px', height: 34, marginRight: 0, opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 'var(--text-sm)' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{from}–{to} of {total}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} style={btn(page <= 1)}>Prev</button>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} style={btn(page >= pages)}>Next</button>
      </div>
    </div>
  );
}
