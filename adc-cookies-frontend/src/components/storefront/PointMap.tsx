'use client';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Same brand teardrop as StoreMap. Leaflet serialises this to a string and renders it outside the
// document's CSS cascade, so var() cannot resolve here — these two hex values mirror the theme
// tokens --orange-500 (#EF7507) and --white (#fff), and must be kept in sync by hand.
const PIN_SVG =
  '<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.37 18.63 0 12 0z" fill="#EF7507"/>' +
  '<circle cx="12" cy="12" r="4.6" fill="#fff"/></svg>';

/**
 * A map of one place, zoomed to it. Free OpenStreetMap tiles — no API key.
 *
 * Separate from StoreMap, which exists to show every shop at once and frames itself to their
 * bounds. Handed a single point that logic degenerates into a fitBounds around nothing, and the
 * zoom level a lone marker needs is a decision, not a fallback.
 *
 * The popup carries a link out to the place on Google Maps. The coordinates here are geocoded from
 * the street address rather than surveyed, so the pin lands on the right road but may be a few
 * doors out — the link is the authoritative answer, and it should always be one tap away.
 */
export default function PointMap({ lat, lng, label, address, mapUrl, zoom = 16 }: {
  lat: number;
  lng: number;
  label: string;
  address: string;
  mapUrl?: string;
  zoom?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;

      const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView([lat, lng], zoom);
      map.current = m;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(m);

      const icon = L.divIcon({ className: 'adc-pin', html: PIN_SVG, iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -36] });
      const link = mapUrl
        ? `<br/><a href="${mapUrl}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
        : '';
      L.marker([lat, lng], { icon }).addTo(m).bindPopup(`<strong>${label}</strong><br/>${address}${link}`).openPopup();

      // Re-measure once layout settles, or the tiles come up grey inside a flex/grid parent.
      setTimeout(() => m.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, [lat, lng, label, address, mapUrl, zoom]);

  // The caller sizes it — a minHeight here would fight every layout it is dropped into.
  return <div ref={el} style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--border-default)', zIndex: 0 }} />;
}
