'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation, ChevronLeft, Loader2, X } from 'lucide-react';
import { searchNearby, reverseGeocode, type PlaceSuggestion, type Place } from '@/lib/geocode';
import type { Address } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

/**
 * Adding an address, in the order that makes it correct.
 *
 * Location first, form second. That inversion is the whole design, and it is not cosmetic: it is
 * what makes a whole class of bug impossible rather than merely handled.
 *
 * The old form asked for a pincode and then tried to find a point that agreed with it, refereeing
 * between a typed street, a PIN centroid and whatever GPS had captured — three sources that can and
 * did disagree. An address typed as Jayanagar 560011 ended up pinned in Varthur, twelve kilometres
 * away, and every screen showed the correct text throughout while the rider would have been sent to
 * the coordinates. All the ranking and reconciliation logic that existed to referee that conflict
 * is gone, because here the pincode is READ OFF the confirmed pin. There is one source, so there is
 * nothing to reconcile.
 *
 * Three steps:
 *   search   — a place, by name. No form fields exist yet, so none can contradict anything.
 *   map      — the pin sits fixed at the centre and the map moves under it, which is both easier
 *              one-handed than dragging a small target and impossible to leave half-done.
 *   details  — pincode, city and state arrive filled in from that point. The customer types only
 *              what a map cannot know: the flat number, the landmark, who is receiving it.
 */

type Step = 'search' | 'map' | 'details';
export type AddressDraft = Omit<Address, 'id'>;

const teal = 'var(--brand-secondary)';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 'var(--radius-input)',
  border: '1.5px solid var(--border-default)', background: 'var(--surface-card)',
  fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 4px',
};

