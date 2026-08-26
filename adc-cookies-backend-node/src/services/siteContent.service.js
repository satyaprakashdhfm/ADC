import { getOne, query } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';
import { isMediaRef, signMediaRefs } from './storage.client.js';

/*
 * Editable site content: the two things the admin can change about the front page without a deploy.
 *
 * They were two files, heroBanner.js and bannerMessages.js, and the names were the problem — the
 * word "banner" meant two unrelated things one letter apart in the import list. They are the same
 * KIND of thing (one JSON blob in site_settings, read by the storefront, written by the admin
 * settings screen) and are easier to tell apart side by side than in separate files with
 * near-identical names. Nothing about either is changed by living here.
 *
 *   HERO BANNER   — the big photograph at the top of the home page, and where clicking it goes.
 *   RIBBON        — the rotating lines in the strip above the navbar.
 */

/* ==================================================================== */
/* Hero banner                                                          */
/* ==================================================================== */

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

/*
 * A moment, or nothing. Stored as UTC ISO so the window means the same thing wherever it is read;
 * the admin form does the local-time conversion, because that is the only place a human types one.
 */
function normaliseWhen(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) throw new ApiError('That start or end time is not a real date.');
  return t.toISOString();
}

export function normaliseHeroBanner(input) {
  const b = input || {};
  const startsAt = normaliseWhen(b.startsAt);
  const endsAt = normaliseWhen(b.endsAt);
  /* An end before its start is a window that can never open. Caught here rather than left to
     bannerIsLive, where it would simply never show and read as a broken upload. */
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new ApiError('The banner\u2019s end time has to be after its start time.');
  }
  return {
    desktopRef: normaliseImage(b.desktopRef),
    mobileRef: normaliseImage(b.mobileRef),
    href: normaliseHref(b.href),
    // Alt text is what a screen reader and a blocked-image fallback read out, so it is worth a field
    // of its own rather than a guess assembled from the destination.
    alt: String(b.alt ?? '').trim().slice(0, 160) || null,
    /* Off is a real state, and it keeps the uploaded photograph. Reset is pressed when an offer has
       finished, and making that throw away the artwork would mean re-uploading it to run the same
       promotion again. */
    enabled: b.enabled === undefined ? true : !!b.enabled,
    startsAt,
    endsAt,
    /* An offer banner is a finished piece of artwork with its own words on it. Our headline and the
       two buttons sit ON TOP of the hero photograph, so leaving them there prints our copy over
       theirs. Hidden by default for that reason; a plain photographic backdrop can turn it back on. */
    hideOverlay: b.hideOverlay === undefined ? true : !!b.hideOverlay,
  };
}

const EMPTY = {
  desktopRef: null, mobileRef: null, href: null, alt: null,
  enabled: true, startsAt: null, endsAt: null, hideOverlay: true,
};

/**
 * Is this banner showing right now?
 *
 * No window at all means "until I say otherwise", which is what every banner saved before scheduling
 * existed meant — so those keep working untouched. A window is inclusive of its start and exclusive
 * of its end, so "ends 6pm" stops at 6pm rather than lingering through it.
 */
export function bannerIsLive(b, now = new Date()) {
  if (!b?.enabled) return false;
  if (!b.desktopRef && !b.mobileRef) return false;
  if (b.startsAt && now < new Date(b.startsAt)) return false;
  if (b.endsAt && now >= new Date(b.endsAt)) return false;
  return true;
}

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
      // Absent on every banner saved before scheduling existed, and those must keep showing.
      enabled: saved.enabled === undefined ? true : !!saved.enabled,
      startsAt: saved.startsAt || null,
      endsAt: saved.endsAt || null,
      hideOverlay: saved.hideOverlay === undefined ? true : !!saved.hideOverlay,
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
export async function resolveHeroBanner({ ignoreWindow = false } = {}) {
  const b = await readHeroBanner();
  /*
   * The window is enforced HERE, not in the browser.
   *
   * This is the one call the storefront makes, so an offer that has finished stops being sent at
   * all - it cannot be shown by a tab left open since yesterday, or by a cached bundle, and there is
   * no clock on the visitor's device for it to depend on. Expiry is a fact about the server.
   *
   * ignoreWindow is for the admin panel, and only the admin panel. It edits the banner whether or
   * not the banner is currently on the site - before it starts, after it ends, and while it is
   * switched off - so filtering its preview by the window blanked the very image somebody had just
   * uploaded and reported it as one that could not be loaded.
   */
  if (!ignoreWindow && !bannerIsLive(b)) {
    return { desktop: null, mobile: null, href: null, alt: null, hideOverlay: false };
  }
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
  const desktop = usable(b.desktopRef);
  const mobile = usable(b.mobileRef);
  /* If neither image could be signed the storefront is about to fall back to the photograph it
     ships - which is the ordinary hero, and the ordinary hero keeps its headline. */
  const showing = !!(desktop || mobile);
  return { desktop, mobile, href: b.href, alt: b.alt, hideOverlay: showing && !!b.hideOverlay };
}

/* ==================================================================== */
/* Ribbon messages                                                      */
/* ==================================================================== */

/*
 * The rotating lines in the top ribbon.
 *
 * Stored as one JSON array under a single key rather than a row per message. The ribbon IS an
 * ordered list, and keeping the order in the data itself beats an ordering column that every
 * insert has to remember to set.
 *
 * There is deliberately no way to save an empty list. SiteNav offsets itself down by --ribbon-h
 * on the home page, so a ribbon that renders nothing would leave a 28px gap under the navbar —
 * the ribbon's height is part of the page's layout whether or not it has anything to say. One
 * message minimum keeps that contract true without the storefront needing to know about it.
 */

export const DEFAULT_BANNER_MESSAGES = [
  '100% Pure Veg · All our cookies are eggless',
  'Log in to save favourites & track your orders',
];

const MAX_MESSAGES = 12;
const MAX_LEN = 160;

/** Clean a caller-supplied list: trim, drop blanks, cap length and count. */
export function normaliseBannerMessages(list) {
  return (Array.isArray(list) ? list : [])
    .map((m) => String(m ?? '').trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_MESSAGES);
}

export async function readBannerMessages() {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'banner_messages'");
  if (row?.value) {
    try {
      const saved = normaliseBannerMessages(JSON.parse(row.value));
      if (saved.length) return saved;
    } catch {
      // Corrupt JSON should show the defaults, not take the ribbon down with it.
    }
  }
  /*
   * Nothing saved yet. The ribbon used to be two hardcoded lines plus one admin-set offer, so the
   * first read seeds the editable list with exactly what was already on screen — the offer first,
   * where it was — rather than dropping it the moment this panel replaces the old one.
   */
  const legacy = await getOne("SELECT value FROM site_settings WHERE key = 'header_offer'");
  const offer = legacy?.value ? String(legacy.value).trim() : '';
  return offer ? [offer, ...DEFAULT_BANNER_MESSAGES] : [...DEFAULT_BANNER_MESSAGES];
}

export async function writeBannerMessages(list) {
  const clean = normaliseBannerMessages(list);
  if (!clean.length) throw new ApiError('Keep at least one banner message — the ribbon is part of the page layout.');
  await query(
    `INSERT INTO site_settings (key, value) VALUES ('banner_messages', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(clean)]
  );
  // The seed above reads header_offer only until something is saved here. Once it is, that key is
  // stale data that would reappear if this row were ever deleted — so retire it on first save.
  await query("DELETE FROM site_settings WHERE key = 'header_offer'");
  return clean;
}
