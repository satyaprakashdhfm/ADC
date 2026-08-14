'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { searchNearby, streetAt, type PlaceSuggestion } from '@/lib/geocode';

/**
 * Where the rider is actually sent — searchable, and draggable.
 *
 * Geocoding an Indian street address is a coin flip: blocks, cross roads and main roads are
 * frequently absent from the map data, so "9th Main Rd, 2nd Block" finds nothing far more often
 * than it finds the right thing. Landmarks are the opposite — apartment complexes, tech parks,
 * hospitals and temples are exactly what OSM has, and they are also how people describe where they
 * live. So the search box asks for a landmark rather than an address, scoped to the pincode already
 * typed, and the map is there to confirm or correct whatever comes back.
 *
 * Everything downstream reads this one point: which store bakes the order, what delivery costs, and
 * the coordinates the carrier navigates to. It used to be the only part of an address the customer
 * could neither see nor fix.
 *
 * Leaflet directly rather than react-leaflet — one marker and one drag handler, and the project
 * already carries Leaflet for the store maps.
 */
export default function AddressPinMap({
  lat, lng, onMove, onStreet, hint, pincode, city,
}: {
  lat: number; lng: number;
  onMove: (lat: number, lng: number) => void;
  /** The street the pin now sits on. Flows back into the Area field, so moving the map fills the
   *  address in rather than only consuming it. */
  onStreet?: (street: string) => void;
  hint?: string;
  pincode?: string;
  city?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  // Kept in a ref so the drag handler never closes over a stale prop.
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [dragged, setDragged] = useState(false);
  const [here, setHere] = useState('');           // the street under the pin, as Nominatim reads it

  const onStreetRef = useRef(onStreet);
  onStreetRef.current = onStreet;

  /* Whatever the pin lands on, name it. A point on a map means nothing to somebody checking their
     own address — the street name is how they tell whether we got it right, and it saves them
     typing the Area field themselves. */
  const nameThePoint = useRef(async (la: number, ln: number) => {
    const r = await streetAt(la, ln);
    if (!r.street) return;
    setHere(r.street);
    onStreetRef.current?.(r.street);
  });

  /* Debounced, because Nominatim asks for no more than one call a second and a keystroke-per-call
     search would be both rude and rate-limited into uselessness. */
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setHits([]); setSearching(false); return; }
    setSearching(true);
    let live = true;
    const t = setTimeout(async () => {
      const r = await searchNearby(term, { pincode, city });
      if (!live) return;
      setHits(r);
      setSearching(false);
    }, 600);
    return () => { live = false; clearTimeout(t); };
  }, [q, pincode, city]);

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { attributionControl: false, zoomControl: true }).setView([lat, lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);

    /* The pin has to look like something you can pick up. A flat dot reads as a label, and people
       leave it where it lands — which is the whole failure this component exists to prevent. Hence
       the lift, the shadow it casts on the map, and the grab cursor. */
    const icon = L.divIcon({
      className: 'adc-pin',
      // Styling lives in globals.css so hover and drag states can be expressed as CSS rather than
      // rebuilt as inline strings on every render.
      html: `
        <div style="position:relative;width:34px;height:44px">
          <div class="adc-pin__body"><div class="adc-pin__eye"></div></div>
          <div class="adc-pin__ring"></div>
        </div>`,
      iconSize: [34, 44],
      iconAnchor: [17, 42],
    });
    const mk = L.marker([lat, lng], { draggable: true, icon, autoPan: true }).addTo(m);
    mk.on('dragstart', () => setDragged(true));
    mk.on('dragend', () => {
      const p = mk.getLatLng();
      onMoveRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
      void nameThePoint.current(p.lat, p.lng);
    });
    // Tapping is the same gesture on a phone, where dragging a small pin is fiddly.
    m.on('click', (e: L.LeafletMouseEvent) => {
      mk.setLatLng(e.latlng);
      setDragged(true);
      onMoveRef.current(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
      void nameThePoint.current(e.latlng.lat, e.latlng.lng);
    });

    map.current = m;
    marker.current = mk;
    // The container is created inside a form that may still be animating open; Leaflet measures
    // itself on creation and would otherwise render a quarter of a map.
    setTimeout(() => m.invalidateSize(), 60);
    return () => { m.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the resolved point when something upstream produces a better one.
  useEffect(() => {
    if (!map.current || !marker.current) return;
    const cur = marker.current.getLatLng();
    if (Math.abs(cur.lat - lat) < 1e-6 && Math.abs(cur.lng - lng) < 1e-6) return;
    marker.current.setLatLng([lat, lng]);
    map.current.setView([lat, lng], Math.max(map.current.getZoom(), 16));
  }, [lat, lng]);

  const pick = (s: PlaceSuggestion) => {
    setQ(s.label);
    setHits([]);
    setDragged(true);
    setHere(s.street || s.label);
    onMoveRef.current(s.latitude, s.longitude);
    if (s.street) onStreetRef.current?.(s.street);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={pincode ? `Search a street or area in ${pincode}` : 'Search a street or area'}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 34px 10px 34px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--white)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }}
        />
        {searching && <Loader2 size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-secondary)', animation: 'spin 1s linear infinite' }} />}
        {hits.length > 0 && (
          <div style={{ position: 'absolute', zIndex: 500, top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--white)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-button)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', maxHeight: 190, overflowY: 'auto' }}>
            {hits.map((h, i) => (
              <button key={`${h.latitude},${h.longitude},${i}`} onClick={() => pick(h)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-body)', lineHeight: 1.4 }}>
                <MapPin size={13} style={{ color: 'var(--brand-secondary)', flex: 'none', marginTop: 1 }} /> {h.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={box} className="adc-map" style={{ width: '100%', height: 220, borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1.5px solid var(--border-strong)', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sm)' }} />

      <p style={{ margin: 0, fontSize: 'var(--text-2xs)', lineHeight: 1.5, fontWeight: 700, color: dragged ? 'var(--status-success)' : 'var(--brand-secondary)' }}>
        {here
          ? `${dragged ? '✓ ' : ''}Pin is on ${here} — this is where your cookies are delivered.`
          : dragged
            ? '✓ Pin placed — this exact spot is where your cookies are delivered.'
            : 'Drag the pin onto your street. The rider is sent to the pin, not the typed address.'}
      </p>
      {hint && <p style={{ margin: 0, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.45 }}>{hint}</p>}
    </div>
  );
}
