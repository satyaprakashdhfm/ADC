'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A dash per menu section, pinned to the left edge and centred vertically, marking which category
 * you are currently scrolled into — and, on hover, a scrubber for moving between them.
 *
 * The menu is nine sections and forty products long. Once you are three screens into it there is
 * nothing telling you where you are or how much is left, and getting back to a category you passed
 * means scrolling and hoping.
 *
 * At rest it is only marks. Point at it and a five-item window opens — you are here, two above, two
 * below — the current one lit and its neighbours darkened, so the shape of the menu around you is
 * readable without the whole list being on screen. Scrolling over the rail moves that window rather
 * than the page; stop, and it takes you where you landed.
 *
 * Sections are found in the DOM by `data-menu-section` rather than by id, because the first section
 * deliberately has no id of its own (it shares the wrapper's `#products`, so deep links land at the
 * top of the menu rather than below its intro).
 */

const WINDOW = 2;        // how many neighbours each side open up on hover
const SETTLE_MS = 420;   // pause in scrubbing that counts as "I meant this one"

export default function MenuRail({ sections }: { sections: readonly { label: string; anchor: string }[] }) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  // Where scrubbing has got to. Null means "not scrubbing" and the focus follows the page instead.
  const [picked, setPicked] = useState<number | null>(null);

  const railRef = useRef<HTMLElement>(null);
  const settleTimer = useRef<number | null>(null);
  const pickedRef = useRef<number | null>(null);
  pickedRef.current = picked;
  const activeRef = useRef(0);
  activeRef.current = active;

  const jump = useCallback((i: number) => {
    const anchor = sections[i]?.anchor;
    if (!anchor) return;
    document.getElementById(anchor === 'products' ? 'products' : anchor)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sections]);

  /* Scroll-spy: which section is the page actually showing? */
  useEffect(() => {
    if (sections.length === 0) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const menu = document.getElementById('products');
      if (!menu) return;
      const box = menu.getBoundingClientRect();
      setVisible(box.top < window.innerHeight * 0.6 && box.bottom > window.innerHeight * 0.4);

      /* The last heading to have crossed the upper third — what the eye does, rather than
         "whichever covers the most pixels", which flips early on a tall section and late on a
         short one. */
      const line = window.innerHeight * 0.32;
      let current = 0;
      document.querySelectorAll<HTMLElement>('[data-menu-section]').forEach(el => {
        if (el.getBoundingClientRect().top <= line) {
          const i = sections.findIndex(s => s.anchor === el.dataset.menuSection);
          if (i >= 0) current = i;
        }
      });
      setActive(current);
    };
    // rAF-throttled: this runs on every scroll event and reads layout.
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sections]);

  /* Wheel over the rail scrubs the list instead of scrolling the page.
   *
   * Attached by hand rather than with onWheel, because React's wheel listener is passive and a
   * passive listener cannot preventDefault — without which the page would scroll away underneath
   * the thing you are trying to aim with. Bound only while the rail is open, so the wheel behaves
   * completely normally everywhere else on the page, including a few pixels to its right. */
  useEffect(() => {
    const el = railRef.current;
    if (!el || !open || sections.length === 0) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const from = pickedRef.current ?? activeRef.current;
      const next = Math.min(sections.length - 1, Math.max(0, from + (e.deltaY > 0 ? 1 : -1)));
      setPicked(next);
      // Each notch restarts the clock; the jump happens once scrubbing stops, so passing over a
      // section on the way to another one does not drag the page through it.
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        jump(next);
        setPicked(null);
      }, SETTLE_MS);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, sections, jump]);

  // Leaving mid-scrub abandons it: the page stays where it is rather than being taken somewhere
  // the pointer was only passing through.
  const close = () => {
    setOpen(false);
    setPicked(null);
    if (settleTimer.current) { window.clearTimeout(settleTimer.current); settleTimer.current = null; }
  };

  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

  if (sections.length === 0) return null;

  const focus = picked ?? active;

  return (
    <nav
      ref={railRef}
      className="menu-rail"
      aria-label="Menu sections"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      style={{
        position: 'fixed',
        left: 'clamp(10px,1.6vw,26px)',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 13,
        alignItems: 'flex-start',
        // Padding gives the pointer somewhere to land between the dashes, so the open state does
        // not flicker as it crosses the gaps.
        padding: '10px 8px',
        // Fades rather than unmounts, so it does not pop in mid-scroll.
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .35s var(--ease-out)',
      }}
    >
      {sections.map((s, i) => {
        const d = Math.abs(i - focus);
        const on = i === focus;
        const near = open && d <= WINDOW;   // the five-item window that opens on hover
        return (
          <button
            key={s.anchor}
            onClick={() => { jump(i); close(); }}
            aria-label={`Go to ${s.label}`}
            aria-current={i === active ? 'true' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                width: on ? 26 : 15,
                height: 3,
                borderRadius: 2,
                flex: 'none',
                background: on ? 'var(--gradient-warm)' : 'var(--ink-700)',
                opacity: on ? 1 : 0.45,
                boxShadow: on ? '0 0 10px var(--amber-500-38)' : 'none',
                transition: 'width .2s var(--ease-out), opacity .2s ease, box-shadow .2s ease',
              }}
            />
            {/* Neighbours darken so the current one reads as lit rather than merely present — the
                context is meant to be legible, not competing. Fades out with distance so the window
                has an edge instead of just stopping. */}
            <span
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-pill)',
                background: on ? 'var(--gradient-warm)' : 'var(--ink-950)',
                color: on ? 'var(--white)' : 'var(--cream-100-72)',
                boxShadow: on ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-2xs)',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                opacity: near ? (on ? 1 : d === 1 ? 0.8 : 0.45) : 0,
                transform: near ? 'translateX(0)' : 'translateX(-8px)',
                transition: 'opacity .18s ease, transform .18s var(--ease-out), background .2s ease',
                pointerEvents: 'none',
              }}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
