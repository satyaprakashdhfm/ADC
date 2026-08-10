'use client';
import Image from 'next/image';
import { type MenuItem } from '../menuData';

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

export function MobileProductCard({ item, qty, onQtyChange }: { item: MenuItem; qty: number; onQtyChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', borderRadius: 'var(--radius-image)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
        <Image src={item.img} alt={item.name} fill sizes="50vw" style={{ objectFit: 'cover' }} />
        {(item as any).best && <span style={{ position: 'absolute', top: 6, left: 6, padding: '2px 7px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Bestseller</span>}
      </div>
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {item.veg && <span style={{ width: 13, height: 13, border: '2px solid var(--mark-veg)', borderRadius: 2, display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mark-veg)', display: 'block' }} /></span>}
          <h3 style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{item.name}</h3>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{item.desc}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}>₹{item.price}</span>
          {qty === 0 ? (
            <button onClick={() => onQtyChange(1)} style={{ padding: '7px 18px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>ADD</button>
          ) : (
            <QStepper value={qty} onChange={onQtyChange} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Roomier DESKTOP product card — bigger image, full description, ADD/stepper (desktop only) ---- */

export function DeskProductCard({ item, qty, onQtyChange, badge }: { item: MenuItem; qty: number; onQtyChange: (n: number) => void; badge?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)', overflow: 'hidden', transition: 'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
        <Image src={item.img} alt={item.name} fill sizes="(max-width:1280px) 40vw, 440px" style={{ objectFit: 'cover' }} />
        {(badge || (item as { best?: boolean }).best) && <span style={{ position: 'absolute', top: 10, left: 10, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>{badge || 'Bestseller'}</span>}
      </div>
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {item.veg && <span style={{ width: 14, height: 14, border: '2px solid var(--mark-veg)', borderRadius: 2, display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mark-veg)', display: 'block' }} /></span>}
          <h3 style={{ font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{item.name}</h3>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>{item.desc}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}>₹{item.price}</span>
          {qty === 0
            ? <button onClick={() => onQtyChange(1)} style={{ padding: '9px 26px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>ADD</button>
            : <QStepper value={qty} onChange={onQtyChange} />}
        </div>
      </div>
    </div>
  );
}

/* ---- Loading skeleton (static, no animation) — shown until real products arrive so old images never flash ---- */

export function SkeletonCard() {
  const bar = (w: string, h: number, mb = 0): React.CSSProperties => ({ width: w, height: h, borderRadius: 6, background: 'var(--surface-raised)', marginBottom: mb });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
      <div style={{ width: '100%', aspectRatio: '4 / 3', background: 'var(--surface-raised)' }} />
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={bar('62%', 16, 10)} />
        <div style={bar('100%', 10, 6)} />
        <div style={bar('84%', 10, 14)} />
        <div style={bar('40%', 18)} />
      </div>
    </div>
  );
}

/* ---- Desktop nav item with hover dropdown (same look as the home page header) ---- */
