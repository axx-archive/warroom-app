/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable server actions for file system access
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
