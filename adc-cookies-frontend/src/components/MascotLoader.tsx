'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';

const COUNT = 6;

/**
 * Cookie-mascot loading animation. All six mascots are preloaded and stacked; the active
 * one cross-fades in while the previous fades out — one at a time, smoothly. Used for slow
 * page loads and the payment-processing screen.
 */
export default function MascotLoader({ label = 'Loading…', size = 88, fullscreen = false, delay = false }: { label?: string; size?: number; fullscreen?: boolean; delay?: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI(p => (p + 1) % COUNT), 1300);
    return () => clearInterval(t);
  }, []);

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {Array.from({ length: COUNT }, (_, n) => {
          const on = n === i;
          return (
            <Image
              key={n}
              src={`/assets/mascots/mascot-${n + 1}.png`}
              alt=""
              width={size}
              height={size}
              priority
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
                opacity: on ? 1 : 0,
                transform: on ? 'scale(1)' : 'scale(.82)',
                transition: 'opacity .55s ease, transform .55s ease',
              }}
            />
          );
        })}
      </div>
      {label && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>}
    </div>
  );

  if (!fullscreen) return inner;

  return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 24, animation: delay ? 'loaderFadeIn .25s ease .8s both' : 'loaderFadeIn .2s ease both' }}>
      {inner}
    </div>
  );
}
