import type { NextConfig } from "next";

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
    // The About-Us video's own YouTube thumbnail is used as its pre-play poster (see AboutVideo.tsx).
    remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com' }],
  },
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
