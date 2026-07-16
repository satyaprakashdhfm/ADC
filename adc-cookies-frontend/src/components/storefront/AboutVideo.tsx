'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

// Dummy brand video for now — swap the ID when the real one is ready.
const VIDEO_ID = 'PFJAuAWxuvI';
const DEFAULT_POSTER = '/assets/cookies_new_images/cookie-sundae.jpeg';

/**
 * About-Us video: shows a poster with a play button, then swaps in the YouTube
 * embed and autoplays it *muted* once the section scrolls into view (pausing again
 * when it leaves). Tapping the poster also starts it — that counts as a user gesture,
 * so it works even where browsers block scroll-triggered autoplay.
 */
export default function AboutVideo({
  style,
  poster = DEFAULT_POSTER,
  alt = 'A Dough Cookie — watch the story',
  sizes = '(max-width:860px) 100vw, 540px',
}: {
  style?: React.CSSProperties;
  poster?: string;
  alt?: string;
  sizes?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        // Hysteresis: start once ~40% is on screen, only stop when fully gone — no flicker at the edge.
        if (e.intersectionRatio >= 0.4) setActive(true);
        else if (e.intersectionRatio === 0) setActive(false);
      },
      { threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const src =
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}` +
    `?autoplay=1&mute=1&controls=1&rel=0&playsinline=1&loop=1&playlist=${VIDEO_ID}&modestbranding=1&start=2`;

  return (
    <div ref={wrapRef} style={{ position: 'relative', overflow: 'hidden', background: 'var(--ink-900)', ...style }}>
      {active ? (
        <iframe
          src={src}
          title="A Dough Cookie"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label="Play video"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
        >
          <Image src={poster} alt={alt} fill sizes={sizes} style={{ objectFit: 'cover' }} />
          <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--espresso-30)' }} />
          <span
            aria-hidden
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-warm)',
              boxShadow: 'var(--shadow-brand)', display: 'grid', placeItems: 'center',
            }}
          >
            <svg width={26} height={26} viewBox="0 0 24 24" fill="var(--white)"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
      )}
    </div>
  );
}
