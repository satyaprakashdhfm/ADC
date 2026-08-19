'use client';
import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, Star, AlertTriangle, ImageOff } from 'lucide-react';
import { adminUploadMedia } from '@/lib/api';
import { iconBtn, actionBtn } from '../shared/ui';

/*
 * Product photos, as pictures rather than as a path in a text box.
 *
 * What this replaces was a single input labelled "Image path (e.g. /assets/products/adc-special.jpg
 * or JSON array)" — which meant the only way to change a photo was to know where a file had been
 * put on the frontend host, and the only way to check you had got it right was to open the shop.
 *
 * TWO KINDS OF VALUE live in this list and the difference is the whole reason this component exists:
 *
 *   ref — what is stored, and what goes back to the server on save.
 *   url — what an <img> can load. For an uploaded file it is a SIGNED url with an expiry, so it must
 *         never be written back into the row.
 *
 * The parent holds refs; this holds the url for each one only as long as the form is open.
 */

export interface ImageSlot { ref: string; url: string }

/** Split a product's parallel refs/urls into slots, tolerating a mismatched length. */
export function toSlots(refs: string[], images: string | null | undefined): ImageSlot[] {
  let urls: string[] = [];
  if (images) {
    try {
      const parsed = JSON.parse(images);
      urls = Array.isArray(parsed) ? parsed.map(String) : [String(images)];
    } catch {
      urls = [String(images)];
    }
  }
  return refs.map((ref, i) => ({ ref, url: urls[i] || ref }));
}

const MAX_IMAGES = 5;

export default function ProductImagesField({ slots, onChange }: {
  slots: ImageSlot[];
  onChange: (next: ImageSlot[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(''); setBusy(true);
    const added: ImageSlot[] = [];
    try {
      for (const file of Array.from(files).slice(0, MAX_IMAGES - slots.length)) {
        const up = await adminUploadMedia(file, 'product');
        added.push({ ref: up.ref, url: up.url });
      }
      if (added.length) onChange([...slots, ...added]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That upload did not work.');
      // Keep whatever did land. Losing three successful uploads because the fourth failed would
      // mean starting over for no reason.
      if (added.length) onChange([...slots, ...added]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /* Removed from the list only. The object is deleted server-side on save, once the row no longer
     names it — deleting here would take the photo away from a live product if the edit is cancelled. */
  const remove = (i: number) => onChange(slots.filter((_, idx) => idx !== i));

  const makeFirst = (i: number) => {
    if (i === 0) return;
    const next = [...slots];
    const [moved] = next.splice(i, 1);
    onChange([moved, ...next]);
  };

  return (
    <div>
      <span style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5 }}>
        Photos {slots.length > 1 && <span style={{ fontWeight: 500 }}>— the first one is what the shop shows</span>}
      </span>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {slots.map((s, i) => (
          <div key={s.ref} style={{
            position: 'relative', width: 92, height: 92, borderRadius: 12, overflow: 'hidden',
            border: i === 0 ? '2px solid var(--brand-secondary)' : '1.5px solid var(--border-default)',
            background: 'var(--surface-sunken)', flex: 'none',
          }}>
            {broken[s.ref] ? (
              <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: 'var(--text-subtle)' }} title={s.ref}>
                <ImageOff size={20} />
              </div>
            ) : (
              /* Unoptimized: next/image cannot run its loader over a signed URL on a host that is
                 not in the images config, and a signed URL changes every week anyway, so there is
                 nothing stable for it to cache. */
              <Image src={s.url} alt="" fill sizes="92px" unoptimized
                onError={() => setBroken(b => ({ ...b, [s.ref]: true }))}
                style={{ objectFit: 'cover' }} />
            )}

            <button type="button" onClick={() => remove(i)} aria-label="Remove photo" title="Remove"
              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'var(--surface-overlay)', color: 'var(--white)', display: 'grid', placeItems: 'center' }}>
              <X size={13} />
            </button>

            {i > 0 && (
              <button type="button" onClick={() => makeFirst(i)} aria-label="Use as the main photo" title="Use as the main photo"
                style={{ position: 'absolute', bottom: 4, left: 4, width: 22, height: 22, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'var(--surface-overlay)', color: 'var(--white)', display: 'grid', placeItems: 'center' }}>
                <Star size={12} />
              </button>
            )}
          </div>
        ))}

        {slots.length < MAX_IMAGES && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            style={{
              width: 92, height: 92, borderRadius: 12, flex: 'none',
              border: '1.5px dashed var(--border-strong)', background: 'var(--surface-raised)',
              cursor: busy ? 'wait' : 'pointer', display: 'grid', placeItems: 'center', gap: 4,
              color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-2xs)', fontWeight: 700,
            }}>
            <span style={{ display: 'grid', placeItems: 'center', gap: 3 }}>
              <Upload size={17} />
              {busy ? 'Uploading…' : 'Add photo'}
            </span>
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple
        onChange={e => void pick(e.target.files)} style={{ display: 'none' }} />

      <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '8px 0 0', lineHeight: 1.5 }}>
        JPG, PNG, WebP, AVIF or GIF, up to 8 MB each. Square photos around 800×800 look best on the
        menu. Up to {MAX_IMAGES}.
      </p>

      {err && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 8, padding: '8px 11px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-xs)' }}>
          <AlertTriangle size={14} style={{ flex: 'none', marginTop: 1 }} /><span style={{ flex: 1 }}>{err}</span>
          <button type="button" onClick={() => setErr('')} style={{ ...iconBtn, width: 20, height: 20, marginRight: 0, border: 'none', background: 'transparent', color: 'inherit' }}><X size={12} /></button>
        </div>
      )}

      {/* An escape hatch for the legacy '/assets/...' files, which are not uploads and cannot be
          re-created through this form. Only offered when the list is empty, so it does not invite
          hand-typing a path over a perfectly good photo. */}
      {!slots.length && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ ...actionBtn(), display: 'inline-flex', listStyle: 'none' }}>Use a file already on the site instead</summary>
          <input
            placeholder="/assets/products/adc-special.jpg"
            onChange={e => {
              const v = e.target.value.trim();
              onChange(v ? [{ ref: v, url: v }] : []);
            }}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: '9px 11px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}
          />
        </details>
      )}
    </div>
  );
}
