'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MapPin, Navigation, ChevronDown, X, Check, Home, Briefcase, Store as StoreIcon } from 'lucide-react';
import { useLocation, nearestStore, storeArea } from '@/context/LocationContext';
import { STORES } from '@/lib/stores';
import { reverseGeocode } from '@/lib/geocode';
import { useAuth } from '@/context/AuthContext';
import { getAddresses, type Address } from '@/lib/api';

const ASKED_KEY = 'adc_location_asked';

/* ---- Modal: where are we delivering? The shopper's OWN addresses, not our shop list — "deliver
   to" is their doorstep. Which store bakes it is ours to work out (the backend picks the nearest
   serviceable one at checkout), so the shop list moved behind a "Find a store" link. ---- */
function LocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { store, detect, detecting, error, chooseStore, setArea } = useLocation();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  // What we found, shown for confirmation instead of closing silently — people need to see WHERE we
  // think they are (and which kitchen that means) before they trust a same-day promise.
  const [found, setFound] = useState<{ area: string; storeName: string } | null>(null);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setMounted(true), []);

  // Saved addresses are the primary choice for a signed-in shopper. (Rendering is guarded on
  // `user` too, so a signed-out visitor never sees a stale list from a previous session.)
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    getAddresses().then(a => { if (!cancelled) setAddresses(a || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, user]);

  // Escape closes it, and the page behind is locked from scrolling while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  /* Detect, then SHOW what we found rather than closing on the spot. We reverse-geocode for a human
     area name ("Lakdikapul, Hyderabad") because a store name alone doesn't tell anyone whether we
     got their location right. */
  const onDetect = async () => {
    setPinErr('');
    const s = await detect();
    if (!s) return;                       // context surfaces the permission/timeout error itself
    let areaName = '';
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }));
      // Through our own geo route like everything else — this is only for naming the area back to
      // the customer, and it never becomes a delivery coordinate (see the note on this component).
      const p = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      areaName = [p?.area || p?.street, p?.city].filter(Boolean).join(', ');
    } catch { /* the store name alone still tells them something */ }
    setArea(areaName);
    setFound({ area: areaName || 'your current location', storeName: storeArea(s) });
  };

  /* A pincode is the fallback for anyone who won't share GPS. We only match it to one of our own
     store zones for display; anything else is still orderable — the backend decides serviceability
     and picks the dispatching store at checkout. */
  const onPin = () => {
    const p = pin.replace(/\D/g, '');
    if (p.length !== 6) { setPinErr('Enter a 6-digit PIN code.'); return; }
    setBusy(true); setPinErr('');
    const zone = STORES.find(s => String(s.pincode).slice(0, 3) === p.slice(0, 3));
    if (zone) chooseStore(zone);
    setArea(`PIN ${p}`);
    setFound({ area: `PIN ${p}`, storeName: zone ? storeArea(zone) : 'nearest' });
    setBusy(false);
  };

  /* Picking a saved address sets where we're delivering. We resolve its nearest store here only so
     the header has something to show; the authoritative pick happens backend-side at checkout. */
  const chooseAddress = (a: Address) => {
    if (a.latitude != null && a.longitude != null) chooseStore(nearestStore(a.latitude, a.longitude));
    setArea([a.addressLine2 || a.addressLine1, a.city].filter(Boolean).join(', '));
    onClose();
  };

  /* Portalled to <body>. The pill that opens this lives inside the sticky header, which carries a
     `transform` for its show/hide animation — and a transformed ancestor becomes the containing
     block for position:fixed descendants. Rendered in place, the overlay was therefore sized and
     stacked against the HEADER (clipped to it, stuck at its z-index) instead of the viewport. */
  return createPortal(
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Choose your location"
      style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'var(--espresso-50)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="hide-sb" style={{ position: 'relative', width: 'min(440px,94vw)', maxHeight: 'min(76svh, 640px)', overflowY: 'auto', margin: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '22px 22px 24px', animation: 'riseIn .3s var(--ease-spring) both' }}>
        {/* Close sits in the card's own top-right corner, out of the heading's flow */}
        <button onClick={onClose} aria-label="Close"
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={17} /></button>

        <div style={{ marginBottom: 6, paddingRight: 42 }}>
          <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>Where are we delivering?</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>We bake fresh at the nearest store and bring it to you.</p>
        </div>

        {/* Confirmation of what we found — the modal stays open until they say it's right. */}
        {found ? (
          <div style={{ margin: '16px 0 6px', padding: '14px 16px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--brand-secondary)', background: 'var(--amber-50)' }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <Check size={17} color="var(--brand-secondary)" style={{ flex: 'none', marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Delivering to</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1.3 }}>{found.area}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 3 }}>Baked at our <b>{found.storeName}</b> kitchen</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Looks right</button>
              <button onClick={() => setFound(null)} style={{ padding: '11px 14px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Change</button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={onDetect} disabled={detecting}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '16px 0 6px', padding: '13px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--brand-secondary)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: detecting ? 'wait' : 'pointer' }}>
              <Navigation size={17} /> {detecting ? 'Detecting your location…' : 'Use my current location'}
            </button>
            {error && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', margin: '4px 2px 0' }}>{error}</p>}

            {/* Manual PIN — for anyone who won't (or can't) share GPS. */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => { if (e.key === 'Enter') onPin(); }}
                placeholder="Or enter your PIN code" inputMode="numeric" maxLength={6} aria-label="Delivery PIN code"
                style={{ flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }} />
              <button onClick={onPin} disabled={busy} style={{ padding: '12px 16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Set</button>
            </div>
            {pinErr && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', margin: '6px 2px 0' }}>{pinErr}</p>}
          </>
        )}

        {/* The shopper's own saved addresses — what "deliver to" actually means. */}
        {!!user && addresses.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>or your saved addresses</span>
              <span style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {addresses.map(a => {
                const near = a.latitude != null && a.longitude != null ? nearestStore(a.latitude, a.longitude) : null;
                const on = !!near && store?.pincode === near.pincode;
                const Icon = a.label === 'Office' ? Briefcase : a.label === 'Other' ? MapPin : Home;
                return (
                  <button key={a.id} onClick={() => chooseAddress(a)}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-button)', border: `1.5px solid ${on ? 'var(--brand-secondary)' : 'var(--border-default)'}`, background: on ? 'var(--amber-50)' : 'var(--surface-card)', cursor: 'pointer' }}>
                    <Icon size={16} color="var(--brand-secondary)" style={{ flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', lineHeight: 1.25 }}>{a.label || 'Home'}</span>
                      <span style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[a.addressLine1, a.addressLine2, a.city, a.pincode].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    {on && <Check size={16} color="var(--brand-secondary)" style={{ flex: 'none' }} />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Our shops are a separate idea from "deliver to" — link out rather than list them here. */}
        <Link href="/locations" onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: '11px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-strong)', textDecoration: 'none', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>
          <StoreIcon size={16} /> Find a store near you
        </Link>
      </div>
    </div>,
    document.body,
  );
}

/* ---- Pill: the header "Deliver to …" control.
   `compact` = tiny inline pin-link (mobile navbar) · `block` = full-width row · default = desktop pill. ---- */
export function LocationPill({ block = false, compact = false, iconOnly = false }: { block?: boolean; compact?: boolean; iconOnly?: boolean }) {
  const { store, label: storeLabelText, area } = useLocation();
  const [open, setOpen] = useState(false);
  // Prefer the CUSTOMER's area — "Deliver to" is about where they are, not which branch bakes it.
  const label = area || storeLabelText;

  // Tiny map-pin button for the mobile header top row — no text, just the pin (green dot once a
  // location is set); tapping it opens the same picker popup, so the header stays short.
  if (iconOnly) {
    return (
      <>
        <button onClick={() => setOpen(true)} className="nav-round-btn" title={label || 'Set location'} aria-label={label ? `Delivering to ${label}. Change location` : 'Set delivery location'}
          style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <MapPin size={19} />
          {store && <span aria-hidden style={{ position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#3ad06a', border: '2px solid var(--navbar-bg)' }} />}
        </button>
        <LocationModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (compact) {
    return (
      <>
        <button onClick={() => setOpen(true)} aria-label="Choose delivery location"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1, padding: '6px 2px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--white)' }}>
          <MapPin size={16} color="var(--white)" style={{ flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', color: 'var(--white)' }}>{label || 'Set location'}</span>
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
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{label || 'Select your nearest store'}</span>
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, lineHeight: 1.15 }}>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700 }}>{label ? 'Deliver to' : 'Location'}</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{label || 'Select location'}</span>
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
