'use client';
import { useState, useEffect } from 'react';
import { resolveAddressPoint, type PointSource } from '@/lib/geocode';
import { getAddresses, addAddress, updateAddress, type Address } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { matchState } from '@/lib/indiaAddress';

/**
 * The saved-address list and the add/edit form behind it, including GPS detection and the
 * forward-geocode that runs on save.
 *
 * Coordinates matter more than they look: the carriers return zero couriers for an address with no
 * lat/long, so a manually-typed address without them silently drops to multi-day shipping. Hence
 * the typed address is always re-geocoded on save, with any GPS-detected pair as the fallback.
 */
export function useCheckoutAddresses() {
  const { addrId: addr, setAddrId: setAddr } = useCart();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);
  const [aform, setAform] = useState<{ fullName: string; phone: string; addressLine1: string; addressLine2: string; city: string; state: string; pincode: string; label: string; latitude: number | null; longitude: number | null }>({ fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', label: 'Home', latitude: null, longitude: null });
  const [editId, setEditId] = useState<number | null>(null);   // address being edited (null = adding new)
  const [makeDefault, setMakeDefault] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectErr, setDetectErr] = useState('');
  const [savingAddr, setSavingAddr] = useState(false);

  // Addresses are private to the signed-in user — fetch on login, clear on logout.
  useEffect(() => {
    if (user) getAddresses().then(setAddresses).catch(() => setAddresses([]));
    else setAddresses([]);
  }, [user]);

  // Auto-select an address once they load and nothing valid is selected:
  // prefer the default, else fall back to the first address (so users without a
  // default still get a valid address — otherwise the order 400s with "Address not found").
  useEffect(() => {
    if (addr && addresses.some(a => a.id === addr)) return;
    const pick = addresses.find(a => a.isDefault) || addresses[0];
    if (pick) setAddr(pick.id);
  }, [addresses, addr, setAddr]);

  /*
   * A PIN code determines its city and state, so once six digits are in, fill them rather than
   * making someone type what we already know — and pick the state off a canonical list, which is
   * where hand-typed addresses usually go wrong.
   *
   * India Post's own directory rather than the Nominatim geocoder used elsewhere in this file:
   * Nominatim is queried by postalcode here too, but its Indian PIN coverage is patchy and it
   * regularly returns nothing for a perfectly valid code. This endpoint is the authority for
   * exactly this lookup.
   *
   * Never blocks and never reports an error: the fields stay editable, so a failed lookup just
   * means typing them by hand, which is what happened before this existed. The PIN is the
   * authority, so a NEW pin overwrites what is there — someone correcting the pin expects the
   * city to follow, and they can still edit afterwards.
   */
  const [pinFilled, setPinFilled] = useState('');   // the pin we last auto-filled from, so it runs once per pin
  useEffect(() => {
    const pin = aform.pincode.trim();
    if (!/^\d{6}$/.test(pin) || pin === pinFilled) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    (async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: ctrl.signal });
        const body = await res.json();
        const po = Array.isArray(body) && body[0]?.Status === 'Success' ? body[0]?.PostOffice?.[0] : null;
        if (!po || cancelled) return;
        const city = String(po.District || po.Block || '').trim();
        const state = matchState(String(po.State || '')) || '';
        if (!city && !state) return;
        setPinFilled(pin);
        setAform(f => (f.pincode.trim() === pin
          ? { ...f, city: city || f.city, state: state || f.state }
          : f));   // they kept typing and the pin moved on — leave it alone
      } catch { /* offline, blocked, or unknown pin — the fields are still editable */ }
      finally { clearTimeout(timer); }
    })();
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer); };
  }, [aform.pincode, pinFilled]);

  const EMPTY_AFORM = { fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', label: 'Home', latitude: null, longitude: null };
  // New address starts pre-filled with the signed-in user's name & phone (they can edit it, e.g. gifting to someone else).
  const prefillAform = () => ({ ...EMPTY_AFORM, fullName: user?.name || '', phone: user?.phone || '' });
  const closeAddrForm = () => { setAdding(false); setEditId(null); setMakeDefault(false); setDetectErr(''); setAform(EMPTY_AFORM); };

  // Opening the "add address" form kicks off location detection by default, so the fields + GPS
  // coordinates prefill without an extra tap. The customer can still correct anything they like —
  // and whatever address they end up with is re-geocoded on save, so the coordinates follow the
  // address they actually typed rather than wherever they happened to be standing.
  const openAddForm = () => {
    setEditId(null); setMakeDefault(false); setAform(prefillAform()); setDetectErr(''); setAdding(true);
    detectLocation();
  };

  // Open the form pre-filled to edit an existing saved address.
  const editAddr = (a: Address) => {
    setAform({ fullName: a.fullName, phone: a.phone || '', addressLine1: a.addressLine1, addressLine2: a.addressLine2 || '', city: a.city, state: a.state || '', pincode: a.pincode, label: a.label || 'Home', latitude: a.latitude ?? null, longitude: a.longitude ?? null });
    setMakeDefault(!!a.isDefault); setEditId(a.id); setDetectErr(''); setAdding(true);
  };

  /* Where the point comes from, so the form can say so and so a hand-placed pin is never
     overwritten by a geocode. 'pin' wins over everything — see lib/geocode.ts. */
  const [pointSource, setPointSource] = useState<PointSource | null>(null);
  const [pointNote, setPointNote] = useState('');

  /* Seed the map the moment a pincode is valid.
     The map used to render only when coordinates already existed, which made it useless in the one
     case it was built for: an address with no point yet, or one whose bad point had been cleared.
     There was nothing to draw, so there was nothing to drag. Dropping the PIN-area centre in gives
     the pin somewhere to start; it is marked 'postcode', so it still ranks below anything better
     and the save path re-resolves it against the typed street either way. */
  useEffect(() => {
    if (!adding) return;
    const pin = aform.pincode.replace(/\D/g, '');
    if (pin.length !== 6) return;
    if (aform.latitude != null && aform.longitude != null) return;
    let live = true;
    const t = setTimeout(async () => {
      const { point } = await resolveAddressPoint({ pincode: pin }, null);
      if (!live || !point) return;
      setAform(f => (f.latitude != null && f.longitude != null ? f
        : { ...f, latitude: point.latitude, longitude: point.longitude }));
      setPointSource('postcode');
      setPointNote('Centre of PIN ' + pin + ' — drag the pin to your door.');
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [adding, aform.pincode, aform.latitude, aform.longitude]);

  /** Dragging the pin is the customer telling us exactly where they are. Nothing outranks it. */
  const setPin = (latitude: number, longitude: number) => {
    setAform(f => ({ ...f, latitude, longitude }));
    setPointSource('pin');
    setPointNote('Pinned by you.');
  };

  const saveAddr = async () => {
    setSavingAddr(true);
    // Guarantee coordinates for intracity/same-day routing. The typed address is the source of
    // truth: geocode it on save and use that; only fall back to any GPS-detected coordinates if the
    // lookup fails — so a manually-typed address never ships without a location and quietly drops to
    // multi-day (the carriers return zero couriers when there's no lat/long).
    /* The carrier delivers to the coordinates, not to the text, so a point we are not sure of is
       worse than no point at all: no point means no same-day quote, which is visible and
       recoverable. A wrong one is a rider at the wrong house with every screen showing the right
       address. resolveAddressPoint therefore returns nothing rather than guessing — see
       lib/geocode.ts, and the Jayanagar order that prompted it. */
    const { point, rejected } = await resolveAddressPoint(aform, {
      latitude: aform.latitude, longitude: aform.longitude, source: pointSource ?? undefined,
    });
    const latitude = point?.latitude ?? null;
    const longitude = point?.longitude ?? null;
    console.log(point
      ? `[address] saving at ${latitude},${longitude} (${point.source})${rejected ? ` — dropped ${rejected.source}: ${rejected.reason}` : ''}`
      : '[address] saving WITHOUT coordinates — same-day cannot be quoted, which is the intended outcome when we cannot place it');
    const data: Omit<Address, 'id'> = { ...aform, latitude, longitude, isDefault: makeDefault };
    if (editId != null) {
      // Editing an existing address.
      const updated: Address = { ...data, id: editId };
      try { await updateAddress(editId, data); } catch {} // keep the local edit even if the backend lacks the route
      setAddresses(p => p.map(a => (a.id === editId ? updated : (makeDefault ? { ...a, isDefault: false } : a))));
      setAddr(editId);
    } else {
      // Adding a new address.
      let created: Address;
      try { created = await addAddress(data); } catch { created = { ...data, id: Date.now() }; }
      setAddresses(p => [...(makeDefault ? p.map(a => ({ ...a, isDefault: false })) : p), created]);
      setAddr(created.id);
    }
    setSavingAddr(false);
    closeAddrForm();
  };

  // Detect-my-location → reverse-geocode → prefill the address columns we can. Only runs on click.
  const detectLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setDetectErr('Location is not available on this device.'); return; }
    // Browsers only show the permission prompt on a secure origin (localhost or https).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setDetectErr('Location needs a secure connection. Open the site on localhost or its https link — then it will ask permission.');
      return;
    }
    setDetecting(true); setDetectErr('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { Accept: 'application/json' } });
          const j = await res.json();
          const a = j.address || {};
          // "Bengaluru Urban" / "Mumbai Suburban" → "Bengaluru" / "Mumbai"
          const cleanDistrict = (s: string | undefined) => (s || '').replace(/\s*(urban|rural|suburban|district|division)\s*$/i, '').trim();
          // Street/cross + locality go into Area/Landmark (not the flat field).
          const area = [a.road, a.neighbourhood || a.suburb || a.residential || a.quarter].filter(Boolean).join(', ');
          setAform(f => ({
            ...f,
            // Keep the coordinates themselves, not just the address they resolve to. Same-day
            // intracity needs them: without a lat/long the carrier returns no couriers at all and
            // the order quietly falls back to multi-day shipping.
            latitude, longitude,
            // Flat / House / Building is user-specific — GPS can't know it, so leave it for the user to type.
            addressLine2: f.addressLine2 || area,
            city: a.city || cleanDistrict(a.state_district) || a.town || a.municipality || a.county || a.village || f.city,
            state: matchState(a.state) || f.state,
            pincode: (a.postcode || '').replace(/\D/g, '').slice(0, 6) || f.pincode,
          }));
          setPointSource('gps');
          setPointNote('From your device location — check the pin below.');
          if (!a.postcode && !a.city && !a.state_district) setDetectErr('Got your location, but couldn’t read the full address — please complete it.');
          else setDetectErr('');
        } catch {
          setDetectErr('Could not look up your address. Please fill it in manually.');
        } finally { setDetecting(false); }
      },
      err => {
        setDetecting(false);
        setDetectErr(
          err.code === 1 ? 'Location permission denied — allow it in your browser, or just type your address below.'
            : err.code === 3 ? 'Location timed out — try again, or type your address below.'
              : 'Could not read your location — please type your address below.',
        );
      },
      // High-accuracy often times out on desktops/indoors; coarse + a longer window is far more reliable.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  };

  const chosen = addresses.find(a => a.id === addr);

  return {
    addresses, chosen, adding, aform, setAform, editId, makeDefault, setMakeDefault,
    detecting, detectErr, savingAddr,
    pointSource, pointNote, setPin,
    openAddForm, editAddr, closeAddrForm, saveAddr, detectLocation,
  };
}
