'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Measures how many rows of a wrapping grid it takes for the left checkout column to reach the
 * height of the right one, so "Goes great with" grows into the empty space instead of leaving a
 * tall white gap beside the address / gift / coupon / bill stack.
 *
 * Attach the three refs to: the left column, the right column, and the grid itself.
 *
 * The measurement is deliberately of `left − grid`, not of `left`: everything in the left column
 * that ISN'T the grid (the order summary, the card's own header and padding) does not change when
 * rows are added, so the number the row count is derived from is invariant. Measuring the whole
 * left column instead would make each answer change its own input — one more row makes the column
 * taller, which asks for fewer rows, which makes it shorter — and the grid would flicker between
 * two sizes forever.
 *
 * `cols` is read back from the grid's resolved `grid-template-columns` rather than computed from a
 * width, so it always agrees with what the browser actually laid out.
 */
export function useColumnFill(enabled: boolean, gap: number) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(0);    // rows that fit; 0 until measured
  const [cols, setCols] = useState(2);  // sensible default for the first paint

  useEffect(() => {
    if (!enabled || typeof ResizeObserver === 'undefined') { setFit(0); return; }
    const left = leftRef.current, right = rightRef.current, grid = gridRef.current;
    if (!left || !right || !grid) return;

    const measure = () => {
      const tile = grid.firstElementChild as HTMLElement | null;
      if (!tile) return;
      const rowH = tile.offsetHeight + gap;
      if (rowH <= gap) return;   // images not laid out yet — the observer will call again
      const template = getComputedStyle(grid).gridTemplateColumns;
      const n = template && template !== 'none' ? template.split(' ').filter(Boolean).length : 1;
      const base = left.offsetHeight - grid.offsetHeight;   // invariant as rows change
      const room = right.offsetHeight - base;
      const rows = Math.max(0, Math.floor((room + gap) / rowH));
      setCols(c => (c === n ? c : n));
      setFit(f => (f === rows ? f : rows));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(left); ro.observe(right); ro.observe(grid);
    return () => ro.disconnect();
  }, [enabled, gap]);

  return { leftRef, rightRef, gridRef, fit, cols };
}
