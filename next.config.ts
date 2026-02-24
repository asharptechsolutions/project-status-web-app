import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  devIndicators: false,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
