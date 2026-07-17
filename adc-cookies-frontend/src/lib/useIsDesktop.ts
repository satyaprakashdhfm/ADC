'use client';
import { useState, useEffect } from 'react';

// True once the viewport is at least `bp` wide — lets a component size itself differently on
// desktop vs. mobile without duplicating this matchMedia wiring in every popup.
export function useIsDesktop(bp = 640) {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(min-width:${bp}px)`);
    const f = () => setD(m.matches); f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [bp]);
  return d;
}
