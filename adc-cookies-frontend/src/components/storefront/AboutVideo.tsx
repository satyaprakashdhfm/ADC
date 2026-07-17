'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

// Brand video for the About section.
const VIDEO_ID = 'rEdl2Uetpvo';
// The video's OWN YouTube thumbnail — a real paused frame from it, not an unrelated marketing
// photo, so the pre-play state actually reads as "a video, ready to play" (like YouTube's own
// embed facade does) rather than just another product photo with a button on top.
const DEFAULT_POSTER = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;

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
  const [ready, setReady] = useState(false); // fade the iframe in only after it has had time to paint a frame

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

  // Keep the poster showing over the iframe until YouTube has had ~1.2s to render a real frame,
  // so the section never flashes YouTube's black buffer when it scrolls into view.
  useEffect(() => {
    if (!active) { setReady(false); return; }
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, [active]);

  const src =
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}` +
    `?autoplay=1&mute=1&controls=1&rel=0&playsinline=1&loop=1&playlist=${VIDEO_ID}&modestbranding=1&start=2`;

  return (
    <div ref={wrapRef} style={{ position: 'relative', overflow: 'hidden', background: 'var(--ink-900)', ...style }}>
      {/* Poster is ALWAYS the base layer, so the box shows the video's own paused frame
          immediately — never YouTube's black buffer. The iframe fades in only once it has painted. */}
      <Image src={poster} alt={alt} fill sizes={sizes} priority style={{ objectFit: 'cover' }} />

      {active && (
        <iframe
          src={src}
          title="A Dough Cookie"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, opacity: ready ? 1 : 0, transition: 'opacity .5s ease' }}
        />
      )}

      {!active && (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label="Play video"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
        >
          {/* A faint scrim only at the bottom — lets the paused frame read as real video content,
              not a darkened photo, while still keeping the "Watch on YouTube" badge legible. */}
          <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--espresso-45) 0%, transparent 30%)' }} />
          {/* YouTube's own play-button shape (rounded rect + white triangle) — reads as "a video,
              paused" at a glance, the way an un-clicked embed normally would. */}
          <span
            aria-hidden
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 68, height: 48, borderRadius: 14, background: 'rgba(20,20,20,.75)',
              boxShadow: '0 2px 10px var(--black-28)', display: 'grid', placeItems: 'center',
              transition: 'background .15s',
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="var(--white)"><path d="M8 5v14l11-7z" /></svg>
          </span>
          {/* Small "Watch on YouTube" badge, bottom-right — the same authenticity cue a real
              YouTube embed shows before it's clicked. */}
          <span aria-hidden style={{ position: 'absolute', right: 12, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 5, background: 'rgba(0,0,0,.6)', color: 'var(--white)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
            <svg width={13} height={13} viewBox="0 0 24 17" aria-hidden><path fill="#FF0000" d="M23.5 2.5a3 3 0 0 0-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.4A3 3 0 0 0 .5 2.5 31 31 0 0 0 0 8.4a31 31 0 0 0 .5 5.9 3 3 0 0 0 2.1 2.1C4.5 16.8 12 16.8 12 16.8s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-5.9 31 31 0 0 0-.5-5.9Z" /><path fill="#fff" d="M9.6 12V4.8l6.3 3.6-6.3 3.6Z" /></svg>
            Watch on YouTube
          </span>
        </button>
      )}
    </div>
  );
}
