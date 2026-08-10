'use client';
import { Cookie } from 'lucide-react';
import { CATEGORY_META } from '../menuData';

export function CategoryTab({ label, selected, onClick, compact = false }: { label: string; selected: boolean; onClick: () => void; compact?: boolean }) {
  const Icon = CATEGORY_META[label as keyof typeof CATEGORY_META]?.icon ?? Cookie;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 11,
        width: compact ? 'auto' : '100%',
        padding: compact ? '5px 9px 5px 5px' : '5px 8px 5px 5px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: compact ? 42 : 46,
          height: compact ? 42 : 46,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
          background: selected ? 'var(--teal-50)' : 'var(--panel-74)',
          color: selected ? 'var(--brand-secondary)' : 'var(--text-muted)',
          boxShadow: selected ? 'inset 0 0 0 1px var(--teal-500-14)' : 'inset 0 0 0 1px var(--border-soft)',
          transition: 'background var(--dur-base), color var(--dur-base), box-shadow var(--dur-base)',
        }}
      >
        <Icon size={compact ? 20 : 22} strokeWidth={1.8} />
      </span>
      <span
        style={{
          color: selected ? 'var(--brand-secondary)' : 'var(--text-muted)',
          fontSize: compact ? 'var(--text-sm)' : 'var(--text-base)',
          fontWeight: selected ? 800 : 700,
          lineHeight: 1,
          transition: 'color var(--dur-base)',
        }}
      >
        {label}
      </span>
    </button>
  );
}
