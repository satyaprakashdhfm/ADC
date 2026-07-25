/*
 * Instagram reels shown on the homepage (@adoughcookie).
 *
 * TO ADD OR SWAP A REEL:
 *   1. Open the reel on Instagram, copy its URL — e.g. https://www.instagram.com/reel/DAbC123xyz/
 *   2. Paste the part after /reel/ as the `id` below (here: 'DAbC123xyz').
 *   3. Add a short `caption`. That's it — the homepage picks it up automatically.
 *
 * Order here is the order on the page. An empty list hides the whole section, so the page never
 * renders an empty shell while these are being filled in.
 */
export interface Reel {
  /** The shortcode from the reel URL — the bit between /reel/ and the next slash. */
  id: string;
  caption: string;
}

export const INSTAGRAM_HANDLE = 'adoughcookie';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export const REELS: Reel[] = [
  // ⚠️ PLACEHOLDERS — replace these shortcodes with real ones from @adoughcookie.
  // Until they're replaced, each tile shows a "watch on Instagram" cover instead of an embed.
];

export const reelUrl = (id: string) => `https://www.instagram.com/reel/${id}/`;
