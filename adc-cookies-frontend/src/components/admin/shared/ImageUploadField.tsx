'use client';
import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, AlertTriangle, ImageOff, Info } from 'lucide-react';
import { adminUploadMedia } from '@/lib/api';
import { actionBtn } from './ui';

/*
 * One image, with the size it is meant to be.
 *
 * Separate from the products tab's uploader on purpose: that one manages an ordered list where the
 * first entry is the one the shop shows, and this one fills a specific slot at a specific aspect
 * ratio. Rolling them together would mean a component whose behaviour depends on which of two modes
 * it was handed.
 *
 * The dimension check WARNS rather than blocks. The right size is knowable (it is printed on the
 * field) but a hero photo two hundred pixels short is still a better hero photo than the one it is
 * replacing, and refusing it would leave the admin with no way to proceed and no explanation they
 * could act on. Refusing on type and size is different — those fail server-side anyway.
 */

export interface ExpectedSize { width: number; height: number; note?: string }

interface Props {
  label: string;
  hint?: string;
  /** The stored reference: 'supabase://…', a '/assets/…' path, or '' for nothing. */
  value: string;
  /** The URL that displays `value`. Expires, for an uploaded file — never save it. */
  url: string | null;
  onChange: (ref: string, url: string) => void;
  expected?: ExpectedSize;
  /** Falls back to this when nothing is set, so the field shows what the site is using today. */
  fallbackUrl?: string;
  aspect?: number;
}

/** The file's real pixel size, read before it is sent anywhere. Null if the browser cannot decode it. */
function measure(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export default function ImageUploadField({ label, hint, value, url, onChange, expected, fallbackUrl, aspect = 2 }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState('');
  const [broken, setBroken] = useState(false);

  const shown = url || (value ? value : '') || fallbackUrl || '';
  const usingFallback = !value && !!fallbackUrl;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setErr(''); setWarn(''); setBusy(true);
    try {
      if (expected) {
        const dims = await measure(file);
        if (dims && (dims.width < expected.width * 0.75 || dims.height < expected.height * 0.75)) {
          setWarn(`That image is ${dims.width}×${dims.height}. ${expected.width}×${expected.height} is what the page is built for, so this one will look soft.`);
        }
      }
      const up = await adminUploadMedia(file, 'hero');
      setBroken(false);
      onChange(up.ref, up.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That upload did not work.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <span style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</span>

      <div style={{
        position: 'relative', width: '100%', aspectRatio: String(aspect), maxWidth: 420,
        borderRadius: 12, overflow: 'hidden', background: 'var(--surface-sunken)',
        border: `1.5px ${value ? 'solid' : 'dashed'} ${value ? 'var(--border-default)' : 'var(--border-strong)'}`,
      }}>
        {shown && !broken ? (
          /* unoptimized: a signed URL sits on a host next/image has no loader for, and one that
             rotates weekly has nothing worth caching. */
          <Image src={shown} alt="" fill sizes="420px" unoptimized onError={() => setBroken(true)} style={{ objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-subtle)', gap: 5 }}>
            <span style={{ display: 'grid', placeItems: 'center', gap: 4, fontSize: 'var(--text-2xs)', fontWeight: 700 }}>
              <ImageOff size={20} />
              {broken ? 'Could not load this image' : 'Nothing uploaded'}
            </span>
          </div>
        )}

        {usingFallback && !broken && (
          <span style={{ position: 'absolute', left: 8, top: 8, padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-overlay)', color: 'var(--white)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>
            Currently on the site
          </span>
        )}

        {value && (
          <button type="button" onClick={() => { onChange('', ''); setBroken(false); setWarn(''); }}
            title="Remove, and go back to the file the site ships" aria-label="Remove image"
            style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-overlay)', color: 'var(--white)', display: 'grid', placeItems: 'center' }}>
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 9 }}>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          style={{ ...actionBtn(), padding: '8px 14px', cursor: busy ? 'wait' : 'pointer' }}>
          <Upload size={13} /> {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        {expected && (
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 700 }}>
            {expected.width}×{expected.height}{expected.note ? ` · ${expected.note}` : ''}
          </span>
        )}
      </div>

      {hint && <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '7px 0 0', lineHeight: 1.5 }}>{hint}</p>}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={e => void pick(e.target.files?.[0])} style={{ display: 'none' }} />

      {warn && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 8, padding: '8px 11px', borderRadius: 'var(--radius-sm)', background: 'var(--amber-50)', color: 'var(--orange-800)', fontSize: 'var(--text-xs)' }}>
          <Info size={14} style={{ flex: 'none', marginTop: 1 }} /><span style={{ flex: 1 }}>{warn}</span>
        </div>
      )}
      {err && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 8, padding: '8px 11px', borderRadius: 'var(--radius-sm)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-xs)' }}>
          <AlertTriangle size={14} style={{ flex: 'none', marginTop: 1 }} /><span style={{ flex: 1 }}>{err}</span>
        </div>
      )}
    </div>
  );
}
