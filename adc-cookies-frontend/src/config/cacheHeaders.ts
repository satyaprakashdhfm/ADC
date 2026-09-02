import type { NextConfig } from 'next';

/**
 * How long a shared cache may keep the files we ship in `public/`.
 *
 * THE PROBLEM THIS SOLVES
 *
 * Next.js serves everything under `public/` with `Cache-Control: public, max-age=0`. That is the
 * right default for a framework — a file there keeps its name when you replace it (unlike
 * `/_next/static/<hash>.js`, which gets a new name every build), so promising a long cache would
 * mean a swapped logo staying wrong in people's browsers for as long as the promise lasted.
 *
 * It is the wrong default for THIS site. `public/assets` is 96 MB — 35 product photos, the hero
 * images, the logo, and five ~2 MB videos — and it changes perhaps twice a year. With `max-age=0`
 * the CDN honours the origin and refuses to keep any of it, so every visitor pulled all of it from
 * the origin region. Measured on the deployed site before this existed:
 *
 *   /assets/cookies_new_images/chocolate-chip.jpeg   x-cache: MISS  MISS   (211 KB)
 *   /assets/adc-logo.png                             x-cache: MISS  MISS   (112 KB)
 *   /assets/hero-video.mp4                           x-cache: MISS  MISS   (2.07 MB)
 *
 * The logo is the clearest waste: 112 KB, on every page, fetched from the origin every time.
 *
 * WHY THE DIRECTIVES LOOK CONTRADICTORY
 *
 * They address different audiences, which is the whole trick:
 *
 *   max-age    → the visitor's browser
 *   s-maxage   → shared caches only (the CDN); overrides max-age for them
 *   stale-while-revalidate → serve the stale copy while fetching a fresh one, so an expiry is
 *                            never a slow request for whoever happens to arrive first
 *
 * So this says: browser, keep it an hour; CDN, keep it a day; and never make anyone wait for a
 * refresh.
 *
 * THE TRADE, STATED PLAINLY
 *
 * Railway's "Purge Cache on Deploy" is set to purge HTML only — correct, because hashed assets are
 * immutable and purging them every deploy would throw away a good cache for nothing. The
 * consequence is that these files are NOT purged on deploy: replace a product photo and the edge
 * may serve the old one for up to a day. Clicking "Purge All" once pushes it out immediately.
 *
 * A day is the deliberate ceiling. A week would cache better and make a stale photo a genuine
 * support problem; an hour would barely beat no caching at all on a site this size.
 *
 * Not covered here, and deliberately so:
 *   - `/_next/static/*` — Next already sends `max-age=31536000, immutable` and, per its own docs,
 *     that "cannot be overridden". Nothing to do; it is already correct.
 *   - Uploaded product photos — those become signed Supabase URLs served from Supabase's domain,
 *     not ours, so this cannot reach them. Shrinking the file at upload is their equivalent.
 */

/** Browsers revalidate after an hour. Short enough that a purge reaches returning visitors soon. */
const BROWSER_SECONDS = 60 * 60;
/** The edge holds it for a day — see the note above on why this is not longer. */
const EDGE_SECONDS = 60 * 60 * 24;
/** A week of serving stale while refreshing in the background. */
const STALE_SECONDS = 60 * 60 * 24 * 7;

export const ASSET_CACHE_CONTROL =
  `public, max-age=${BROWSER_SECONDS}, s-maxage=${EDGE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`;

/**
 * The `headers()` entries for next.config.
 *
 * Next's own docs confirm the mechanism reaches these files: "Headers are checked before the
 * filesystem which includes pages and /public files." Without that, a rule like this would silently
 * do nothing for exactly the paths it is aimed at.
 */
export const cacheHeaders: NonNullable<NextConfig['headers']> = async () => [
  {
    // Everything we ship as a file: photos, videos, the logo, doodles, payment marks.
    source: '/assets/:path*',
    headers: [{ key: 'Cache-Control', value: ASSET_CACHE_CONTROL }],
  },
];
