'use client';
import { useEffect, useRef, useState } from 'react';
import { resolveAddressPoint, kmBetween, PIN_RADIUS_KM, type PointSource } from '@/lib/geocode';

/**
 * The delivery point for an address form — wherever that form happens to live.
 *
 * There are two address editors: one in checkout and one in the account page. They were written
 * separately, and the account one had no coordinates in its form state at all, so editing an
 * address there silently dropped whatever point it had. Which is how someone can open an address,
 * fix it, save it, and be told all over again that we need its location: they had just deleted it.
 *
 * One copy of the rules, used by both. Two copies is the thing that caused this.
 */
/** Loose on purpose: the two forms type their optional fields slightly differently, and the point
 *  rules only ever read these. Tightening it would fork the hook, which is the thing to avoid. */
export interface PointForm {
  addressLine1?: string; addressLine2?: string;
  city?: string; state?: string; pincode?: string;
  latitude?: number | null; longitude?: number | null;
}

export function useAddressPoint<T extends PointForm>(
  form: T,
  setForm: (fn: (f: T) => T) => void,
  active: boolean,
) {
  const [pointSource, setPointSource] = useState<PointSource | null>(null);
  const [pointNote, setPointNote] = useState('');

  // Read through a ref, not the dependency array: the form object gets a new identity on every
  // keystroke, so depending on it tears down and rebuilds the debounce timer on each one — it would
  // never fire.
  const formRef = useRef(form);
  formRef.current = form;

  const addressKey = [form.pincode, form.city, form.addressLine1, form.addressLine2].join('|');
  const settledKey = useRef<string | null>(null);

  /* The pin follows whatever the customer most recently told us.
   *
   * GPS starts it off. From then on, editing the address is new information about where they live,
   * so the pin re-derives from the text — including over a pin they placed by hand, because
   * correcting a pincode after dropping a pin means the pin is now in the wrong city.
   *
   * But not every edit is news. Typing a flat number must not throw away a carefully placed pin and
   * replace it with the middle of the PIN area, so a fresh street match always moves the pin, while
   * a mere PIN-area centroid only moves it when the pin is not already inside that area. Move on a
   * real correction, hold on a detail.
   */
  useEffect(() => {
    if (!active) return;
    if (String(formRef.current.pincode || '').replace(/\D/g, '').length !== 6) return;
    if (settledKey.current === addressKey) return;
    let live = true;
    const t = setTimeout(async () => {
      const f = formRef.current;
      const { point } = await resolveAddressPoint(f, null);   // typed address only, never GPS
      if (!live) return;
      settledKey.current = addressKey;
      if (!point) return;

      const have = f.latitude != null && f.longitude != null;
      const away = have ? kmBetween(f.latitude!, f.longitude!, point.latitude, point.longitude) : Infinity;
      if (point.source === 'postcode' && have && away <= PIN_RADIUS_KM) return;

      setForm(prev => ({ ...prev, latitude: point.latitude, longitude: point.longitude }));
      setPointSource(point.source);
      setPointNote(
        point.source === 'street' ? 'Found from the address you typed — check the pin.'
          : have ? `Moved to PIN ${f.pincode} — the pin was ${Math.round(away)} km away.`
            : `Centre of PIN ${f.pincode} — drag the pin to your door.`,
      );
    }, 700);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, addressKey]);

  /** Dragging the pin is the customer telling us exactly where they are. Nothing outranks it. */
  const setPin = (latitude: number, longitude: number) => {
    setForm(f => ({ ...f, latitude, longitude }));
    setPointSource('pin');
    setPointNote('Pinned by you.');
    // Bank the current text with it, or the effect above would treat the address as unresolved and
    // immediately pull the pin back to a geocode.
    const f = formRef.current;
    settledKey.current = [f.pincode, f.city, f.addressLine1, f.addressLine2].join('|');
  };

  /** Note that GPS supplied this point, so the save path knows to check it against the pincode. */
  const markFromGps = () => { setPointSource('gps'); setPointNote('From your device location — check the pin below.'); };

  /**
   * The point to actually store. Returns null when nothing could be placed confidently, and that is
   * deliberate: no coordinates means no same-day offer, which is visible and recoverable, where
   * confidently wrong coordinates mean a rider at the wrong door.
   */
  const resolveForSave = async () => {
    const f = formRef.current;
    const { point, rejected } = await resolveAddressPoint(f, {
      latitude: f.latitude ?? null, longitude: f.longitude ?? null, source: pointSource ?? undefined,
    });
    console.log(point
      ? `[address] saving at ${point.latitude},${point.longitude} (${point.source})${rejected ? ` — dropped ${rejected.source}: ${rejected.reason}` : ''}`
      : '[address] saving WITHOUT coordinates — same-day cannot be quoted, which is the intended outcome when we cannot place it');
    return point;
  };

  return { pointSource, pointNote, setPin, markFromGps, resolveForSave };
}
