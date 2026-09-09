import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/*
 * Uploaded media — product photos and the hero banner — on our own disk.
 *
 * Moved off Supabase Storage on 2026-09-09, the last thing in the app that needed Supabase. The
 * bucket was empty at the time (0 of 35 production products referenced it; everything on the site
 * is a static /assets file), so nothing had to be migrated and no reference had to be rewritten.
 *
 * NOTHING HERE IS REACHABLE BY PATH ALONE. Files live outside the web root and are served only by
 * routes/media.routes.ts, which demands a time-limited HMAC signature minted below. That preserves
 * the private-bucket-and-signed-URL choice this file was built around, rather than quietly
 * downgrading it to a public folder because a folder is easier.
 *
 * The costs of that choice are unchanged and worth restating:
 *
 *   - A signed URL expires. It cannot go in an OpenGraph tag, an email, or anywhere that outlives
 *     the signature. The static files under /assets stay where they are for exactly that reason —
 *     layout.tsx's og:image is one of them.
 *   - URLs are cached here for as long as they are valid and re-minted a day before they lapse.
 *     Signing is now local and cheap, so the cache is no longer about avoiding a round trip: it is
 *     about URL STABILITY. A fresh signature on every request would change the src of every image
 *     on every page load and defeat the browser cache entirely.
 *
 * WHAT IS STORED IN THE DATABASE IS A REFERENCE, NEVER A URL: 'media://products/12-red-velvet.jpg'.
 * A signed URL written into products.images would work for a week and then quietly 404, and the
 * only way to notice would be a customer telling us. The scheme prefix keeps the two impossible to
 * confuse and leaves legacy '/assets/...' paths passing through untouched.
 *
 * ON DURABILITY, SO IT IS NOT A SURPRISE LATER. A Railway volume is one disk on one node: no
 * replication, and no volume backup schedule is currently set. The nightly R2 backup covers the
 * DATABASE only, so it holds the references and not the bytes. Losing the volume loses the images
 * while every product row still points at them. Cloudflare R2 was the alternative and would have
 * fixed that; the volume was chosen deliberately, and this note is here so the trade stays visible.
 */

/** Where the bytes live. On Railway this lands inside the service's volume. */
const MEDIA_DIR = process.env.MEDIA_DIR
  || (process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'media') : null)
  || path.join(process.cwd(), '.media');

/** Kept exported: callers and logs still speak of a bucket, and renaming it buys nothing. */
export const MEDIA_BUCKET = 'adc-media';

export const REF_SCHEME = 'media://';
/*
 * Old references are still read. Production had none when this changed, so this is not load-bearing
 * — but a reference is a value in a TEXT column that outlives whatever wrote it, and the cost of
 * accepting both is one array. A row that did survive somewhere would otherwise render as literal
 * text where a photo should be.
 */
const LEGACY_SCHEMES = ['supabase://'];

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

/** Content type by extension — the reverse map, for serving what was written. */
export const TYPE_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_TYPES).map(([type, ext]) => [ext, type]),
);

/*
 * Signing key.
 *
 * JWT_SECRET is reused rather than adding another variable to set on two services and forget on a
 * third. It is already required for the app to boot, so there is no configuration state where
 * uploads work and signing does not.
 */
const signingKey = () => process.env.JWT_SECRET || '';

export const storageConfigured = () => !!signingKey();

/* ---------- references ---------- */

export const isMediaRef = (v) =>
  typeof v === 'string' && (v.startsWith(REF_SCHEME) || LEGACY_SCHEMES.some((s) => v.startsWith(s)));

export const refToPath = (v) => {
  const s = String(v);
  for (const scheme of [REF_SCHEME, ...LEGACY_SCHEMES]) {
    if (s.startsWith(scheme)) return s.slice(scheme.length);
  }
  return s;
};

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

/* ---------- paths ---------- */

/**
 * A stored path resolved to a real file, or null if it tries to escape.
 *
 * This is the only thing standing between a signed URL and the rest of the filesystem, so it
 * resolves and then checks containment rather than pattern-matching for '..' — normalisation,
 * symlinks and encoding tricks all defeat a blocklist, and none of them defeat asking whether the
 * resolved path is actually inside the directory. A signature alone is not enough: whoever holds
 * one holds a path we minted, but the check must hold even if that assumption ever stops being true.
 */
