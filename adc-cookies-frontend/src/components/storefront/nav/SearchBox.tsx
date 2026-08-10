'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { firstImage, type Product } from '@/lib/api';

const ctaBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', border: 'none', cursor: 'pointer',
  borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)',
  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap',
  boxShadow: 'var(--shadow-brand)',
};

// A desktop nav link that reveals a dropdown on hover when it has menu items.

export function SearchBox({ products, compact, autoFocus, onNavigate }: { products: Product[]; compact?: boolean; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const term = query.trim();
  const suggestions = term.length
    ? products.filter(p => p.isAvailable && p.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6)
    : [];

  const go = (q: string) => {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    onNavigate?.();
    router.push(q ? `/order?q=${encodeURIComponent(q)}` : '/order');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => (i + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); go(suggestions[activeIndex].name); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', flex: compact ? undefined : 1, width: compact ? '100%' : undefined, maxWidth: compact ? undefined : 640, margin: compact ? undefined : '0 auto' }}>
      <form onSubmit={e => { e.preventDefault(); go(query.trim()); }} role="search" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cream-bg)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: compact ? '5px 5px 5px 14px' : '6px 6px 6px 18px', boxShadow: 'var(--shadow-xs)' }}>
        <Search size={compact ? 17 : 18} color="var(--text-muted)" style={{ flex: 'none' }} />
        <input
          autoFocus={autoFocus}
          name="q"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search cookies, gift tins…"
          aria-label="Search products"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: compact ? 'var(--text-sm)' : 'var(--text-base)', color: 'var(--text-strong)' }}
        />
        <button type="submit" style={{ ...ctaBtn, flex: 'none', padding: compact ? '8px 14px' : '9px 18px' }}>Search</button>
      </form>
      {open && term.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 70 }}>
          {suggestions.length ? suggestions.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => go(p.name)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border-default)', background: activeIndex === i ? 'var(--amber-50)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <Image src={firstImage(p.images)} alt="" width={34} height={34} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flex: 'none', textTransform: 'uppercase', letterSpacing: '.03em' }}>{p.category === 'TINS' ? 'Gift Tin' : 'Cookie'}</span>
            </button>
          )) : (
            <div style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No products found for &ldquo;{term}&rdquo;</div>
          )}
        </div>
      )}
    </div>
  );
}
