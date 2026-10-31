import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    staleTimes: {
      dynamic: 15,
      static: 180,
    },
  },
};

export default nextConfig;
