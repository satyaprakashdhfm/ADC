'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Phone, Navigation, ShoppingBag, Search, MapPin, MessageCircle, Mail } from 'lucide-react';
import { STORES, type Store } from '@/lib/stores';
import { useLocation } from '@/context/LocationContext';
import { whatsappLink } from '@/lib/site';

const StoreMap = dynamic(() => import('./StoreMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', minHeight: 380, borderRadius: 'var(--radius-card)', border: '1px solid var(--border-default)', background: 'var(--surface-raised)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading map…</div>
  ),
});

const CITIES = [...new Set(STORES.map((s) => s.city))];

/** Store finder — searchable store list beside an interactive map of all outlets. */
export default function LocationsClient() {
  const [q, setQ] = useState('');
  const { chooseStore } = useLocation();
  const router = useRouter();
  const ql = q.trim().toLowerCase();
  const list = ql ? STORES.filter((s) => `${s.city} ${s.name} ${s.address}`.toLowerCase().includes(ql)) : STORES;

  // "Order from this store" used to link to /order?store=… — a route that just redirects to the
  // homepage, losing the choice. Set it as the delivery store for real, then go to the menu.
  const orderFrom = (s: Store) => { chooseStore(s); router.push('/#products'); };

  return (
    <div style={{ display: 'flex', gap: 'clamp(16px,2.5vw,32px)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Left — search + city chips + store list. Wider than the map: the cards are the point of
          this page, the map is orientation. */}
      <div style={{ flex: '3 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px,2vw,22px)' }}>
          {list.map((s) => (
            <article key={s.name} id={`store-${s.pincode}`} className="store-card" style={{ scrollMarginTop: 120, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'stretch' }}>
              {/* The store illustrations are tall portraits (name/city/address baked in), so they get
                  their own portrait column at the matching 2:3 ratio — `cover` then fills it with no
                  letterboxing, and the details sit alongside instead of under a band of empty space. */}
              {s.image ? (
                <div className="store-card-img" style={{ position: 'relative', flex: 'none', width: 'clamp(150px,22vw,208px)', aspectRatio: '2 / 3', background: 'var(--surface-sunken)' }}>
                  <Image src={s.image} alt={s.name} fill sizes="(max-width:680px) 100vw, 208px" style={{ objectFit: 'cover', objectPosition: 'top' }} />
                </div>
              ) : (
                <div className="store-card-img" style={{ flex: 'none', width: 'clamp(150px,22vw,208px)', aspectRatio: '2 / 3', background: 'radial-gradient(120% 120% at 35% 28%,var(--amber-300),var(--orange-500))', display: 'grid', placeItems: 'center' }}>
                  <MapPin size={34} color="var(--white)" />
                </div>
              )}
              <div className="store-card-body" style={{ flex: 1, minWidth: 0, padding: 'clamp(16px,2vw,24px)', display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 5px' }}>{s.city}</p>
                <h3 style={{ font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 8px' }}>{s.name}</h3>
                <p style={{ color: 'var(--text-body)', lineHeight: 1.55, margin: '0 0 14px', fontSize: 'var(--text-sm)' }}>{s.address}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                  <a href={`tel:${s.phone.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Phone size={14} /> {s.phone}</a>
                  <a href={whatsappLink(`Hi! I'd like to ask about the ${s.name} store.`)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--whatsapp-green)', fontWeight: 800, fontSize: 'var(--text-sm)' }}><MessageCircle size={14} /> WhatsApp</a>
                  {s.email && <a href={`mailto:${s.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Mail size={14} /> Email</a>}
                  <Link href={s.map} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)' }}><Navigation size={14} /> Directions</Link>
                </div>
                {/* auto top-margin pins the CTA to the card's base, so cards of differing address
                    lengths still line their buttons up. */}
                <button onClick={() => orderFrom(s)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 'auto', padding: '12px 22px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)' }}><ShoppingBag size={15} /> Order from this store</button>
              </div>
            </article>
          ))}
          {!list.length && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No stores match “{q}”. Try Bengaluru or Chennai.</p>}
        </div>
      </div>

      {/* Right — interactive map. Fixed, modest height and sticky, so it stays in view while the
          store list scrolls instead of stretching to the full height of every card. */}
      <div className="locations-map" style={{ flex: '2 1 340px', minWidth: 0, position: 'sticky', top: 96, height: 'clamp(340px,46vh,460px)' }}>
        <StoreMap />
      </div>
    </div>
  );
}
