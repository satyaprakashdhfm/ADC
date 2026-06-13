'use client';
import Image from 'next/image';
import { Menu } from 'lucide-react';

interface NavProps {
  onMenuOpen: () => void;
}

export default function Nav({ onMenuOpen }: NavProps) {
  return (
    <header style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60,
      background: 'transparent',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', padding: '0 var(--gutter)',
        height: 150, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'relative',
      }}>
        {/* Logo — left aligned, larger */}
        <a href="#" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <Image src="/assets/adc-logo.png" height={168} width={232} alt="a dough cookie" style={{ display: 'block', objectFit: 'contain' }} />
        </a>

        {/* Menu button right */}
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={onMenuOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(0,0,0,.08)',
              borderRadius: 'var(--radius-pill)', padding: '15px 28px 15px 20px',
              cursor: 'pointer', color: 'var(--text-strong)',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1.25rem',
              transition: 'background .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.22)')}
          >
            <Menu size={28} />
            Menu
          </button>
        </div>
      </div>
    </header>
  );
}