export default function AddressWizard({ initial, onSave, onCancel, saving, error }: {
  initial?: Address;
  onSave: (a: AddressDraft) => void;
  onCancel: () => void;
  saving?: boolean;
  error?: string;
}) {
  /* An address being edited already has a point, so it opens on the form with the map collapsed —
     the same place you land after confirming a new one. A new address has to earn its point first. */
  const [step, setStep] = useState<Step>(initial?.latitude != null ? 'details' : 'search');

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState('');

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initial?.latitude != null && initial?.longitude != null ? { lat: initial.latitude, lng: initial.longitude } : null,
  );
  const [place, setPlace] = useState<Place | null>(null);
  const [resolving, setResolving] = useState(false);

  /* A signed-in customer has already told us their name and number once. Making them type both
     again for every address is asking a question we know the answer to — and the answer we would
     get is worse, because a hurried retype is where a wrong digit enters a delivery phone number.
     Prefilled, not locked: an address can be for somebody else, which is what the Receiver's name
     field is for. Only ever seeds a new address; an existing one keeps whoever it was saved for. */
  const { user } = useAuth();
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? user?.name ?? '',
    phone: initial?.phone ?? (user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : ''),
    addressLine1: initial?.addressLine1 ?? '', addressLine2: initial?.addressLine2 ?? '',
    city: initial?.city ?? '', state: initial?.state ?? '', pincode: initial?.pincode ?? '',
    label: initial?.label ?? 'Home', isDefault: initial?.isDefault ?? false,
  });

  /* ---------------- search ---------------- */
  useEffect(() => {
    const term = q.trim();
    let live = true;
    if (term.length < 3) {
      // Deferred rather than set straight away: clearing state synchronously inside an effect
      // re-renders before the browser has painted the keystroke that caused it.
      const clear = setTimeout(() => { if (live) { setHits([]); setSearching(false); } }, 0);
      return () => { live = false; clearTimeout(clear); };
    }
    const t = setTimeout(async () => {
      if (!live) return;
      setSearching(true);
      const r = await searchNearby(term, {});
      if (!live) return;
      setHits(r); setSearching(false);
    }, 450);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const useGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setLocErr('Location is not available on this device.'); return; }
    setLocating(true); setLocErr('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setStep('map'); },
      (err) => {
        setLocating(false);
        setLocErr(err.code === 1 ? 'Location permission denied — allow it, or search for your area instead.'
          : err.code === 3 ? 'Location timed out — try again, or search for your area.'
            : 'Could not read your location — please search for your area.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  /* ---------------- the pin's address ---------------- */
  const lookup = useCallback(async (lat: number, lng: number) => {
    setResolving(true);
    const p = await reverseGeocode(lat, lng);
    setResolving(false);
    if (!p) return;
    setPlace(p);
    /* The point is the authority. Pincode, city and state are what it resolves to — never typed in
       and then argued with. Area is only ever a default: someone who names their own landmark knows
       better than the map does, so an existing value is left alone. */
    setForm(f => ({
      ...f,
      pincode: p.postcode || f.pincode,
      city: p.city || f.city,
      state: p.state || f.state,
      addressLine2: f.addressLine2 || p.street || p.area || '',
    }));
  }, []);

  useEffect(() => {
    if (step !== 'map' || !pin) return;
    // Same reason as the search debounce: hop out of the effect before touching state.
    const t = setTimeout(() => void lookup(pin.lat, pin.lng), 0);
    return () => clearTimeout(t);
  }, [step, pin, lookup]);

  const valid = !!(form.fullName.trim() && /^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').slice(-10))
    && form.addressLine1.trim() && form.city.trim() && /^[1-9]\d{5}$/.test(form.pincode.trim()) && pin);

  const back = () => {
    if (step === 'details') setStep(pin ? 'map' : 'search');
    else if (step === 'map') setStep('search');
    else onCancel();
  };

  return (
    <div style={{ borderRadius: 'var(--radius-card)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border-soft)' }}>
        <button onClick={back} aria-label="Back" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: teal, padding: 0 }}>
          <ChevronLeft size={20} />
        </button>
        <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>
          {step === 'map' ? 'Delivery location' : initial ? 'Edit delivery address' : 'Add delivery address'}
        </strong>
        <button onClick={onCancel} aria-label="Close" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'grid', placeItems: 'center', padding: 0 }}>
          <X size={18} />
        </button>
      </div>

      {step === 'search' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ font: 'var(--weight-extra) var(--text-base)/1.3 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>Address details</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              To add a new address, search for your area, landmark, street name or apartment.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={17} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for area, landmark, street"
              style={{ ...inputStyle, padding: '12px 38px 12px 38px', borderRadius: 'var(--radius-pill)' }} />
            {searching && <Loader2 size={16} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: teal, animation: 'spin 1s linear infinite' }} />}
          </div>

          {hits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {hits.map((h, i) => (
                <button key={`${h.latitude},${h.longitude},${i}`}
                  onClick={() => { setPin({ lat: h.latitude, lng: h.longitude }); setStep('map'); }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', padding: '12px 4px', border: 'none', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: 'transparent', cursor: 'pointer' }}>
                  <MapPin size={16} style={{ color: 'var(--text-muted)', flex: 'none', marginTop: 2 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{h.label}</span>
                    {h.detail && <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{h.detail}</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
                <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)' }}>OR</span>
                <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
              </div>
              <button onClick={useGps} disabled={locating}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', border: 'none', background: 'transparent', cursor: locating ? 'wait' : 'pointer', textAlign: 'left' }}>
                <Navigation size={20} style={{ color: teal, flex: 'none' }} />
                <span>
                  <span style={{ display: 'block', fontWeight: 800, fontSize: 'var(--text-base)', color: teal }}>{locating ? 'Locating…' : 'Use current location'}</span>
                  <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Using GPS</span>
                </span>
              </button>
              {locErr && <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700 }}>{locErr}</p>}
            </>
          )}
        </div>
      )}

      {step === 'map' && pin && (
        <PinMap
          lat={pin.lat} lng={pin.lng}
          onSettle={(lat, lng) => { setPin({ lat, lng }); void lookup(lat, lng); }}
          onUseGps={useGps}
          resolving={resolving}
          selected={place?.formatted || place?.street || null}
          onConfirm={() => setStep('details')}
        />
      )}

      {step === 'details' && (
        <div>
          {pin && (
            <div style={{ padding: '12px 14px', background: 'var(--amber-50)', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', gap: 9 }}>
                <MapPin size={16} style={{ color: teal, flex: 'none', marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-body)', lineHeight: 1.5 }}>
                    {place?.formatted || [place?.street, place?.city, form.pincode].filter(Boolean).join(', ') || 'Selected location'}
                  </p>
                  <button onClick={() => setStep('map')} style={{ marginTop: 4, padding: 0, border: 'none', background: 'transparent', color: teal, fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                    Edit location on Map
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ font: 'var(--weight-extra) var(--text-base)/1.3 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>Address details</h3>

            {/* Read off the pin, and editable — a map can be a street out on a new layout, and the
                customer is the one who knows. Editing these never moves the pin: the point is
                already confirmed, and it is the point we deliver to. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Pincode*</label>
                <input value={form.pincode} inputMode="numeric" maxLength={6}
                  onChange={(e) => setForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>City*</label>
                <input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>State*</label>
              <input value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} style={inputStyle} /></div>

            <div><label style={labelStyle}>Address*</label>
              <input value={form.addressLine1} placeholder="Flat / floor number, building name"
                onChange={(e) => setForm(f => ({ ...f, addressLine1: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Landmark / Area*</label>
              <input value={form.addressLine2} placeholder="Nearby locality, hospital, mall"
                onChange={(e) => setForm(f => ({ ...f, addressLine2: e.target.value }))} style={inputStyle} /></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Receiver&apos;s name*</label>
                <input value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Phone*</label>
                <input value={form.phone} inputMode="tel" placeholder="10-digit mobile"
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} /></div>
            </div>

            <div>
              <label style={labelStyle}>Save address as</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Home', 'Office', 'Other'] as const).map(l => (
                  <button key={l} onClick={() => setForm(f => ({ ...f, label: l }))}
                    style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-button)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)',
                      border: `1.5px solid ${form.label === l ? teal : 'var(--border-default)'}`,
                      background: form.label === l ? 'var(--amber-50)' : 'var(--surface-card)',
                      color: form.label === l ? teal : 'var(--text-body)' }}>{l}</button>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm(f => ({ ...f, isDefault: e.target.checked }))} /> Set as default address
            </label>

            {error && <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, lineHeight: 1.4 }}>{error}</p>}

            <button disabled={!valid || saving}
              onClick={() => pin && onSave({ ...form, latitude: pin.lat, longitude: pin.lng })}
              style={{ padding: '14px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: saving ? 'wait' : valid ? 'pointer' : 'not-allowed',
                background: valid && !saving ? 'var(--gradient-warm)' : 'var(--border-default)',
                color: valid && !saving ? 'var(--white)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 'var(--text-base)' }}>
              {saving ? 'Saving…' : 'Save address'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The map step: a pin painted at the centre of the frame, and the map moving beneath it.
 *
 * Not a draggable marker. Dragging a 30px target with a thumb is fiddly and easy to leave roughly
 * right, which is how a pin ends up on the wrong side of a road; moving the map is the gesture the
 * hand already knows, and the pin cannot be anywhere except where you are looking. It also means
 * there is no "did I move it?" state — the centre of the frame is always the answer.
 */
function PinMap({ lat, lng, onSettle, onUseGps, onConfirm, resolving, selected }: {
  lat: number; lng: number;
  onSettle: (lat: number, lng: number) => void;
  onUseGps: () => void;
  onConfirm: () => void;
  resolving: boolean;
  selected: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const settleRef = useRef(onSettle);
  useEffect(() => { settleRef.current = onSettle; }, [onSettle]);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { attributionControl: false, zoomControl: true }).setView([lat, lng], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    m.on('movestart', () => setMoving(true));
    m.on('moveend', () => {
      setMoving(false);
      const c = m.getCenter();
      settleRef.current(+c.lat.toFixed(6), +c.lng.toFixed(6));
    });
    map.current = m;
    setTimeout(() => m.invalidateSize(), 60);
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow a point chosen elsewhere (a search result, or GPS) without fighting a pan in progress.
  useEffect(() => {
    const m = map.current;
    if (!m || moving) return;
    const c = m.getCenter();
    if (Math.abs(c.lat - lat) < 1e-6 && Math.abs(c.lng - lng) < 1e-6) return;
    m.setView([lat, lng], Math.max(m.getZoom(), 17));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div ref={box} className="adc-map" style={{ width: '100%', height: 300, background: 'var(--surface-sunken)' }} />

        {/* The pin, and the callout above it. Both sit outside the map's own layers so they cannot
            be panned away from the centre — they are the frame, not content. */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 500 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateY(-14px)' }}>
            <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-button)', boxShadow: 'var(--shadow-md)', padding: '8px 14px', textAlign: 'center', marginBottom: 8, maxWidth: 260 }}>
              <div style={{ fontWeight: 900, fontSize: 'var(--text-xs)', color: 'var(--text-strong)' }}>Your order will be delivered here</div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 1 }}>Move the map to your exact location</div>
            </div>
            <div className="adc-pin" style={{ position: 'relative', width: 34, height: 44, transform: moving ? 'translateY(-6px)' : 'none', transition: 'transform .16s var(--ease-out)' }}>
              <div className="adc-pin__body"><div className="adc-pin__eye" /></div>
              <div className="adc-pin__ring" />
            </div>
          </div>
        </div>

        <button onClick={onUseGps} title="Use my current location"
          style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 600, width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--white)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: teal }}>
          <Navigation size={18} />
        </button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ ...labelStyle, margin: '0 0 3px' }}>Selected location</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <MapPin size={15} style={{ color: 'var(--text-muted)', flex: 'none', marginTop: 2 }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 1.45 }}>
              {resolving ? 'Finding this place…' : selected || 'Move the map to choose a spot'}
            </span>
          </div>
        </div>
        <button onClick={onConfirm} disabled={resolving}
          style={{ padding: '14px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: resolving ? 'wait' : 'pointer',
            background: resolving ? 'var(--border-default)' : 'var(--gradient-warm)', color: resolving ? 'var(--text-muted)' : 'var(--white)',
            fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 'var(--text-base)' }}>
          Confirm location
        </button>
      </div>
    </div>
  );
}
