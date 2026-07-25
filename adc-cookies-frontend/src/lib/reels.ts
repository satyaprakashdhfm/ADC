/*
 * Instagram reels shown on the homepage (@adoughcookie).
 *
 * TO ADD OR SWAP A REEL:
 *   1. Open the reel on Instagram, copy its URL — e.g. https://www.instagram.com/p/DaXPVY3zjL4/
 *   2. Paste the part after /p/ (or /reel/) as the `id` below — here: 'DaXPVY3zjL4'.
 *   3. Optionally add a short `caption`. That's it — the homepage picks it up automatically.
 *
 * Order here is the order on the page (currently most-played first). An empty list hides the rail
 * and shows a follow-CTA instead, so the section is never an empty shell.
 */
export interface Reel {
  /** The shortcode from the post URL — the bit between /p/ (or /reel/) and the next slash. */
  id: string;
  caption?: string;
}

export const INSTAGRAM_HANDLE = 'adoughcookie';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

// Video reels only (Instagram's `productType: 'clips'`) — the account's static image posts are
// deliberately left out, since this rail is meant to play, not to be a photo grid.
export const REELS: Reel[] = [
  { id: 'DaXPVY3zjL4', caption: 'Cookie tins — freshly baked, 100% eggless' },
  { id: 'DapIc_KTrj5', caption: 'There’s always room for one more cookie' },
  { id: 'DZpmKfYztBR', caption: 'Cookie tin drop — open, bite, repeat' },
  { id: 'Dahs72eT4oS', caption: 'Mini Cookie Box, baked fresh daily' },
];

/* Uses /p/ rather than /reel/: Instagram serves both post types from /p/, so this works whether a
   shortcode came from a reel URL or a feed-post URL. */
export const reelUrl = (id: string) => `https://www.instagram.com/p/${id}/`;
