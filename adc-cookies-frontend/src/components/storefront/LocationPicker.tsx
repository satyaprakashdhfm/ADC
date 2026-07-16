'use client';
import { useState, useEffect } from 'react';
import { MapPin, Navigation, ChevronDown, X, Check } from 'lucide-react';
import { STORES } from '@/lib/stores';
import { useLocation, storeArea } from '@/context/LocationContext';

const ASKED_KEY = 'adc_location_asked';

/* ---- Modal: detect location or pick a store ---- */
function LocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { store, detect, detecting, error, chooseStore } = useLocation();
  if (!open) return null;
  const cities = [...new Set(STORES.map(s => s.city))];
  const onDetect = async () => { const s = await detect(); if (s) onClose(); };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'var(--espresso-50)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="hide-sb" style={{ width: 'min(440px,94vw)', maxHeight: '82vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '22px 22px 24px', animation: 'riseIn .3s var(--ease-spring) both' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>Choose your location</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>We bake &amp; deliver fresh from your nearest A Dough Cookie store.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><X size={17} /></button>
        </div>

        <button onClick={onDetect} disabled={detecting}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '16px 0 6px', padding: '13px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--brand-secondary)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: detecting ? 'wait' : 'pointer' }}>
          <Navigation size={17} /> {detecting ? 'Detecting your location…' : 'Use my current location'}
        </button>
        {error && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', margin: '4px 2px 0' }}>{error}</p>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>or pick a store</span>
          <span style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
        </div>

        {cities.map(city => (
          <div key={city} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--brand-secondary)', fontWeight: 800, margin: '0 2px 8px' }}>{city}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STORES.filter(s => s.city === city).map(s => {
                const on = store?.pincode === s.pincode;
                return (
                  <button key={s.pincode} onClick={() => { chooseStore(s); onClose(); }}
                    style={{ display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', padding: '11px 13px', borderRadius: 'var(--radius-card)', border: `1.5px solid ${on ? 'var(--brand-secondary)' : 'var(--border-default)'}`, background: on ? 'var(--amber-50)' : 'var(--surface-card)', cursor: 'pointer' }}>
                    <MapPin size={18} color="var(--brand-secondary)" style={{ flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{storeArea(s)}</span>
                      <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</span>
                    </span>
                    {on && <Check size={18} color="var(--brand-secondary)" style={{ flex: 'none' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Pill: the header "Deliver to …" control.
   `compact` = tiny inline pin-link (mobile navbar) · `block` = full-width row · default = desktop pill. ---- */
export function LocationPill({ block = false, compact = false }: { block?: boolean; compact?: boolean }) {
  const { store, label } = useLocation();
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <>
        <button onClick={() => setOpen(true)} aria-label="Choose delivery location"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1, padding: '6px 2px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--white)' }}>
          <MapPin size={16} color="var(--white)" style={{ flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', color: 'var(--white)' }}>{store ? label : 'Set location'}</span>
          <ChevronDown size={14} color="var(--white)" style={{ flex: 'none' }} />
        </button>
        <LocationModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Choose delivery location"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: block ? '8px 13px' : '5px 12px',
          borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)',
          background: 'var(--surface-card)', cursor: 'pointer',
          width: block ? '100%' : undefined, flex: block ? undefined : 'none', maxWidth: block ? undefined : 210,
        }}>
        <MapPin size={17} color="var(--brand-secondary)" style={{ flex: 'none' }} />
        {block ? (
          // Mobile: single tidy line — just the pin + place name.
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{store ? label : 'Select your nearest store'}</span>
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, lineHeight: 1.15 }}>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700 }}>{store ? 'Deliver to' : 'Location'}</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{store ? label : 'Select location'}</span>
          </span>
        )}
        <ChevronDown size={15} color="var(--text-muted)" style={{ flex: 'none' }} />
      </button>
      <LocationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ---- Gate: on the very first visit, ask for the delivery location once ---- */
export function LocationGate() {
  const { store, ready } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let asked = false;
    try { asked = !!localStorage.getItem(ASKED_KEY); } catch { /* ignore */ }
    if (asked) return;
    try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* ignore */ }
    if (store) return; // returning visitor already has a store
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [ready, store]);
  return <LocationModal open={open} onClose={() => setOpen(false)} />;
}

/* ---- Banner: shown on the order page when no location is set yet ---- */
export function LocationBanner() {
  const { store } = useLocation();
  const [open, setOpen] = useState(false);
  if (store) return null;
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '13px 16px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--border-brand)', background: 'var(--amber-50)', cursor: 'pointer', marginBottom: 16 }}>
        <MapPin size={20} color="var(--brand-secondary)" style={{ flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 700, lineHeight: 1.4 }}>
          <strong style={{ fontWeight: 800 }}>Set your location</strong> to order from your nearest store
        </span>
        <ChevronDown size={16} color="var(--brand-secondary)" style={{ flex: 'none', transform: 'rotate(-90deg)' }} />
      </button>
      <LocationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
