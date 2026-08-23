'use client';
import { ExternalLink, RotateCcw, Clock } from 'lucide-react';
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
  live: boolean;
  onImage: (which: 'desktop' | 'mobile', ref: string, url: string) => void;
  onField: (patch: Partial<Pick<HeroBannerRefs, 'href' | 'alt' | 'enabled' | 'startsAt' | 'endsAt' | 'hideOverlay'>>) => void;
  onSave: () => void;
  onReset: () => void;
}

/* <input type="datetime-local"> speaks local wall-clock time with no zone; the field is stored as
   UTC. These two are the only conversion, kept together so a value cannot be read one way and
   written the other. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/* The lengths an offer actually runs for. Typing an end date by hand is the fiddly part, so these
   set it from the start (or from now, if no start is given). */
const DURATIONS: { label: string; mins: number }[] = [
  { label: '30 min', mins: 30 },
  { label: '1 hour', mins: 60 },
  { label: '6 hours', mins: 360 },
  { label: '1 day', mins: 1440 },
  { label: '3 days', mins: 4320 },
  { label: '1 week', mins: 10080 },
];

/** "2 days, 4 hours left" — the number the person setting an offer actually wants to see. */
function remaining(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return 'ended';
  const mins = Math.floor(ms / 60000), d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d) return `${d} day${d > 1 ? 's' : ''}, ${h} hr left`;
  if (h) return `${h} hr ${m} min left`;
  return `${m} min left`;
}

export default function HeroBannerPanel({ hero, urls, sizes, saved, busy, live, onImage, onField, onSave, onReset }: Props) {
  const href = hero.href || '';
  const left = remaining(hero.endsAt);
  const hasImage = !!(hero.desktopRef || hero.mobileRef);

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

        {/* ---- When it runs ---- */}
        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Clock size={15} style={{ color: 'var(--brand-secondary)' }} />
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>When this banner runs</strong>
            {/* Straight from the server. The admin's clock and the server's are not the same clock,
                and this line is the one that must not be a guess. */}
            <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 900, padding: '2px 9px', borderRadius: 'var(--radius-pill)',
              background: live ? 'var(--status-success)' : 'var(--surface-sunken)', color: live ? 'var(--white)' : 'var(--text-muted)' }}>
              {live ? 'ON THE SITE NOW' : 'not showing'}
            </span>
            {left && <span style={{ fontSize: 'var(--text-2xs)', color: left === 'ended' ? 'var(--status-error)' : 'var(--text-muted)', fontWeight: 800 }}>{left}</span>}
          </div>

          <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: 0, lineHeight: 1.5 }}>
            Leave both empty and it runs until you press Reset. Once the end time passes the site goes
            back to the usual hero on its own — nobody has to be awake for it. Saving puts the banner
            live; Reset is the only thing that takes it down.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Field label="Start (optional)">
              <input type="datetime-local" style={{ ...inp, width: 210 }} value={toLocalInput(hero.startsAt)}
                onChange={e => onField({ startsAt: fromLocalInput(e.target.value) })} />
            </Field>
            <Field label="End (optional)">
              <input type="datetime-local" style={{ ...inp, width: 210 }} value={toLocalInput(hero.endsAt)}
                onChange={e => onField({ endsAt: fromLocalInput(e.target.value) })} />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 800 }}>Run for:</span>
            {DURATIONS.map(d => (
              <button key={d.label} type="button"
                onClick={() => {
                  // From the start if one is set, otherwise from now — and set the start too, so the
                  // window is always a pair rather than an end date hanging on its own.
                  const from = hero.startsAt ? new Date(hero.startsAt) : new Date();
                  onField({ startsAt: from.toISOString(), endsAt: new Date(from.getTime() + d.mins * 60000).toISOString() });
                }}
                style={{ padding: '5px 11px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)',
                  background: 'var(--surface-raised)', color: 'var(--text-body)', fontFamily: 'var(--font-body)',
                  fontWeight: 800, fontSize: 'var(--text-2xs)', cursor: 'pointer' }}>
                {d.label}
              </button>
            ))}
            {(hero.startsAt || hero.endsAt) && (
              <button type="button" onClick={() => onField({ startsAt: null, endsAt: null })}
                style={{ padding: '5px 11px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'transparent',
                  color: 'var(--text-link)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-2xs)', cursor: 'pointer' }}>
                Clear dates
              </button>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!hero.hideOverlay} style={{ marginTop: 3 }}
              onChange={e => onField({ hideOverlay: e.target.checked })} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-body)', lineHeight: 1.5 }}>
              <strong>Show the image on its own</strong> — hides the wordmark, the headline and the
              &quot;Order Cookies&quot; / &quot;Our Story&quot; buttons while this banner is up. Leave
              it on for an offer poster that already has its own words; turn it off if you have
              uploaded a plain photograph to sit behind the usual headline.
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={onSave} disabled={busy} style={{ ...addBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save banner'}
          </button>
          {/* Its own call, not a save of this form: pressing Reset must not also publish whatever
              half-typed edit happens to be on screen. The artwork is kept — an offer usually runs
              again, and ending one should not cost an upload. */}
          <button onClick={onReset} disabled={busy || (!hasImage && !hero.enabled)}
            title="Show the usual hero again now. The uploaded images are kept."
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 'var(--radius-pill)',
              border: '1.5px solid var(--status-error)', background: 'transparent', color: 'var(--status-error)',
              fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)',
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            <RotateCcw size={14} /> Reset to the usual hero
          </button>
          {!hero.enabled && hasImage && (
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
              Off — the images are still here. Press Save banner to run it again.
            </span>
          )}
        </div>
      </div>
    </Panel>
  );
}
