import { adminClient } from '../config/supabase.js';

/*
 * Uploaded media — product photos and the hero banner — in Supabase Storage.
 *
 * The bucket is PRIVATE. Nothing in it is reachable by URL alone; every read goes out as a
 * time-limited signed URL minted here with the service-role key. That is a deliberate trade and it
 * costs something worth knowing about:
 *
 *   - A signed URL expires. It cannot be pasted into an OpenGraph tag, an email, or anywhere else
 *     that outlives the signature. The static files under /assets stay where they are for exactly
 *     that reason — layout.tsx's og:image is one of them.
 *   - Signing is a round trip to Supabase, so URLs are cached here for as long as they are valid and
 *     re-minted a day before they lapse. Without the cache every catalogue request would sign every
 *     photo again.
 *
 * WHAT IS STORED IN THE DATABASE IS A REFERENCE, NEVER A URL: 'supabase://products/12-red-velvet.jpg'.
 * A signed URL written back into products.images would work for a week and then quietly 404, and the
 * only way to notice would be a customer telling us. The scheme prefix makes the two impossible to
 * confuse, and leaves legacy '/assets/...' paths passing through untouched.
 */

export const MEDIA_BUCKET = 'adc-media';
export const REF_SCHEME = 'supabase://';

/** A week. Long enough that the cache does real work, short enough that a leaked URL dies. */
const SIGNED_TTL_S = 7 * 24 * 3600;
/** Re-mint with a day to spare, so a URL handed to a browser is never about to expire. */
const REMINT_BEFORE_MS = 24 * 3600 * 1000;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Extension by content type. The allowlist IS this map — anything not here cannot be uploaded. */
export const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export const storageConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/* ---------- references ---------- */

export const isMediaRef = (v) => typeof v === 'string' && v.startsWith(REF_SCHEME);
export const refToPath = (v) => String(v).slice(REF_SCHEME.length);
export const pathToRef = (p) => `${REF_SCHEME}${String(p).replace(/^\/+/, '')}`;

/**
 * The stored TEXT column as a list of references.
 *
 * products.images has held three shapes over its life: a JSON array, a single bare path, and null.
 * All three still exist in the table, so all three are read here rather than migrated — a migration
 * that missed a row would blank that product's photo.
 */
export function parseMediaList(stored) {
  if (!stored) return [];
  const raw = String(stored).trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map((x) => String(x || '').trim()).filter(Boolean) : [];
    } catch {
      // Corrupt JSON: fall through and treat the whole string as one path rather than losing it.
    }
  }
  return [raw];
}

/** Back to the column's canonical shape. Always a JSON array, so there is one shape to read next time. */
export function serialiseMediaList(list) {
  const clean = (Array.isArray(list) ? list : []).map((x) => String(x || '').trim()).filter(Boolean);
  return clean.length ? JSON.stringify(clean) : null;
}

/* ---------- bucket ---------- */

let bucketReady = false;

/**
 * Create the bucket if it is not there yet. Idempotent, and safe to call on every boot.
 *
 * Both Supabase projects (staging and production) get it this way rather than by hand, so the two
 * cannot drift — a bucket that exists on one and not the other is a feature that works in testing
 * and 500s in production.
 */
