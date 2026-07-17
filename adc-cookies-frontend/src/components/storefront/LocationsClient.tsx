'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Phone, Navigation, ShoppingBag, Search, MapPin } from 'lucide-react';
import { STORES } from '@/lib/stores';

const StoreMap = dynamic(() => import('./StoreMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', minHeight: 420, height: '100%', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-default)', background: 'var(--surface-raised)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading map…</div>
  ),
});

const CITIES = [...new Set(STORES.map((s) => s.city))];

/** Store finder — searchable store list beside an interactive map of all outlets. */
export default function LocationsClient() {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = ql ? STORES.filter((s) => `${s.city} ${s.name} ${s.address}`.toLowerCase().includes(ql)) : STORES;

  return (
    <div style={{ display: 'flex', gap: 'clamp(16px,2.5vw,32px)', flexWrap: 'wrap', alignItems: 'stretch' }}>
      {/* Left — search + city chips + store list */}
      <div style={{ flex: '1 1 330px', maxWidth: 440, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Postcode, town or city" aria-label="Search stores" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 42px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Cities</span>
          {CITIES.map((c) => (
            <button key={c} onClick={() => setQ(c)} style={{ padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>{c}</button>
          ))}
          {q && <button onClick={() => setQ('')} style={{ padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'transparent', color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>Clear</button>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.map((s) => (
            <article key={s.name} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              {s.image ? (
                // These illustrations are tall (portrait, ~9:16) with the store name/city/address
                // baked in at the top and the storefront photo below — a wide 16:10 crop was
                // showing only the top third and cutting the address + storefront off. 2:3 keeps
                // almost the whole thing (only the empty pavement at the very bottom is trimmed).
                <div style={{ position: 'relative', width: '100%', aspectRatio: '2 / 3' }}>
                  <Image src={s.image} alt={s.name} fill sizes="(max-width:760px) 100vw, 420px" style={{ objectFit: 'cover', objectPosition: 'top' }} />
                </div>
              ) : (
                <div style={{ width: '100%', aspectRatio: '2 / 3', background: 'radial-gradient(120% 120% at 35% 28%,var(--amber-300),var(--orange-500))', display: 'grid', placeItems: 'center' }}>
                  <MapPin size={34} color="var(--white)" />
                </div>
              )}
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 4px' }}>{s.city}</p>
                <h3 style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{s.name}</h3>
                <p style={{ color: 'var(--text-body)', lineHeight: 1.5, margin: '0 0 10px', fontSize: 'var(--text-xs)' }}>{s.address}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                  <a href={`tel:${s.phone.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-xs)' }}><Phone size={13} /> {s.phone}</a>
                  <Link href={s.map} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-xs)' }}><Navigation size={13} /> Directions</Link>
                </div>
                <Link href={`/order?store=${encodeURIComponent(s.city.toLowerCase())}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', boxSizing: 'border-box', padding: '10px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 800, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)' }}><ShoppingBag size={15} /> Order from this store</Link>
              </div>
            </article>
          ))}
          {!list.length && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No stores match “{q}”. Try Bengaluru or Chennai.</p>}
        </div>
      </div>

      {/* Right — interactive map */}
      <div style={{ flex: '2 1 460px', minWidth: 0, minHeight: 420 }}>
        <StoreMap />
      </div>
    </div>
  );
}
