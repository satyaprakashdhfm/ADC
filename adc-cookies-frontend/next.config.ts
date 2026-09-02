import type { NextConfig } from "next";
import { cacheHeaders } from "./src/config/cacheHeaders";

// In development, always proxy /api to the LOCAL backend so `next dev` (and phones on the LAN)
// hit your running server — never the deployed one — no matter what NEXT_PUBLIC_API_URL is set to.
// In production, /api rewrites to the configured backend (Railway).
const BACKEND =
  process.env.NODE_ENV === 'production'
    ? (process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:8080')
    : 'http://localhost:8080';

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev indicator ("N" badge) — dev-only UI, never shipped to prod.
  devIndicators: false,
  // Allow the dev server's HMR/assets to be loaded from your LAN IP (phone on same Wi-Fi).
  // Add whatever IP `next dev` prints under "Network:" (it can change with DHCP).
  allowedDevOrigins: ['192.168.1.24', '192.168.1.35', '192.168.1.37','192.168.1.42'],
  images: {
    remotePatterns: [
      // The About-Us video's own YouTube thumbnail is used as its pre-play poster (see AboutVideo.tsx).
      { protocol: 'https', hostname: 'i.ytimg.com' },
      /*
       * Uploaded product photos and hero banners, which live in a PRIVATE Supabase Storage bucket and
       * therefore arrive as signed URLs on the project's own supabase.co subdomain. Without this
       * every uploaded photo would throw "hostname is not configured under images" and the whole
       * catalogue would render broken — the storefront reaches these through <Image>, not <img>.
       *
       * Wildcarded because staging and production are two different Supabase projects with two
       * different subdomains, and pinning both would mean this file has to be edited to add an
       * environment. The cost of the wildcard is that our image optimizer would resize an object
       * from any Supabase project if it were ever handed such a URL; nothing does, and the
       * alternative is a config that silently breaks on the next project rename.
       *
       * Signatures rotate weekly, so each rotation is a fresh optimizer cache key. That churn is
       * accepted in exchange for keeping the bucket private.
       */
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
  /* How long the CDN and browsers may keep the files in public/. Next serves those with
     `max-age=0`, which stops any shared cache keeping them — see src/config/cacheHeaders.ts for
     what that was costing and why the numbers are what they are. */
  headers: cacheHeaders,

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      // /products/<slug> pages have been retired. They were live and indexable, so deleting the
      // route without this would turn every one of them — plus any link or bookmark pointing at
      // them — into a 404. A permanent redirect hands whatever ranking they had back to the
      // homepage instead of throwing it away, and `q` drops the visitor at that cookie in the menu
      // rather than at the top of an unrelated page.
      { source: '/products/:slug', destination: '/?q=:slug', permanent: true },
    ];
  },
};

export default nextConfig;
