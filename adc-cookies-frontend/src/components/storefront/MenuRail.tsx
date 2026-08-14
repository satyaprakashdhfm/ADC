'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A dot per menu section, pinned to the left edge and centred vertically, marking which category
 * you are currently scrolled into — and, on hover, a scrubber for moving between them.
 *
 * The menu is nine sections and forty products long. Once you are three screens into it there is
 * nothing telling you where you are or how much is left, and getting back to a category you passed
 * means scrolling and hoping.
 *
 * At rest it is only dots. Point at one and a five-item window opens around IT — that one, two
 * above, two below — that one lit and its neighbours darkened, so the shape of the menu around
 * you is readable without the whole list being on screen. Scrolling over the rail moves that window rather
 * than the page; stop, and it takes you where you landed.
 *
 * Sections are found in the DOM by `data-menu-section` rather than by id, because the first section
 * deliberately has no id of its own (it shares the wrapper's `#products`, so deep links land at the
 * top of the menu rather than below its intro).
 *
 * It sits in a strip the menu reserves for it (`--menu-rail-w`, applied as padding on #products),
 * not in the page gutter. Pinning it to the viewport while the grid was pinned to the gutter meant
 * that below ~1680px the two wanted the same pixels, and the dots landed on the product cards.
 * Reserved space is the only version of "far enough left" that survives every window width.
 */

const WINDOW = 2;        // how many neighbours each side open up on hover
const SETTLE_MS = 420;   // pause in scrubbing that counts as "I meant this one"

export default function MenuRail({ sections }: { sections: readonly { label: string; anchor: string }[] }) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  // Where scrubbing has got to. Null means "not scrubbing" and the focus follows the page instead.
  const [picked, setPicked] = useState<number | null>(null);

  /* A phone gets smaller marks and smaller labels — the desktop sizes are tuned for a pointer and
     a 1400px column, and at 390px they read as an overlay rather than a margin note. */
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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

  /* A tap has no hover to open the window with, so the tap itself does it: the label appears, the
     page starts moving, and it closes again a beat later. Without this a phone got bare dots with
     nothing to say which section each one was. */
  const pick = (i: number) => {
    setOpen(true);
    setPicked(i);
    jump(i);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(close, 900);
  };

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
        // Centred in the strip #products reserves, so the dots sit in space nothing else wants.
        left: 'calc(var(--menu-rail-w) / 2 - 8px)',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 10 : 13,
        alignItems: 'flex-start',
        // Padding gives the pointer somewhere to land between the dots, so the open state does not
        // flicker as it crosses the gaps.
        padding: compact ? '8px 5px' : '10px 8px',
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
            onClick={() => pick(i)}
            /* The window follows the pointer: whichever mark you are over becomes the focus, and
               its two neighbours either side open around it. Without this the list opened around
               wherever the PAGE happened to be, so moving down the rail changed nothing and the
               thing felt dead under the cursor.
               Pointing alone never navigates — only a click, or a wheel-scrub that settles. A rail
               that jumped the page whenever the mouse crossed it would be a trap on the way to
               anything else on that edge of the screen. */
            onMouseEnter={() => setPicked(i)}
            onFocus={() => { setOpen(true); setPicked(i); }}
            aria-label={`Go to ${s.label}`}
            aria-current={i === active ? 'true' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: compact ? 7 : 10,
              border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                width: on ? (compact ? 9 : 11) : (compact ? 5 : 7),
                height: on ? (compact ? 9 : 11) : (compact ? 5 : 7),
                borderRadius: '50%',
                flex: 'none',
                background: on ? 'var(--gradient-warm)' : 'var(--ink-700)',
                opacity: on ? 1 : 0.42,
                boxShadow: on ? `0 0 0 ${compact ? 3 : 4}px var(--amber-500-35)` : 'none',
                transition: 'width .18s var(--ease-out), height .18s var(--ease-out), opacity .18s ease, box-shadow .18s ease',
              }}
            />
            {/* Neighbours darken so the current one reads as lit rather than merely present — the
                context is meant to be legible, not competing. Fades out with distance so the window
                has an edge instead of just stopping. */}
            <span
              style={{
                padding: compact ? '3px 8px' : '5px 12px',
                borderRadius: 'var(--radius-pill)',
                background: on ? 'var(--gradient-warm)' : 'var(--ink-950)',
                color: on ? 'var(--white)' : 'var(--cream-100-72)',
                boxShadow: on ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
                fontFamily: 'var(--font-body)',
                fontSize: compact ? 10 : 'var(--text-2xs)',
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
