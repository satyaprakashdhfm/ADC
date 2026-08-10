'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Search, Cookie } from 'lucide-react';

type SuggestItem = { id: string; name: string; price: number; img: string | null; rec?: boolean; best?: boolean };

export function SearchSuggest({ value, onChange, onPick, items, placeholder, wrapStyle }: {
  value: string; onChange: (v: string) => void; onPick: (name: string) => void;
  items: SuggestItem[]; placeholder: string; wrapStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = (q ? items.filter(i => i.name.toLowerCase().includes(q)) : items.filter(i => i.rec || i.best)).slice(0, 6);
  return (
    <div style={{ position: 'relative', ...wrapStyle }}>
      <Search size={18} color="var(--text-subtle)" />
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none' }}
      />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 60, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px 4px', fontSize: 'var(--text-2xs)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 800 }}>{q ? 'Matches' : 'Popular picks'}</div>
          {matches.map(m => (
            <button key={m.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(m.name); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--surface-sunken)', flex: 'none', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                {m.img ? <Image src={m.img} alt="" width={38} height={38} style={{ width: 38, height: 38, objectFit: 'cover' }} /> : <Cookie size={18} color="var(--brand-secondary)" />}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--brand-secondary)', flex: 'none' }}>₹{m.price}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ---- Razorpay Checkout (popup) ---- */
