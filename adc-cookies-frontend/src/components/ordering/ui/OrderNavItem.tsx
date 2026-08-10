'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type NavMenuItem = { label: string; href?: string; onClick?: () => void };

export function OrderNavItem({ label, href, menu }: { label: string; href: string; menu?: NavMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const hasMenu = !!menu && menu.length > 0;
  const itemStyle: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-body)', textDecoration: 'none', whiteSpace: 'nowrap', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' };
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'var(--amber-50)'; e.currentTarget.style.color = 'var(--brand-secondary)'; };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body)'; };
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ position: 'relative' }}>
      <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-strong)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color .18s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-strong)')}>
        {label}{hasMenu && <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
      </a>
      {hasMenu && open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 8, minWidth: 220, zIndex: 60 }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 360, overflowY: 'auto' }}>
            {menu!.map(m => m.onClick
              ? <button key={m.label} onClick={() => { m.onClick!(); setOpen(false); }} style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{m.label}</button>
              : <a key={m.label} href={m.href} style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{m.label}</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Tin Modal (full page) ---- */
