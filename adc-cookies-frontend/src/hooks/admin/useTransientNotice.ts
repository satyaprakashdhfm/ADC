'use client';
import { useState, useEffect, useCallback } from 'react';

/**
 * A success message that clears itself.
 *
 * The dashboard's green banner used to sit there until somebody clicked it, which meant a stack of
 * confirmations for things that had already happened — "Link copied.", "Store is back online." —
 * competed with whatever the operator was doing next, and after a few actions it was no longer clear
 * which one it was confirming. Errors are deliberately NOT wired through this: an error is something
 * still to deal with, so it stays until it is read and dismissed.
 *
 * A counter travels with the text so setting the SAME message twice restarts the clock. Without it,
 * copying a link twice in a row left the second confirmation on a timer already half spent — React
 * skips the render when the string has not changed, so the effect never re-ran.
 */
export function useTransientNotice(ms = 4500) {
  const [state, setState] = useState<{ text: string; seq: number }>({ text: '', seq: 0 });

  const setNotice = useCallback((text: string) => {
    setState(s => ({ text, seq: s.seq + 1 }));
  }, []);

  useEffect(() => {
    if (!state.text) return;
    const t = setTimeout(() => setState(s => ({ ...s, text: '' })), ms);
    return () => clearTimeout(t);
  }, [state.text, state.seq, ms]);

  return [state.text, setNotice] as const;
}
