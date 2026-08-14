'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Phone, Navigation, ShoppingBag, Search, MapPin, Mail } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/SocialIcons';
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
        {/* One toolbar rather than two stacked rows. The city buttons are now a real filter — they
            light up, they toggle off, and the count beside them is what confirms the filter did
            anything at all. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Postcode, town or city" aria-label="Search stores" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 42px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none' }} />
          </div>
          {CITIES.map((c) => {
            const on = q === c;
            return (
              <button key={c} onClick={() => setQ(on ? '' : c)} aria-pressed={on}
                style={{
                  flex: 'none', padding: '9px 15px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)',
                  border: `1.5px solid ${on ? 'transparent' : 'var(--border-default)'}`,
                  background: on ? 'var(--gradient-warm)' : 'var(--surface-card)',
                  color: on ? 'var(--white)' : 'var(--text-strong)',
                }}>{c}</button>
            );
          })}
          {q && <button onClick={() => setQ('')} style={{ flex: 'none', padding: '9px 12px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>Clear</button>}
          <span style={{ flex: 'none', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)' }}>
            {list.length} {list.length === 1 ? 'store' : 'stores'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(14px,1.6vw,18px)' }}>
          {list.map((s) => (
            <article key={s.name} id={`store-${s.pincode}`} className="store-card" style={{ scrollMarginTop: 120, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'stretch', minHeight: 'clamp(184px,17vw,224px)' }}>
              {/* The illustrations are tall portraits with the store name and address printed across
                  their upper half, so this column stays portrait-ish and anchors to the top. It now
                  stretches to the card instead of forcing a 2:3 box: at 208px wide that box was
                  312px tall, and since it was the tallest thing in the card it set the card's
                  height — which is where the band of nothing under the contact links came from. */}
              {s.image ? (
                <div className="store-card-img" style={{ position: 'relative', flex: 'none', alignSelf: 'stretch', width: 'clamp(124px,15vw,166px)', background: 'var(--surface-sunken)' }}>
                  <Image src={s.image} alt={s.name} fill sizes="(max-width:680px) 100vw, 166px" style={{ objectFit: 'cover', objectPosition: 'top' }} />
                </div>
              ) : (
                <div className="store-card-img" style={{ flex: 'none', alignSelf: 'stretch', width: 'clamp(124px,15vw,166px)', background: 'radial-gradient(120% 120% at 35% 28%,var(--amber-300),var(--orange-500))', display: 'grid', placeItems: 'center' }}>
                  <MapPin size={34} color="var(--white)" />
                </div>
              )}
              <div className="store-card-body" style={{ flex: 1, minWidth: 0, padding: 'clamp(15px,1.8vw,22px)', display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, color: 'var(--brand-secondary)', textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 5px' }}>{s.city}</p>
                <h3 style={{ font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{s.name}</h3>
                <p style={{ color: 'var(--text-body)', lineHeight: 1.55, margin: '0 0 12px', fontSize: 'var(--text-sm)' }}>{s.address}</p>
                {/* Contacts and the button now share the base of the card. They used to be stacked
                    with an auto margin between them, which is what the empty band was made of. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <a href={`tel:${s.phone.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Phone size={14} /> {s.phone}</a>
                    <a href={whatsappLink(`Hi! I'd like to ask about the ${s.name} store.`)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--whatsapp-green)', fontWeight: 800, fontSize: 'var(--text-sm)' }}><WhatsAppIcon size={15} /> WhatsApp</a>
                    {s.email && <a href={`mailto:${s.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700, fontSize: 'var(--text-sm)' }}><Mail size={14} /> Email</a>}
                    <Link href={s.map} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--brand-secondary)', fontWeight: 800, fontSize: 'var(--text-sm)' }}><Navigation size={14} /> Directions</Link>
                  </div>
                  <button onClick={() => orderFrom(s)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 'none', padding: '11px 20px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)' }}><ShoppingBag size={15} /> Order from this store</button>
                </div>
              </div>
            </article>
          ))}
          {!list.length && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No stores match “{q}”. Try Bengaluru or Chennai.</p>}
        </div>
      </div>

      {/* Right — the map, sticky so it stays with you down the list. Tall enough to hold its own
          beside the cards: at ~460px it was a small tile at the top of a mostly empty column, which
          is what made the two sides read as unrelated rather than as one layout. */}
      <div className="locations-map" style={{ flex: '2 1 340px', minWidth: 0, position: 'sticky', top: 96, height: 'min(calc(100vh - 132px), 660px)' }}>
        <StoreMap />
      </div>
    </div>
  );
}
