/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  // GitHub Pages configuration
  basePath: process.env.NODE_ENV === 'production' ? '/Holo-Twin' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Holo-Twin/' : '',
  images: {
    unoptimized: true
  },
  // Mobile and PWA optimizations
  experimental: {
    // Removed optimizeCss to fix build issues
  },
  // Disable server-side features for static export
  distDir: 'out',
};

export default nextConfig;
