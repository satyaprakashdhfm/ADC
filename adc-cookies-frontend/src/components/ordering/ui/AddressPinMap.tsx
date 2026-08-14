'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * A draggable pin on the address form.
 *
 * Geocoding an Indian street address is a coin flip — blocks, cross roads and main roads are often
 * simply not in the map data — so the honest thing is to show the customer where we think they are
 * and let them correct it. Everything else here (which store bakes it, what the delivery costs,
 * where the rider actually goes) is decided from this one point, and it is the only part of the
 * address the customer cannot otherwise see.
 *
 * Leaflet directly rather than react-leaflet: this is one marker and one drag handler, and the
 * project already carries Leaflet for the store maps.
 */
export default function AddressPinMap({
  lat, lng, onMove, hint,
}: {
  lat: number; lng: number;
  onMove: (lat: number, lng: number) => void;
  hint?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  // Kept in a ref so the drag handler never closes over a stale prop.
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { attributionControl: false, zoomControl: true }).setView([lat, lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);

    const icon = L.divIcon({
      className: '',
      html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--orange-cta,#F07C1E);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    });
    const mk = L.marker([lat, lng], { draggable: true, icon }).addTo(m);
    mk.on('dragend', () => {
      const p = mk.getLatLng();
      onMoveRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
    });
    // Tapping the map is the same gesture on a phone, where dragging a small pin is fiddly.
    m.on('click', (e: L.LeafletMouseEvent) => {
      mk.setLatLng(e.latlng);
      onMoveRef.current(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
    });

    map.current = m;
    marker.current = mk;
    // The container is created inside a form that may still be animating open; Leaflet measures
    // itself on creation and would otherwise render a quarter of a map.
    setTimeout(() => m.invalidateSize(), 60);
    return () => { m.remove(); map.current = null; marker.current = null; };
  }, [lat, lng]);

  // Follow the resolved point when geocoding produces a new one, but never fight a drag in progress.
  useEffect(() => {
    if (!map.current || !marker.current) return;
    const cur = marker.current.getLatLng();
    if (Math.abs(cur.lat - lat) < 1e-6 && Math.abs(cur.lng - lng) < 1e-6) return;
    marker.current.setLatLng([lat, lng]);
    map.current.setView([lat, lng], map.current.getZoom());
  }, [lat, lng]);

  return (
    <div>
      <div ref={box} style={{ width: '100%', height: 190, borderRadius: 'var(--radius-button)', overflow: 'hidden', border: '1.5px solid var(--border-default)', background: 'var(--surface-sunken)' }} />
      <p style={{ margin: '6px 2px 0', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {hint || 'Drag the pin to your exact door — this is where the rider is sent.'}
      </p>
    </div>
  );
}
