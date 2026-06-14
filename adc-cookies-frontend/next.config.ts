import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server's HMR/assets to be loaded from your LAN IP (phone on same Wi-Fi).
  allowedDevOrigins: ['192.168.1.24'],
  images: {
    remotePatterns: [],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
  },
};

export default nextConfig;
