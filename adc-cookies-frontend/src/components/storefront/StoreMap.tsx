'use client';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STORES } from '@/lib/stores';

// Brand-orange teardrop pin as an inline SVG (avoids Leaflet's default-icon bundler issues).
const PIN_SVG =
  '<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.37 18.63 0 12 0z" fill="#EF7507"/>' +
  '<circle cx="12" cy="12" r="4.6" fill="#fff"/></svg>';

/** Interactive OpenStreetMap of every ADC store, with a pin per outlet. Free — no API key. */
export default function StoreMap() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;

      const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: true });
      map.current = m;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(m);

      const icon = L.divIcon({ className: 'adc-pin', html: PIN_SVG, iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -36] });
      const markers = STORES.map((s) =>
        L.marker([s.lat, s.lng], { icon })
          .addTo(m)
          .bindPopup(`<strong>${s.name}</strong><br/>${s.address}`)
      );
      if (markers.length) {
        const group = L.featureGroup(markers);
        m.fitBounds(group.getBounds().pad(0.35));
      }
      // Re-measure after layout settles (avoids grey tiles when mounted in a flex/grid).
      setTimeout(() => m.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, []);

  return <div ref={el} style={{ width: '100%', height: '100%', minHeight: 420, borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--border-default)', zIndex: 0 }} />;
}
