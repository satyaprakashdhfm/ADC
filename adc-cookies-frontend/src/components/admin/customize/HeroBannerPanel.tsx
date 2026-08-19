'use client';
import { ExternalLink } from 'lucide-react';
import { type HeroBannerRefs, type HeroBannerUrls, type HeroSizes } from '@/lib/api';
import { inp, addBtn, Panel, Field } from '../shared/ui';
import ImageUploadField from '../shared/ImageUploadField';

/* What the frontend ships today, shown as the "currently on the site" preview when nothing has been
   uploaded. These are the real files HomeHero falls back to, so the panel is never lying about what
   a visitor sees. */
const SHIPPED_DESKTOP = '/assets/hero-cookies-wide.jpg';
const SHIPPED_MOBILE = '/assets/hero-cookies-portrait.jpg';

/* Somewhere to start from, rather than an empty box and a guess about what a valid destination is. */
const SUGGESTIONS = [
  { label: 'Gift hampers', href: '/corporate' },
  { label: 'The menu', href: '/order' },
  { label: 'Our stores', href: '/locations' },
  { label: 'Franchise', href: '/franchise' },
];

interface Props {
  hero: HeroBannerRefs;
  urls: HeroBannerUrls;
  sizes: HeroSizes;
  saved: boolean;
  busy: boolean;
  onImage: (which: 'desktop' | 'mobile', ref: string, url: string) => void;
  onField: (patch: Partial<Pick<HeroBannerRefs, 'href' | 'alt'>>) => void;
  onSave: () => void;
}

export default function HeroBannerPanel({ hero, urls, sizes, saved, busy, onImage, onField, onSave }: Props) {
  const href = hero.href || '';

  return (
    <Panel title="Home page banner">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 4px' }}>
        The photograph behind the headline at the top of the home page, and where clicking it takes
        people. Leave either image empty to keep the one the site already ships.
      </p>
      <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)', margin: '0 0 16px' }}>
        There are two because the banner is cropped differently on a phone: a wide photo loses its
        left and right edges on a narrow screen, so the portrait version is what a phone gets.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18, marginBottom: 18 }}>
        <ImageUploadField
          label="Desktop banner"
          value={hero.desktopRef || ''}
          url={urls.desktop}
          fallbackUrl={SHIPPED_DESKTOP}
          expected={sizes.desktop}
          aspect={sizes.desktop.width / sizes.desktop.height}
          onChange={(ref, url) => onImage('desktop', ref, url)}
          hint="Shown above 680px wide. The headline and buttons sit in the middle of it, so keep the centre uncluttered."
        />
        <ImageUploadField
          label="Phone banner"
          value={hero.mobileRef || ''}
          url={urls.mobile}
          fallbackUrl={SHIPPED_MOBILE}
          expected={sizes.mobile}
          aspect={sizes.mobile.width / sizes.mobile.height}
          onChange={(ref, url) => onImage('mobile', ref, url)}
          hint="Shown at 680px and below. A taller crop of the same shot works best."
        />
      </div>

      <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <Field label="Destination — where clicking the banner goes">
          <input
            style={inp}
            value={href}
            onChange={e => onField({ href: e.target.value })}
            placeholder="/corporate"
          />
        </Field>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: -4 }}>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700 }}>Try:</span>
          {SUGGESTIONS.map(s => (
            <button key={s.href} type="button" onClick={() => onField({ href: s.href })}
              style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: '1.5px solid var(--border-default)', background: href === s.href ? 'var(--amber-50)' : 'var(--surface-raised)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-2xs)' }}>
              {s.label}
            </button>
          ))}
          {href && (
            <a href={href} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-link)', textDecoration: 'none' }}>
              <ExternalLink size={12} /> Open it
            </a>
          )}
        </div>
        <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: 0, lineHeight: 1.5 }}>
          A path on this site (starting with <code>/</code>) or a full <code>https://</code> link.
          Leave it empty and the banner is not clickable — the &quot;Order Cookies&quot; and &quot;Our
          Story&quot; buttons on top of it keep working either way.
        </p>

        <Field label="Description for screen readers (optional)">
          <input
            style={inp}
            value={hero.alt || ''}
            onChange={e => onField({ alt: e.target.value })}
            placeholder="e.g. A tray of freshly baked cookies"
          />
        </Field>

        <div>
          <button onClick={onSave} disabled={busy} style={{ ...addBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save banner'}
          </button>
        </div>
      </div>
    </Panel>
  );
}
