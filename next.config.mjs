/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/Holo-Twin' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Holo-Twin/' : '',
  images: {
    unoptimized: true
  }
};

export default nextConfig;
