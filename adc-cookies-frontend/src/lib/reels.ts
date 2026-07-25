/*
 * Instagram reels shown on the homepage (@adoughcookie).
 *
 * These are SELF-HOSTED copies (public/assets/reels/<id>.mp4), not Instagram embeds. An embed is
 * Instagram's own player: it shows their chrome, can't autoplay, and clicking it leaves the site.
 * Serving the file ourselves lets the rail autoplay muted, loop, and offer a sound toggle.
 *
 * TO ADD A REEL:
 *   1. Save the reel's mp4 to public/assets/reels/<shortcode>.mp4
 *      (shortcode = the bit after /p/ or /reel/ in its Instagram URL)
 *   2. Add a row below with that same id.
 *
 * Order here is the order on the rail. An empty list hides the rail and shows a follow-CTA
 * instead, so the section is never an empty shell.
 */
export interface Reel {
  /** Shortcode — also the mp4 filename in public/assets/reels/. */
  id: string;
  caption?: string;
}

export const INSTAGRAM_HANDLE = 'adoughcookie';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

// Video reels only (Instagram's `productType: 'clips'`) — the account's static image posts are
// deliberately left out, since this rail is meant to play, not be a photo grid.
export const REELS: Reel[] = [
  { id: 'DaXPVY3zjL4', caption: 'Cookie tins — freshly baked, 100% eggless' },
  { id: 'DapIc_KTrj5', caption: 'There’s always room for one more cookie' },
  { id: 'DZpmKfYztBR', caption: 'Cookie tin drop — open, bite, repeat' },
  { id: 'Dahs72eT4oS', caption: 'Mini Cookie Box, baked fresh daily' },
];

/** Self-hosted video file for a reel. */
export const reelVideo = (id: string) => `/assets/reels/${id}.mp4`;
/** The original post, for the "watch on Instagram" affordance. */
export const reelUrl = (id: string) => `https://www.instagram.com/p/${id}/`;
