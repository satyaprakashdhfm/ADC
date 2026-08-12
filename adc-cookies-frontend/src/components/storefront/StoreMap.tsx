'use client';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STORES } from '@/lib/stores';
import { COMPANY_NAME, HEAD_OFFICE } from '@/lib/site';

// Brand-orange teardrop pin as an inline SVG (avoids Leaflet's default-icon bundler issues).
// NOTE: this SVG is serialised to a string and handed to Leaflet as a map-marker icon,
// so it renders OUTSIDE the document's CSS cascade — CSS var() would not resolve here.
// These two hex values are therefore the one unavoidable exception; they mirror the
// theme tokens --orange-500 (#EF7507) and --white (#fff). Keep them in sync if those change.
const PIN_SVG =
  '<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.37 18.63 0 12 0z" fill="#EF7507"/>' +
  '<circle cx="12" cy="12" r="4.6" fill="#fff"/></svg>';

// The head office is not a shop, so it gets a different pin — a hollow ring in the same brand
// orange. Someone scanning a map of places to buy cookies must not walk to an office.
const OFFICE_SVG =
  '<svg width="26" height="34" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.37 18.63 0 12 0z" fill="#fff" stroke="#EF7507" stroke-width="2.4"/>' +
  '<circle cx="12" cy="12" r="3.6" fill="#EF7507"/></svg>';

/**
 * Interactive OpenStreetMap of every ADC store, with a pin per outlet. Free — no API key.
 *
 * `withHeadOffice` adds the registered office as a distinctly-marked extra pin. Off by default, so
 * the store finder stays a list of places you can actually buy a cookie; on for the homepage's
 * "our stores" panel, which is showing the whole footprint rather than answering "where do I go".
 */
export default function StoreMap({ withHeadOffice = false }: { withHeadOffice?: boolean } = {}) {
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
      if (withHeadOffice) {
        const officeIcon = L.divIcon({ className: 'adc-pin', html: OFFICE_SVG, iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -30] });
        markers.push(
          L.marker([HEAD_OFFICE.lat, HEAD_OFFICE.lng], { icon: officeIcon })
            .addTo(m)
            .bindPopup(`<strong>${COMPANY_NAME} — head office</strong><br/>${HEAD_OFFICE.address}`)
        );
      }
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
  }, [withHeadOffice]);

  // No minHeight: the caller sizes the map (the locations page gives it a fixed, sticky height;
  // the contact page a smaller aside). A minHeight here would override both.
  return <div ref={el} style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--border-default)', zIndex: 0 }} />;
}
