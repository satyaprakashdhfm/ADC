'use client';
import { useEffect, useState } from 'react';

/**
 * A faint dot per menu section, pinned to the left edge and centred vertically, marking which
 * category you are currently scrolled into.
 *
 * The menu is nine sections and forty products long. Once you are three screens into it there is
 * nothing telling you where you are or how much is left, and getting back to a category you passed
 * means scrolling and hoping. This is the answer to both, kept quiet enough to ignore: hairline dots
 * at rest, the current one filled, its name only on hover.
 *
 * Only while the menu is actually on screen — elsewhere on the page it would be a control pointing
 * at nothing — and only on wide screens, where there is dead margin to put it in. A phone has no
 * spare left edge, and its section headings are already close together.
 *
 * Sections are found in the DOM by `data-menu-section` rather than by id, because the first section
 * deliberately has no id of its own (it shares the wrapper's `#products`, so deep links land at the
 * top of the menu rather than below its intro).
 */
export default function MenuRail({ sections }: { sections: readonly { label: string; anchor: string }[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    if (sections.length === 0) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const menu = document.getElementById('products');
      if (!menu) return;

      // On screen at all? Anything less than a strip of it showing and the rail is noise.
      const box = menu.getBoundingClientRect();
      setVisible(box.top < window.innerHeight * 0.6 && box.bottom > window.innerHeight * 0.4);

      /* The current section is the last one whose heading has passed the upper third of the
         viewport — the same thing the eye does, rather than "whichever occupies the most pixels",
         which flips early on a tall section and late on a short one. */
      const line = window.innerHeight * 0.32;
      let current: string | null = null;
      document.querySelectorAll<HTMLElement>('[data-menu-section]').forEach(el => {
        if (el.getBoundingClientRect().top <= line) current = el.dataset.menuSection ?? null;
      });
      setActive(current ?? sections[0].anchor);
    };

    // rAF-throttled: this runs on every scroll event and reads layout, which is the one thing worth
    // being careful about doing repeatedly.
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

  if (sections.length === 0) return null;

  const jump = (anchor: string) => {
    const el = anchor === 'products'
      ? document.getElementById('products')
      : document.getElementById(anchor);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className="menu-rail"
      aria-label="Menu sections"
      style={{
        position: 'fixed',
        left: 'clamp(10px,1.6vw,26px)',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        alignItems: 'flex-start',
        // Fades rather than unmounts, so it does not pop in mid-scroll.
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .35s var(--ease-out)',
      }}
    >
      {sections.map(s => {
        const on = active === s.anchor;
        const shown = hover === s.anchor;
        return (
          <button
            key={s.anchor}
            onClick={() => jump(s.anchor)}
            onMouseEnter={() => setHover(s.anchor)}
            onMouseLeave={() => setHover(h => (h === s.anchor ? null : h))}
            onFocus={() => setHover(s.anchor)}
            onBlur={() => setHover(h => (h === s.anchor ? null : h))}
            aria-label={`Go to ${s.label}`}
            aria-current={on ? 'true' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                width: on ? 9 : 6,
                height: on ? 9 : 6,
                borderRadius: '50%',
                flex: 'none',
                background: on ? 'var(--gradient-warm)' : 'var(--border-strong)',
                boxShadow: on ? '0 0 0 4px var(--amber-500-35)' : 'none',
                transition: 'width .2s var(--ease-out), height .2s var(--ease-out), background .2s ease, box-shadow .2s ease',
              }}
            />
            {/* The name is the reward for pointing at a dot, not something on screen permanently —
                nine labels down the margin would be a second navbar. */}
            <span
              style={{
                padding: '5px 11px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--vanilla)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-strong)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-2xs)',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                opacity: shown ? 1 : 0,
                transform: shown ? 'translateX(0)' : 'translateX(-6px)',
                transition: 'opacity .18s ease, transform .18s var(--ease-out)',
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
