import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small Docker runtime image.
  output: 'standalone',
};

export default nextConfig;
