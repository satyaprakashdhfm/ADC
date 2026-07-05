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
  allowedDevOrigins: ['192.168.1.24', '192.168.1.35', '192.168.1.37'],
  images: {
    remotePatterns: [],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
