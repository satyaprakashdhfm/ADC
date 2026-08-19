import { getOne, query } from './db.js';
import { ApiError } from './middleware.js';
import { isMediaRef, signMediaRefs } from './storage.js';

/*
 * The big photograph at the top of the home page, and where clicking it goes.
 *
 * Stored as one JSON object under a single site_settings key rather than four rows: the four fields
 * are only ever read and written together, and a half-saved banner (a new desktop photo with the old
 * mobile crop) is not a state worth being able to reach.
 *
 * TWO images, not one, because the hero is art-directed. A 2:1 landscape photo has its sides cropped
 * away on a portrait phone — the hero is a tall centred block — so the storefront picks between them
 * with a media query (see HomeHero's <picture>). Either may be left unset, in which case the
 * storefront falls back to the file it has always shipped, so this can never leave the page blank.
 */

const KEY = 'hero_banner';

/** What the frontend already ships at these breakpoints, and therefore what an upload should match. */
export const HERO_SIZES = {
  desktop: { width: 2400, height: 1200, note: '2:1 landscape' },
  mobile: { width: 1200, height: 1600, note: '3:4 portrait' },
};

/**
 * Where clicking the banner takes you.
 *
 * A path on the site or an https link, and nothing else. Rejecting the rest is not paranoia about
 * the admin: javascript: and data: URLs are the two that turn a banner into a way of running script
 * on the storefront, and this value is rendered into an href for every visitor.
 */
function normaliseHref(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.startsWith('//')) throw new ApiError('Write the destination in full, starting https://');
  if (s.startsWith('/')) return s.slice(0, 300);
  if (/^https:\/\/[^\s]+$/i.test(s)) return s.slice(0, 300);
  throw new ApiError('The destination must be a path on this site (e.g. /corporate) or a full https:// link.');
}

/** An image field: an uploaded reference, a path to a file the frontend ships, or nothing. */
function normaliseImage(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (isMediaRef(s) || s.startsWith('/')) return s.slice(0, 400);
  throw new ApiError('A banner image must be uploaded here, or be a path to a file on the site.');
}

export function normaliseHeroBanner(input) {
  const b = input || {};
  return {
    desktopRef: normaliseImage(b.desktopRef),
    mobileRef: normaliseImage(b.mobileRef),
    href: normaliseHref(b.href),
    // Alt text is what a screen reader and a blocked-image fallback read out, so it is worth a field
    // of its own rather than a guess assembled from the destination.
    alt: String(b.alt ?? '').trim().slice(0, 160) || null,
  };
}

const EMPTY = { desktopRef: null, mobileRef: null, href: null, alt: null };

/** The stored settings, unresolved. Never throws — a corrupt row must not take the home page down. */
export async function readHeroBanner() {
  const row = await getOne('SELECT value FROM site_settings WHERE key = $1', [KEY]);
  if (!row?.value) return { ...EMPTY };
  try {
    const saved = JSON.parse(row.value);
    return {
      desktopRef: saved.desktopRef || null,
      mobileRef: saved.mobileRef || null,
      href: saved.href || null,
      alt: saved.alt || null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeHeroBanner(input) {
  const clean = normaliseHeroBanner(input);
  await query(
    `INSERT INTO site_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [KEY, JSON.stringify(clean)]
  );
  return clean;
}

/**
 * The banner with its images resolved to URLs a browser can load.
 *
 * Signed URLs expire, which is why the storefront asks for this at run time instead of it being
 * baked into the page: a signature captured at build time would stop working a week after a deploy,
 * on the one image every visitor sees first.
 */
export async function resolveHeroBanner() {
  const b = await readHeroBanner();
  const signed = await signMediaRefs([b.desktopRef, b.mobileRef].filter(Boolean));
  /* signMediaRefs hands back the reference unchanged when it could not sign it. Passing that on
     would put 'supabase://…' into an <img src>, so it is reported as nothing instead — the
     storefront then keeps the file it ships, and a storage outage shows the old photograph rather
     than a broken one on the first screen of the site. */
  const usable = (ref) => {
    if (!ref) return null;
    const url = signed.get(ref);
    return url && !isMediaRef(url) ? url : null;
  };
  return { desktop: usable(b.desktopRef), mobile: usable(b.mobileRef), href: b.href, alt: b.alt };
}
