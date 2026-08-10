'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { type NavLinkDef } from '@/lib/navLinks';

/* A desktop nav link that reveals a dropdown on hover when it has menu items.
   Shared by both branches: the behaviour is the same everywhere, only the surrounding
   header's styling differs. */
export function NavItem({ item, menu }: { item: NavLinkDef; menu?: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const hasMenu = !!menu && menu.length > 0;
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ position: 'relative' }}>
      <a href={item.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--white)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color .18s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-900)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--white)')}>
        {item.label}{hasMenu && <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
      </a>
      {hasMenu && open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 8, minWidth: 220, zIndex: 60 }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 360, overflowY: 'auto' }}>
            {menu!.map(m => (
              <a key={m.label} href={m.href} style={{ display: 'block', padding: '8px 12px', borderRadius: 8, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-body)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--amber-50)'; e.currentTarget.style.color = 'var(--brand-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body)'; }}
              >{m.label}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Search bar with a live "products matching what you're typing" dropdown — customers browsing a
// brand-new site don't know our menu names yet, so surfacing matches as they type (not just after
// they hit Enter) is what actually helps them find something.
