/*
 * Instagram reels shown on the homepage (@adoughcookie).
 *
 * These are SELF-HOSTED copies (public/assets/reels/<id>.mp4), not Instagram embeds. An embed is
 * Instagram's own player: it shows their chrome and counters, cannot autoplay, and clicking it
 * leaves the site. Serving the file ourselves is the only way to get inline silent autoplay.
 *
 * Every reel below is either posted by @adoughcookie or a collab where @adoughcookie is a
 * co-author (Instagram `coauthorProducers`) — i.e. it appears on ADC's own profile grid, so it's
 * ADC content rather than a stranger's video being reposted.
 *
 * TO ADD A REEL:
 *   1. Save its mp4 to public/assets/reels/<shortcode>.mp4
 *      (shortcode = the bit after /p/ or /reel/ in the Instagram URL)
 *   2. Add a row below with that same id. Keep clips short — each one ships to every visitor.
 *
 * Order here is the order on the rail (best-performing first). An empty list hides the rail and
 * shows a follow-CTA instead, so the section is never an empty shell.
 */
export interface Reel {
  /** Shortcode — also the mp4 filename in public/assets/reels/. */
  id: string;
  caption?: string;
}

export const INSTAGRAM_HANDLE = 'adoughcookie';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export const REELS: Reel[] = [
  { id: 'DY6saFpTLM9', caption: 'Tag the friend who owes you a cookie date' },
  { id: 'DaXPVY3zjL4', caption: 'Cookie tins — freshly baked, 100% eggless' },
  { id: 'DY4ebmXTevu', caption: 'Dessert heaven in Jayanagar' },
  { id: 'DapIc_KTrj5', caption: 'There’s always room for one more cookie' },
  { id: 'DZO08rdTarD', caption: 'Your next addiction, from ₹45' },
  { id: 'DZpmKfYztBR', caption: 'Cookie tin drop — open, bite, repeat' },
  { id: 'DZ6kLNtuSNb', caption: 'Unboxing happiness in a tin' },
  { id: 'Dahs72eT4oS', caption: 'Mini Cookie Box, baked fresh daily' },
  { id: 'DZzx1BWTXuw', caption: 'One Wish Willow never saw us coming' },
  { id: 'DaDUJGczvDS', caption: 'Red velvet cookie milkshake' },
  { id: 'DZ7eYIBSV06', caption: 'Negative reviews? The cats are getting desperate' },
];

/** Self-hosted video file for a reel. */
export const reelVideo = (id: string) => `/assets/reels/${id}.mp4`;
/** The original post, for anyone who wants the real thing. */
export const reelUrl = (id: string) => `https://www.instagram.com/p/${id}/`;