export function resolveMediaPath(rel: string): string | null {
  const cleaned = String(rel || '').replace(/^\/+/, '');
  if (!cleaned) return null;
  const full = path.resolve(MEDIA_DIR, cleaned);
  const root = path.resolve(MEDIA_DIR);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

/* ---------- the directory ---------- */

let dirReady = false;

/**
 * Make sure the media directory exists. Idempotent, and safe to call on every boot and every upload.
 *
 * Named for the bucket it replaces because three call sites and the boot sequence already say
 * "ensureMediaBucket", and a rename would be churn for its own sake.
 */
export async function ensureMediaBucket() {
  if (dirReady) return true;
  /* Says so out loud rather than returning quietly. A silent no-op at boot means the first person
     to upload a photo is the one who finds out. */
  if (!storageConfigured()) {
    console.warn('[STORAGE] image uploads are OFF — JWT_SECRET is unset, so URLs cannot be signed');
    return false;
  }
  try {
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    dirReady = true;
    const onVolume = !!process.env.RAILWAY_VOLUME_MOUNT_PATH && MEDIA_DIR.startsWith(process.env.RAILWAY_VOLUME_MOUNT_PATH);
    /* Whether this is on the volume is the single most useful fact about it: the same code writing
       to a container's own filesystem loses every image on the next deploy, silently. */
    console.log(`[STORAGE] media dir ${MEDIA_DIR} ready (${onVolume ? 'on the volume — survives deploys' : 'NOT on a volume — files are lost on redeploy'})`);
    return true;
  } catch (e: any) {
    console.error(`[STORAGE] could not create ${MEDIA_DIR}: ${e?.message || e}`);
    return false;
  }
}

/* ---------- signing ---------- */

/** path -> { url, expiresAtMs }. Bounded, so a long-lived process cannot grow it without limit. */
const signedCache = new Map();
const CACHE_MAX = 500;

function cached(p) {
  const hit = signedCache.get(p);
  if (hit && hit.expiresAtMs - Date.now() > REMINT_BEFORE_MS) return hit.url;
  return null;
}

function remember(p, url) {
  if (signedCache.size >= CACHE_MAX) {
    // Oldest insertion first — Map preserves insertion order, so this is the least recently minted.
    const oldest = signedCache.keys().next().value;
    if (oldest !== undefined) signedCache.delete(oldest);
  }
  signedCache.set(p, { url, expiresAtMs: Date.now() + SIGNED_TTL_S * 1000 });
}

/** The signature for one path and expiry. Both are covered, so neither can be edited on its own. */
export function mediaSignature(relPath: string, expMs: number): string {
  return crypto.createHmac('sha256', signingKey()).update(`${relPath}|${expMs}`).digest('hex');
}

/**
 * Is this signature good for this path, right now?
 *
 * timingSafeEqual, not ===, so a signature cannot be recovered a byte at a time by measuring how
 * long the comparison takes. The lengths are checked first because timingSafeEqual throws on a
 * mismatch rather than returning false.
 */
export function verifyMediaSignature(relPath: string, expRaw: unknown, sigRaw: unknown): boolean {
  if (!storageConfigured()) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const given = String(sigRaw || '');
  const want = mediaSignature(relPath, exp);
  if (given.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want));
}

/**
 * Sign a batch of references, and hand back a ref -> url map.
 *
 * Anything that is not a media reference passes through as itself: '/assets/...' files are served
 * by the frontend and need no signature. A reference that cannot be signed passes through as well
 * rather than being dropped, so a misconfiguration shows a broken image instead of an empty
 * catalogue.
 *
 * The URLs are RELATIVE. The browser reaches the backend through the frontend's own origin (Next
 * rewrites /api), so a relative path needs no knowledge of the public hostname here — and it
 * cannot go stale the way a baked-in absolute URL does when a domain changes.
 */
export async function signMediaRefs(refs) {
  const out = new Map();
  const unique = [...new Set((refs || []).filter(Boolean).map(String))];
  const needed: any[] = [];

  for (const ref of unique) {
    if (!isMediaRef(ref)) { out.set(ref, ref); continue; }
    const rel = refToPath(ref);
    const hit = cached(rel);
    if (hit) out.set(ref, hit);
    else needed.push({ ref, rel });
  }

  if (!needed.length) return out;
  if (!storageConfigured()) {
    for (const { ref } of needed) out.set(ref, ref);
    return out;
  }

  for (const { ref, rel } of needed) {
    /* Rounded to the hour so the same file yields the same URL for an hour at a time. Without it
       every render would mint a unique query string and every image would miss the browser cache. */
    const exp = Math.ceil((Date.now() + SIGNED_TTL_S * 1000) / 3600_000) * 3600_000;
    const url = `/api/media/${rel.split('/').map(encodeURIComponent).join('/')}?exp=${exp}&sig=${mediaSignature(rel, exp)}`;
    remember(rel, url);
    out.set(ref, url);
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
 * Put bytes on disk and return the reference to store.
 *
 * The filename carries a timestamp so a re-upload never overwrites the file a page is still
 * showing — the old signed URL keeps working until the row stops pointing at it, and cache-busting
 * is not something a signed URL can express.
 */
export async function uploadMedia({ buffer, contentType, prefix = 'misc', name = 'file' }) {
  if (!storageConfigured()) throw new Error('Image uploads are not configured (JWT_SECRET is unset).');
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported file type: ${contentType || 'unknown'}. Use JPG, PNG, WebP, AVIF or GIF.`);
  if (!buffer?.length) throw new Error('The file was empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error(`That file is ${(buffer.length / 1048576).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1048576} MB.`);

  if (!(await ensureMediaBucket())) throw new Error('Image storage is unavailable.');

  /* The prefix is ours, never the caller's raw input, but it is still resolved through the same
     containment check — a route that one day passes a user-supplied folder should fail here rather
     than write outside the media directory. */
  const safePrefix = String(prefix).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'misc';
  const slug = String(name).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'file';
  const rel = `${safePrefix}/${Date.now()}-${slug}.${ext}`;

  const full = resolveMediaPath(rel);
  if (!full) throw new Error('Upload failed: bad destination path.');

  await fs.mkdir(path.dirname(full), { recursive: true });
  /* wx: fail rather than overwrite. The timestamp makes a collision essentially impossible, and if
     one ever happens it is a bug worth an error rather than a silently replaced photo. */
  await fs.writeFile(full, buffer, { flag: 'wx' });

  return { ref: pathToRef(rel), path: rel, bytes: buffer.length, contentType };
}

/** Remove a file. Only ever called for a reference nothing points at any more. */
export async function deleteMedia(ref) {
  if (!isMediaRef(ref)) return false;
  const rel = refToPath(ref);
  const full = resolveMediaPath(rel);
  signedCache.delete(rel);
  if (!full) return false;
  try {
    await fs.unlink(full);
    return true;
  } catch (e: any) {
    /* Already gone is the outcome we wanted, not a failure — deleting twice should be quiet. */
    if (e?.code === 'ENOENT') return true;
    console.warn(`[STORAGE] could not delete ${rel}: ${e?.message || e}`);
    return false;
  }
}
