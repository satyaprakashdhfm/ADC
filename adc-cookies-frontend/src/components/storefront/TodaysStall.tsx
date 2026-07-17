'use client';
import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { getStallInfo } from '@/lib/api';

/**
 * "Visit us today" card — shown only while the admin has set a stall/visit note
 * (Admin → Products tab → "Today's stall"). Renders nothing otherwise, so an empty
 * setting never leaves an awkward gap on the homepage.
 */
export default function TodaysStall() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    getStallInfo().then(r => setText(r.text)).catch(() => {});
  }, []);

  if (!text) return null;

  return (
    <section style={{ padding: '0 var(--gutter)', margin: 'clamp(16px,2.5vw,28px) 0' }}>
      <div style={{
        maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14,
        padding: 'clamp(14px,2vw,20px) clamp(16px,2.5vw,24px)', borderRadius: 'var(--radius-card)',
        background: 'var(--gradient-warm)', boxShadow: 'var(--shadow-brand)',
      }}>
        <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--white-16)', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <MapPin size={20} color="var(--white)" />
        </span>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--white-82)' }}>Today — please visit</p>
          <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--white)', lineHeight: 1.4 }}>{text}</p>
        </div>
      </div>
    </section>
  );
}