export async function ensureMediaBucket() {
  if (bucketReady) return true;
  /* Says so out loud rather than returning quietly. Whether uploads work depends entirely on two
     environment variables, so a silent no-op at boot means the first person to try uploading a photo
     is the one who finds out — and the log gives no clue which of the two is missing. */
  if (!storageConfigured()) {
    console.warn('[STORAGE] image uploads are OFF — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return false;
  }
  const sb = adminClient();
  const { data } = await sb.storage.getBucket(MEDIA_BUCKET);
  if (data) {
    console.log(`[STORAGE] bucket ${MEDIA_BUCKET} already there (public=${!!data.public})`);
    bucketReady = true;
    return true;
  }
  const { error } = await sb.storage.createBucket(MEDIA_BUCKET, {
    public: false,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: Object.keys(ALLOWED_TYPES),
  });
  // A parallel boot of the other instance may have won the race; that is a success, not a failure.
  if (error && !/exist/i.test(error.message || '')) {
    console.warn(`[STORAGE] could not create the ${MEDIA_BUCKET} bucket: ${error.message}`);
    return false;
  }
  console.log(`[STORAGE] bucket ${MEDIA_BUCKET} ready (private)`);
  bucketReady = true;
  return true;
}

/* ---------- signing ---------- */

/** path -> { url, expiresAtMs }. Bounded, so a long-lived process cannot grow it without limit. */
const signedCache = new Map();
const CACHE_MAX = 500;

function cached(path) {
  const hit = signedCache.get(path);
  if (hit && hit.expiresAtMs - Date.now() > REMINT_BEFORE_MS) return hit.url;
  return null;
}

function remember(path, url) {
  if (signedCache.size >= CACHE_MAX) {
    // Oldest insertion first — Map preserves insertion order, so this is the least recently minted.
    const oldest = signedCache.keys().next().value;
    if (oldest !== undefined) signedCache.delete(oldest);
  }
  signedCache.set(path, { url, expiresAtMs: Date.now() + SIGNED_TTL_S * 1000 });
}

/**
 * Sign a batch of references in one call, and hand back a ref -> url map.
 *
 * Anything that is not a supabase:// reference is passed through as itself: '/assets/...' files are
 * served by the frontend and need no signature. A reference that fails to sign is passed through as
 * well rather than dropped, so a storage outage shows a broken image instead of an empty catalogue.
 */
export async function signMediaRefs(refs) {
  const out = new Map();
  const unique = [...new Set((refs || []).filter(Boolean).map(String))];
  const needed = [];

  for (const ref of unique) {
    if (!isMediaRef(ref)) { out.set(ref, ref); continue; }
    const path = refToPath(ref);
    const hit = cached(path);
    if (hit) out.set(ref, hit);
    else needed.push({ ref, path });
  }

  if (!needed.length || !storageConfigured()) {
    for (const { ref } of needed) out.set(ref, ref);
    return out;
  }

  try {
    const { data, error } = await adminClient()
      .storage.from(MEDIA_BUCKET)
      .createSignedUrls(needed.map((n) => n.path), SIGNED_TTL_S);
    if (error) throw error;
    const byPath = new Map((data || []).map((d) => [String(d.path || '').replace(/^\/+/, ''), d.signedUrl]));
    for (const { ref, path } of needed) {
      const url = byPath.get(path);
      if (url) { remember(path, url); out.set(ref, url); }
      else out.set(ref, ref);
    }
  } catch (err) {
    console.warn(`[STORAGE] could not sign ${needed.length} object(s): ${err?.message || err}`);
    for (const { ref } of needed) out.set(ref, ref);
  }
  return out;
}

/** One reference to one displayable URL. Returns '' for nothing at all. */
export async function signMediaRef(ref) {
  if (!ref) return '';
  return (await signMediaRefs([ref])).get(String(ref)) || '';
}

/* ---------- writing ---------- */

/**
 * Put bytes in the bucket and return the reference to store.
 *
 * The object key carries a timestamp so a re-upload never overwrites the file a page is still
 * showing — the old signed URL keeps working until the row stops pointing at it, and cache-busting
 * is not something a signed URL can express.
 */
export async function uploadMedia({ buffer, contentType, prefix = 'misc', name = 'file' }) {
  if (!storageConfigured()) throw new Error('Supabase Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).');
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported file type: ${contentType || 'unknown'}. Use JPG, PNG, WebP, AVIF or GIF.`);
  if (!buffer?.length) throw new Error('The file was empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error(`That file is ${(buffer.length / 1048576).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1048576} MB.`);

  await ensureMediaBucket();
  const slug = String(name).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'file';
  const path = `${prefix}/${Date.now()}-${slug}.${ext}`;

  const { error } = await adminClient().storage.from(MEDIA_BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { ref: pathToRef(path), path, bytes: buffer.length, contentType };
}

/** Remove an object. Only ever called for a reference nothing points at any more. */
export async function deleteMedia(ref) {
  if (!isMediaRef(ref) || !storageConfigured()) return false;
  const path = refToPath(ref);
  const { error } = await adminClient().storage.from(MEDIA_BUCKET).remove([path]);
  signedCache.delete(path);
  if (error) { console.warn(`[STORAGE] could not delete ${path}: ${error.message}`); return false; }
  return true;
}
