'use client';
import { useCookiesSold } from './CookiesSoldCounter';

/*
 * The cookies-sold figure as a big hero number: it counts up when the page opens and keeps ticking
 * while it is on screen. Same number as the footer counter, from the same hook.
 *
 * Before the first client render there is no number yet, so the space is held with a non-breaking
 * placeholder of the same height and the layout does not jump when it arrives.
 */
export default function LiveCookiesSold({ color, labelColor }: { color: string; labelColor: string }) {
  const n = useCookiesSold({ countUpFrom: 2500, tickMs: 3000 });
  return (
    <div>
      <div style={{ font: '900 clamp(2.2rem,1.5rem + 3vw,3.6rem)/1 var(--font-display)', letterSpacing: '-.02em', color, fontVariantNumeric: 'tabular-nums' }}>
        {n == null ? ' ' : `${n.toLocaleString('en-IN')}+`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: labelColor, fontWeight: 800, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-display)' }}>
        Cookies baked &amp; sold
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ad06a', boxShadow: '0 0 0 3px rgba(58,208,106,.3)' }} />
      </div>
    </div>
  );
}
