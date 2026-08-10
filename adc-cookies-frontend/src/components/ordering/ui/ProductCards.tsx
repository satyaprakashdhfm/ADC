'use client';
import Image from 'next/image';

export function Thumb({ size = 128, img, seed = 0 }: { size?: number; img?: string | null; seed?: number }) {
  if (img) return (
    <div style={{ width: size, height: size, borderRadius: 'var(--radius-image)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', flex: 'none' }}>
      <Image src={img} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
  const grads = [
    'radial-gradient(120% 120% at 35% 28%,var(--amber-300),var(--orange-500))',
    'radial-gradient(120% 120% at 35% 28%,var(--amber-400),var(--orange-600))',
    'radial-gradient(120% 120% at 35% 28%,var(--amber-200),var(--amber-500))',
  ];
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--radius-image)', background: grads[seed % 3], boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden', flex: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 32% 28%,var(--white-40),transparent 42%)' }} />
    </div>
  );
}

/* ---- Quantity Stepper ---- */

export function QStepper({ value, onChange, size = 'md' }: { value: number; onChange: (n: number) => void; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 32 : 44;
  const w = size === 'sm' ? 28 : 40;
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-button)', height: h, flex: 'none' }}>
      <button onClick={() => onChange(Math.max(0, value - 1))} style={{ width: w, height: h, border: 'none', background: 'transparent', fontSize: 18, color: 'var(--brand-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>−</button>
      <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, color: 'var(--text-strong)', fontSize: size === 'sm' ? 'var(--text-sm)' : 'var(--text-base)' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} style={{ width: w, height: h, border: 'none', background: 'transparent', fontSize: 18, color: 'var(--brand-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>+</button>
    </div>
  );
}

/* ---- Compact mobile product card — two-up grid, no ratings, ADD goes straight to cart ---- */
