import type { NextConfig } from "next";

const BACKEND = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:8080';

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev indicator ("N" badge) — dev-only UI, never shipped to prod.
  devIndicators: false,
  // Allow the dev server's HMR/assets to be loaded from your LAN IP (phone on same Wi-Fi).
  allowedDevOrigins: ['192.168.1.24'],
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
